# warga/presentation/api/v1/routes.py
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.exceptions import EntityNotFoundError
from app.modules.warga.application.schemas import AddAnggotaRequest, RegisterResidentRequest
from app.modules.warga.application.use_cases.register_resident import \
    RegisterResident
from app.modules.warga.application.use_cases.verify_resident import \
    VerifyResident
from app.modules.warga.infrastructure.models import ResidentModel
from app.modules.warga.infrastructure.repository import PgResidentRepository
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

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



@router.get("/warga/my-profile", tags=["Warga"])
async def get_my_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the resident profile for the logged-in warga."""
    repo     = PgResidentRepository(db)
    resident = await repo.get_by_user_id(UUID(current_user["user_id"]))
    if not resident:
        return {}
    return {
        "nik":             resident.nik,
        "no_kk":           resident.no_kk,
        "tanggal_lahir":   resident.tanggal_lahir.isoformat() if resident.tanggal_lahir else None,
        "tempat_lahir":    resident.tempat_lahir,
        "jenis_kelamin":   resident.jenis_kelamin.value if resident.jenis_kelamin else None,
        "agama":           resident.agama.value          if resident.agama         else None,
        "pekerjaan":       resident.pekerjaan.value      if resident.pekerjaan     else None,
        "status_kawin":    resident.status_kawin.value   if resident.status_kawin  else None,
        "status_tinggal":  resident.status_tinggal.value if resident.status_tinggal else None,
        "status_keluarga": resident.status_keluarga.value if resident.status_keluarga else None,
        "kepala_keluarga":     resident.kepala_keluarga,
        "alamat_ktp":          resident.alamat_ktp,
        "pendidikan_terakhir": resident.pendidikan_terakhir.value if resident.pendidikan_terakhir else None,
        "kewarganegaraan":     resident.kewarganegaraan.value if resident.kewarganegaraan else None,
        "hubungan_dengan_kk":  resident.hubungan_dengan_kk.value if resident.hubungan_dengan_kk else None,
    }

@router.get("/warga/user/{user_id}/profile", tags=["Warga"])
async def get_warga_full_profile(
    user_id:      UUID,
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    """
    Returns full resident profile for a given user_id.
    Used by clicking a warga row in Data Warga page.
    """
    repo     = PgResidentRepository(db)
    resident = await repo.get_by_user_id(user_id)
    if not resident:
        raise HTTPException(status_code=404, detail="Data warga tidak ditemukan")

    result = _resident_detail_from_entity(resident)

    # If they have a no_kk, fetch all KK members too
    if resident.no_kk:
        from sqlalchemy import select as sa_select
        kk_result = await db.execute(
            sa_select(ResidentModel)
            .where(
                ResidentModel.no_kk == resident.no_kk,
                ResidentModel.id != resident.id,
            )
            .order_by(ResidentModel.kepala_keluarga.desc())
        )
        other_members = kk_result.scalars().all()
        result["kk_members"] = [_resident_detail(r) for r in other_members]
    else:
        result["kk_members"] = []

    return result


def _resident_detail(row) -> dict:
    """Convert ResidentModel row to detail dict."""
    return {
        "id":                  str(row.id),
        "full_name":           row.full_name,
        "nik":                 row.nik,
        "no_kk":               row.no_kk,
        "tanggal_lahir":       row.tanggal_lahir.isoformat() if row.tanggal_lahir else None,
        "tempat_lahir":        row.tempat_lahir,
        "jenis_kelamin":       row.jenis_kelamin,
        "agama":               row.agama,
        "pekerjaan":           row.pekerjaan,
        "status_kawin":        row.status_kawin,
        "status_tinggal":      row.status_tinggal,
        "status_keluarga":     row.status_keluarga,
        "hubungan_dengan_kk":  row.hubungan_dengan_kk,
        "kepala_keluarga":     row.kepala_keluarga,
        "pendidikan_terakhir": row.pendidikan_terakhir,
        "kewarganegaraan":     row.kewarganegaraan,
        "alamat_ktp":          row.alamat_ktp,
        "phone":               row.phone,
        "block_unit":          f"Blok {row.block} No. {row.unit_number}" if row.block else None,
    }


def _resident_detail_from_entity(r) -> dict:
    """Convert Resident entity to detail dict."""
    return {
        "id":                  str(r.id),
        "full_name":           r.full_name,
        "nik":                 r.nik,
        "no_kk":               r.no_kk,
        "tanggal_lahir":       r.tanggal_lahir.isoformat() if r.tanggal_lahir else None,
        "tempat_lahir":        r.tempat_lahir,
        "jenis_kelamin":       r.jenis_kelamin.value if r.jenis_kelamin else None,
        "agama":               r.agama.value if r.agama else None,
        "pekerjaan":           r.pekerjaan.value if r.pekerjaan else None,
        "status_kawin":        r.status_kawin.value if r.status_kawin else None,
        "status_tinggal":      r.status_tinggal.value if r.status_tinggal else None,
        "status_keluarga":     r.status_keluarga.value if r.status_keluarga else None,
        "hubungan_dengan_kk":  r.hubungan_dengan_kk.value if r.hubungan_dengan_kk else None,
        "kepala_keluarga":     r.kepala_keluarga,
        "pendidikan_terakhir": r.pendidikan_terakhir.value if r.pendidikan_terakhir else None,
        "kewarganegaraan":     r.kewarganegaraan.value if r.kewarganegaraan else "WNI",
        "alamat_ktp":          r.alamat_ktp,
        "phone":               r.phone,
        "block_unit":          r.block_unit_display,
    }

@router.get("/warga/kk/{no_kk}", tags=["Warga"])
async def get_kk_members(
    no_kk:        str,
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    """
    Returns all residents sharing the same no_kk (Kartu Keluarga).
    Used by the KK modal in Data Warga page.
    """
    from app.modules.iam.infrastructure.models import UserModel
    from sqlalchemy import select as sa_select

    result = await db.execute(
        sa_select(ResidentModel)
        .where(ResidentModel.no_kk == no_kk)
        .order_by(ResidentModel.kepala_keluarga.desc())
    )
    residents = result.scalars().all()

    if not residents:
        return []

    repo = PgResidentRepository(db)
    return [_resident_detail(r) for r in residents]

@router.get("/warga/my-keluarga", tags=["Warga"])
async def get_my_keluarga(
    current_user: dict = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Returns all anggota KK added by the logged-in warga."""
    from sqlalchemy import select as sa_select
    repo    = PgResidentRepository(db)
    user_id = UUID(current_user["user_id"])
    me      = await repo.get_by_user_id(user_id)

    if not me:
        return {"kepala": None, "anggota": [], "no_kk": None}

    result = await db.execute(
        sa_select(ResidentModel)
        .where(
            ResidentModel.added_by_user_id == user_id,
            ResidentModel.is_anggota_kk   == True,
        )
        .order_by(ResidentModel.created_at)
    )
    anggota_rows = result.scalars().all()

    return {
        "no_kk":   me.no_kk,
        "kepala":  _resident_detail_from_entity(me),
        "anggota": [_resident_detail(r) for r in anggota_rows],
    }


