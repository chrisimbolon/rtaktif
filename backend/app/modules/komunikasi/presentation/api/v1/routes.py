"""
Komunikasi routes — WA blast, announcements, laporan.

WhatsApp Architecture: (SaaS model)
  - RTMudah owns ONE Fonnte account
  - Single FONNTE_TOKEN in server .env
  - Ketua RT never needs to configure anything
  - Just clicks "Reminder WA" → messages sent automatically
"""
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.exceptions import EntityNotFoundError
from app.modules.iam.infrastructure.models import RTGroupModel, UserModel
from app.modules.komunikasi.application.schemas import (
    PublishAnnouncementRequest, ResolveLaporanRequest, SendWABlastRequest,
    SubmitLaporanRequest)
from app.modules.komunikasi.application.use_cases.publish_announcement import \
    PublishAnnouncement
from app.modules.komunikasi.application.use_cases.resolve_laporan import \
    ResolveLaporan
from app.modules.komunikasi.application.use_cases.send_wa_blast import \
    SendWABlast
from app.modules.komunikasi.application.use_cases.submit_laporan import \
    SubmitLaporan
from app.modules.komunikasi.domain.entities import TriggerType
from app.modules.komunikasi.infrastructure.repository import (
    PgAnnouncementRepository, PgLaporanRepository, PgNotificationLogRepository)
from app.modules.tagihan.infrastructure.repository import PgInvoiceRepository
from app.modules.warga.infrastructure.models import ResidentModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

MONTHS_ID = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_rt(rt_group_id: UUID, db: AsyncSession):
    """Fetch RT group or raise 404."""
    result = await db.execute(
        select(RTGroupModel).where(RTGroupModel.id == rt_group_id)
    )
    rt = result.scalar_one_or_none()
    if not rt:
        raise HTTPException(404, "RT group tidak ditemukan")
    return rt


async def _get_active_phones(rt_group_id: UUID, db: AsyncSession) -> list[str]:
    """Fetch phone numbers of all active warga in an RT."""
    res_result = await db.execute(
        select(ResidentModel.user_id)
        .where(
            ResidentModel.rt_group_id == rt_group_id,
            ResidentModel.status      == "active",
        )
    )
    user_ids = [r.user_id for r in res_result.all()]
    if not user_ids:
        return []

    user_result = await db.execute(
        select(UserModel.phone)
        .where(
            UserModel.id.in_(user_ids),
            UserModel.phone != "",
        )
    )
    return [r.phone for r in user_result.all() if r.phone]


# ── Announcements ──────────────────────────────────────────────────────────────

