from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.exceptions import EntityNotFoundError
from app.modules.warga.application.schemas import RegisterResidentRequest
from app.modules.warga.application.use_cases.register_resident import RegisterResident
from app.modules.warga.application.use_cases.verify_resident import VerifyResident
from app.modules.warga.infrastructure.repository import PgResidentRepository

router = APIRouter()


@router.post("/warga", status_code=201, tags=["Warga"])
async def register_resident(
    body: RegisterResidentRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    resident = await RegisterResident(PgResidentRepository(db)).execute(
        rt_group_id=body.rt_group_id,
        user_id=UUID(current_user["user_id"]),
        full_name=body.full_name, phone=body.phone,
        street=body.street, rt_number=body.rt_number,
        rw_number=body.rw_number, kelurahan=body.kelurahan,
        kecamatan=body.kecamatan, kota=body.kota,
        block=body.block, unit_number=body.unit_number,
        ownership_type=body.ownership_type, member_count=body.member_count,
    )
    return {"id": str(resident.id), "status": resident.status}


@router.get("/warga/rt/{rt_group_id}", tags=["Warga"])
async def list_residents(
    rt_group_id: UUID,
    status_filter: str = None,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = PgResidentRepository(db)
    from app.modules.warga.domain.entities import ResidentStatus
    status_enum = ResidentStatus(status_filter) if status_filter else None
    residents = await repo.get_by_rt_group(rt_group_id, status=status_enum)
    return [{"id": str(r.id), "full_name": r.full_name, "phone": r.phone,
             "block_unit": r.block_unit_display, "status": r.status,
             "member_count": r.member_count} for r in residents]


@router.get("/warga/{resident_id}", tags=["Warga"])
async def get_resident(
    resident_id: UUID,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    resident = await PgResidentRepository(db).get_by_id(resident_id)
    if not resident:
        raise HTTPException(status_code=404, detail="Warga tidak ditemukan")
    return {"id": str(resident.id), "full_name": resident.full_name,
            "phone": resident.phone, "block_unit": resident.block_unit_display,
            "status": resident.status, "kk_file_url": resident.kk_file_url,
            "ktp_file_url": resident.ktp_file_url}


@router.patch("/warga/{resident_id}/verify", tags=["Warga"])
async def verify_resident(
    resident_id: UUID,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        resident = await VerifyResident(PgResidentRepository(db)).execute(
            resident_id=resident_id, verified_by=UUID(current_user["user_id"])
        )
        return {"id": str(resident.id), "status": resident.status}
    except EntityNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