@router.post("/warga/anggota", status_code=201, tags=["Warga"])
async def add_anggota_kk(
    body:         AddAnggotaRequest,
    current_user: dict = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Warga (Kepala KK) adds a family member without a user account."""
    import uuid as _uuid
    from datetime import date as _date, datetime, timezone

    repo    = PgResidentRepository(db)
    user_id = UUID(current_user["user_id"])
    me      = await repo.get_by_user_id(user_id)

    if not me:
        raise HTTPException(status_code=403,
            detail="Anda belum terdaftar sebagai warga RT")

    if not me.no_kk:
        raise HTTPException(status_code=422,
            detail="Lengkapi No. KK di Profil Saya terlebih dahulu "
                   "sebelum menambah anggota keluarga")

    tanggal_lahir = None
    if body.tanggal_lahir:
        try:
            tanggal_lahir = _date.fromisoformat(body.tanggal_lahir)
        except ValueError:
            pass

    now = datetime.now(timezone.utc)
    anggota_row = ResidentModel(
        id               = _uuid.uuid4(),
        rt_group_id      = me.rt_group_id,
        user_id          = None,
        full_name        = body.full_name.strip(),
        phone            = body.phone or "",
        no_kk            = me.no_kk,
        nik              = body.nik,
        tanggal_lahir    = tanggal_lahir,
        tempat_lahir     = body.tempat_lahir,
        jenis_kelamin    = body.jenis_kelamin,
        agama            = body.agama,
        pekerjaan        = body.pekerjaan,
        status_kawin     = body.status_kawin,
        status_tinggal   = body.status_tinggal or "TETAP",
        hubungan_dengan_kk  = body.hubungan_dengan_kk,
        pendidikan_terakhir = body.pendidikan_terakhir,
        kewarganegaraan  = body.kewarganegaraan or "WNI",
        kepala_keluarga  = False,
        is_anggota_kk    = True,
        added_by_user_id = user_id,
        status           = "active",
        ownership_type   = me.ownership_type.value if me.ownership_type else "owner",
        street           = me.street or "",
        rt_number        = me.rt_number or "",
        rw_number        = me.rw_number or "",
        kelurahan        = me.kelurahan or "",
        kecamatan        = me.kecamatan or "",
        kota             = me.kota or "",
        block            = me.block or "",
        unit_number      = me.unit_number or "",
        member_count     = 1,
        created_at       = now,
        updated_at       = now,
    )
    db.add(anggota_row)
    await db.flush()
    await db.commit()
    await db.refresh(anggota_row)

    return {
        "id":        str(anggota_row.id),
        "full_name": anggota_row.full_name,
        "no_kk":     anggota_row.no_kk,
        "hubungan":  anggota_row.hubungan_dengan_kk,
        "message":   f"{body.full_name} berhasil ditambahkan sebagai anggota KK",
    }


@router.delete("/warga/anggota/{anggota_id}", tags=["Warga"])
async def delete_anggota_kk(
    anggota_id:   UUID,
    current_user: dict = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Kepala KK removes a family member they added."""
    from sqlalchemy import select as sa_select
    user_id = UUID(current_user["user_id"])

    result = await db.execute(
        sa_select(ResidentModel)
        .where(
            ResidentModel.id               == anggota_id,
            ResidentModel.added_by_user_id == user_id,
            ResidentModel.is_anggota_kk    == True,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404,
            detail="Anggota tidak ditemukan atau bukan milik Anda")

    await db.delete(row)
    await db.commit()
    return {"message": f"{row.full_name} berhasil dihapus dari daftar KK"}


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