@router.post("/komunikasi/announcements", status_code=201, tags=["Komunikasi"])
async def publish_announcement(
    body:         PublishAnnouncementRequest,
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    ann = await PublishAnnouncement(PgAnnouncementRepository(db)).execute(
        rt_group_id = body.rt_group_id,
        created_by  = UUID(current_user["user_id"]),
        title       = body.title,
        body        = body.body,
        ann_type    = body.ann_type,
        channel     = body.channel,
    )
    return {"id": str(ann.id), "title": ann.title, "channel": ann.channel}


@router.get("/komunikasi/announcements/{rt_group_id}", tags=["Komunikasi"])
async def list_announcements(
    rt_group_id:  UUID,
    current_user: dict = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    anns = await PgAnnouncementRepository(db).get_by_rt_group(rt_group_id)
    return [
        {
            "id":              str(a.id),
            "title":           a.title,
            "body":            a.body,
            "ann_type":        a.ann_type,
            "channel":         a.channel,
            "recipient_count": a.recipient_count,
            "created_at":      a.created_at.isoformat() if a.created_at else None,
        }
        for a in anns
    ]


# ── Laporan ────────────────────────────────────────────────────────────────────
@router.post("/komunikasi/laporan", status_code=201, tags=["Komunikasi"])
async def submit_laporan(
    body:         SubmitLaporanRequest,
    current_user: dict = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """
    Warga submits a laporan.
    Resolves user_id → resident_id before saving.
    """
    from app.modules.warga.infrastructure.models import ResidentModel
    from sqlalchemy import select as sa_select

    user_id = UUID(current_user["user_id"])

    # Lookup resident record for this user
    result = await db.execute(
        sa_select(ResidentModel.id)
        .where(
            ResidentModel.user_id    == user_id,
            ResidentModel.rt_group_id == body.rt_group_id,
        )
    )
    resident_row = result.scalar_one_or_none()

    if not resident_row:
        raise HTTPException(
            status_code=403,
            detail="Anda belum terdaftar sebagai warga di RT ini"
        )

    laporan = await SubmitLaporan(PgLaporanRepository(db)).execute(
        rt_group_id = body.rt_group_id,
        resident_id = resident_row,    # ← correct residents.id
        title       = body.title,
        description = body.description,
        photo_url   = body.photo_url,
    )
    return {
        "id":          str(laporan.id),
        "status":      laporan.status,
        "title":       laporan.title,
        "description": laporan.description,
        "created_at":  laporan.created_at.isoformat() if laporan.created_at else None,
    }



@router.get("/komunikasi/laporan/mine", tags=["Komunikasi"])
async def get_my_laporan(
    current_user: dict = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Warga fetches their own laporan submissions."""
    from app.modules.warga.infrastructure.models import ResidentModel
    from sqlalchemy import select as sa_select

    user_id = UUID(current_user["user_id"])
    result  = await db.execute(
        sa_select(ResidentModel.id)
        .where(ResidentModel.user_id == user_id)
    )
    resident_id = result.scalar_one_or_none()
    if not resident_id:
        return []

    laporans = await PgLaporanRepository(db).get_by_resident(resident_id)
    return [
        {
            "id":          str(l.id),
            "title":       l.title,
            "description": l.description,
            "status":      l.status,
            "photo_url":   l.photo_url,
            "created_at":  l.created_at.isoformat() if l.created_at else None,
            "resolved_at": l.resolved_at.isoformat() if l.resolved_at else None,
            "notes":       l.notes,
        }
        for l in laporans
    ]

@router.get("/komunikasi/laporan/{rt_group_id}", tags=["Komunikasi"])
async def list_laporan(
    rt_group_id:   UUID,
    status_filter: str = None,
    current_user:  dict = Depends(require_admin),
    db:            AsyncSession = Depends(get_db),
):
    from app.modules.komunikasi.domain.entities import LaporanStatus
    status_enum  = LaporanStatus(status_filter) if status_filter else None
    laporan_list = await PgLaporanRepository(db).get_by_rt_group(
        rt_group_id, status=status_enum
    )
    return [
        {
            "id":               str(l.id),
            "title":            l.title,
            "description":      l.description,
            "status":           l.status,
            "resident_id":      str(l.resident_id),
            "resolved_at":      l.resolved_at.isoformat() if l.resolved_at else None,
            "resolution_notes": l.resolution_notes,
            "created_at":       l.created_at.isoformat() if l.created_at else None,
        }
        for l in laporan_list
    ]


@router.patch("/komunikasi/laporan/{laporan_id}/resolve", tags=["Komunikasi"])
async def resolve_laporan(
    laporan_id:   UUID,
    body:         ResolveLaporanRequest,
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    try:
        laporan = await ResolveLaporan(PgLaporanRepository(db)).execute(
            laporan_id  = laporan_id,
            resolved_by = UUID(current_user["user_id"]),
            notes       = body.notes,
        )
        return {
            "id":          str(laporan.id),
            "status":      laporan.status,
            "resolved_at": laporan.resolved_at.isoformat() if laporan.resolved_at else None,
        }
    except EntityNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)


# ── WhatsApp ───────────────────────────────────────────────────────────────────
# Option A: RTMudah owns ONE Fonnte account (single FONNTE_TOKEN in .env)
# Ketua RT never needs to configure anything — just clicks a button.

@router.post("/komunikasi/wa/tagihan-reminder/{rt_group_id}", tags=["WhatsApp"])
async def send_tagihan_reminder(
    rt_group_id:  UUID,
    year:         int,
    month:        int,
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    """
    Smart tagihan reminder — Option A SaaS model:
    1. Auto-fetches all unpaid invoices for the period
    2. Auto-fetches phone numbers from residents → users
    3. Sends personalized WA to each unpaid warga
    4. Logs to notification_logs (immutable audit trail)

    Ketua RT just clicks the button — zero configuration needed.
    """
    rt         = await _get_rt(rt_group_id, db)
    rt_name    = f"RT {rt.rt_number}/RW {rt.rw_number} — {rt.kelurahan}"
    period_str = f"{MONTHS_ID[month]} {year}"

    # Fetch unpaid invoices
    repo     = PgInvoiceRepository(db)
    invoices = await repo.get_by_rt_and_period(rt_group_id, year, month)
    unpaid   = [inv for inv in invoices if inv.status in ("issued", "overdue")]

    if not unpaid:
        return {
            "sent": 0, "failed": 0, "total": 0,
            "message": f"Tidak ada tagihan belum bayar untuk {period_str}",
        }

    # Build resident → user mapping for phone + name
    resident_ids = [inv.resident_id for inv in unpaid]
    res_result   = await db.execute(
        select(ResidentModel.id, ResidentModel.user_id, ResidentModel.full_name)
        .where(ResidentModel.id.in_(resident_ids))
    )
    resident_map = {r.id: r for r in res_result.all()}

    user_ids    = [r.user_id for r in resident_map.values()]
    user_result = await db.execute(
        select(UserModel.id, UserModel.phone, UserModel.full_name)
        .where(UserModel.id.in_(user_ids))
    )
    user_map = {u.id: u for u in user_result.all()}

    # Send personalized reminder to each unpaid warga
    sent_count = 0
    fail_count = 0

    for inv in unpaid:
        resident = resident_map.get(inv.resident_id)
        if not resident:
            continue
        user = user_map.get(resident.user_id)
        if not user or not user.phone:
            fail_count += 1
            continue

        warga_name = resident.full_name or user.full_name
        amount_fmt = f"Rp {inv.amount_idr:,.0f}".replace(",", ".")
        status_tag = "⚠️ TERLAMBAT" if inv.status == "overdue" else ""

        message = (
            f"Assalamu'alaikum Bapak/Ibu *{warga_name}*,\n\n"
            f"{'⚠️ Tagihan Anda sudah melewati jatuh tempo!'+chr(10)+chr(10) if status_tag else ''}"
            f"Mengingatkan bahwa iuran RT berikut belum dibayarkan:\n\n"
            f"🏘️ *{rt_name}*\n"
            f"📅 Periode: *{period_str}*\n"
            f"💰 Nominal: *{amount_fmt}*\n\n"
            f"Mohon segera melakukan pembayaran.\n"
            f"Terima kasih atas kerjasamanya. 🙏\n\n"
            f"_Pesan otomatis dari RTMudah_"
        )

        result = await SendWABlast(
            notif_log_repo=PgNotificationLogRepository(db)
        ).execute(
            rt_group_id   = rt_group_id,
            sent_by       = UUID(current_user["user_id"]),
            phone_numbers = [user.phone],
            message       = message,
            trigger_type  = TriggerType.INVOICE_REMINDER,
            trigger_id    = inv.id,
        )

        if result["status"] == "sent":
            sent_count += 1
        else:
            fail_count += 1

    return {
        "sent":    sent_count,
        "failed":  fail_count,
        "total":   len(unpaid),
        "period":  period_str,
        "message": f"Reminder terkirim ke {sent_count} dari {len(unpaid)} warga untuk {period_str}",
    }


@router.post("/komunikasi/wa/broadcast/{rt_group_id}", tags=["WhatsApp"])
async def send_wa_broadcast(
    rt_group_id:  UUID,
    body:         SendWABlastRequest,
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    """
    Broadcast announcement to ALL active warga — Option A SaaS model.
    Auto-fetches all phone numbers. Ketua RT just writes the message.
    """
    rt      = await _get_rt(rt_group_id, db)
    rt_name = f"RT {rt.rt_number}/RW {rt.rw_number} — {rt.kelurahan}"
    phones  = await _get_active_phones(rt_group_id, db)

    if not phones:
        return {
            "sent": 0, "failed": 0, "total": 0,
            "message": "Tidak ada warga aktif dengan nomor HP terdaftar",
        }

    result = await SendWABlast(
        notif_log_repo=PgNotificationLogRepository(db)
    ).execute(
        rt_group_id   = rt_group_id,
        sent_by       = UUID(current_user["user_id"]),
        phone_numbers = phones,
        message       = body.message,
        trigger_type  = TriggerType.ANNOUNCEMENT,
    )

    sent   = result["sent_to"] - result["failed"]
    failed = result["failed"]

    return {
        "sent":    sent,
        "failed":  failed,
        "total":   result["sent_to"],
        "message": f"Broadcast terkirim ke {sent} dari {result['sent_to']} warga",
    }


@router.post("/komunikasi/wa/blast", tags=["WhatsApp"])
async def send_wa_blast(
    body:         SendWABlastRequest,
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    """
    Manual WA blast — admin provides phone numbers directly.
    Used for custom one-off messages.
    """
    result = await SendWABlast(
        notif_log_repo=PgNotificationLogRepository(db)
    ).execute(
        rt_group_id   = body.rt_group_id,
        sent_by       = UUID(current_user["user_id"]),
        phone_numbers = body.phone_numbers,
        message       = body.message,
        trigger_type  = TriggerType.MANUAL_BLAST,
    )
    return result


@router.get("/komunikasi/notification-logs/{rt_group_id}", tags=["WhatsApp"])
async def get_notification_logs(
    rt_group_id:  UUID,
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    """
    WA blast history — immutable audit trail.
    Answers: "Did the reminder go out? When? To how many?"
    """
    logs = await PgNotificationLogRepository(db).get_by_rt_group(rt_group_id)
    return [
        {
            "id":              str(l.id),
            "trigger_type":    l.trigger_type,
            "notif_type":      l.notif_type,
            "recipient_count": l.recipient_count,
            "message_preview": l.message_preview,
            "status":          l.status,
            "failed_count":    l.failed_count,
            "sent_at":         l.sent_at.isoformat() if l.sent_at else None,
        }
        for l in logs
    ]

