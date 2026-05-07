from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.exceptions import EntityNotFoundError
from app.modules.komunikasi.application.schemas import (
    PublishAnnouncementRequest, SubmitLaporanRequest,
    ResolveLaporanRequest, SendWABlastRequest,
)
from app.modules.komunikasi.application.use_cases.publish_announcement import PublishAnnouncement
from app.modules.komunikasi.application.use_cases.submit_laporan import SubmitLaporan
from app.modules.komunikasi.application.use_cases.resolve_laporan import ResolveLaporan
from app.modules.komunikasi.application.use_cases.send_wa_blast import SendWABlast
from app.modules.komunikasi.infrastructure.repository import PgAnnouncementRepository, PgLaporanRepository

router = APIRouter()


@router.post("/komunikasi/announcements", status_code=201, tags=["Komunikasi"])
async def publish_announcement(
    body: PublishAnnouncementRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    ann = await PublishAnnouncement(PgAnnouncementRepository(db)).execute(
        rt_group_id=body.rt_group_id, created_by=UUID(current_user["user_id"]),
        title=body.title, body=body.body,
        ann_type=body.ann_type, channel=body.channel,
    )
    return {"id": str(ann.id), "title": ann.title, "channel": ann.channel}


@router.get("/komunikasi/announcements/{rt_group_id}", tags=["Komunikasi"])
async def list_announcements(
    rt_group_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    anns = await PgAnnouncementRepository(db).get_by_rt_group(rt_group_id)
    return [{"id": str(a.id), "title": a.title, "ann_type": a.ann_type,
             "channel": a.channel, "created_at": str(a.created_at)} for a in anns]


@router.post("/komunikasi/laporan", status_code=201, tags=["Komunikasi"])
async def submit_laporan(
    body: SubmitLaporanRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    laporan = await SubmitLaporan(PgLaporanRepository(db)).execute(
        rt_group_id=body.rt_group_id, resident_id=UUID(current_user["user_id"]),
        title=body.title, description=body.description, photo_url=body.photo_url,
    )
    return {"id": str(laporan.id), "status": laporan.status}


@router.get("/komunikasi/laporan/{rt_group_id}", tags=["Komunikasi"])
async def list_laporan(
    rt_group_id: UUID,
    status_filter: str = None,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.modules.komunikasi.domain.entities import LaporanStatus
    status_enum = LaporanStatus(status_filter) if status_filter else None
    laporan_list = await PgLaporanRepository(db).get_by_rt_group(rt_group_id, status=status_enum)
    return [{"id": str(l.id), "title": l.title, "status": l.status,
             "resident_id": str(l.resident_id)} for l in laporan_list]


@router.patch("/komunikasi/laporan/{laporan_id}/resolve", tags=["Komunikasi"])
async def resolve_laporan(
    laporan_id: UUID, body: ResolveLaporanRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        laporan = await ResolveLaporan(PgLaporanRepository(db)).execute(
            laporan_id=laporan_id, resolved_by=UUID(current_user["user_id"]), notes=body.notes,
        )
        return {"id": str(laporan.id), "status": laporan.status}
    except EntityNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.post("/komunikasi/wa/blast", tags=["Komunikasi"])
async def send_wa_blast(
    body: SendWABlastRequest,
    current_user: dict = Depends(require_admin),
):
    result = await SendWABlast().execute(
        phone_numbers=body.phone_numbers, message=body.message,
    )
    return result
