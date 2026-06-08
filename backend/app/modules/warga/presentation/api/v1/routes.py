# warga/presentation/api/v1/routes.py
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.exceptions import EntityNotFoundError
from app.modules.warga.application.schemas import (AddAnggotaRequest,
                                                   AdminUpdateResidentRequest,
                                                   ChangeLogEntry,
                                                   RegisterResidentRequest)
from app.modules.warga.application.use_cases.register_resident import \
    RegisterResident
from app.modules.warga.application.use_cases.verify_resident import \
    VerifyResident
from app.modules.warga.infrastructure.models import ResidentModel
from app.modules.warga.infrastructure.repository import PgResidentRepository
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
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
    from datetime import date as _date
    from datetime import datetime, timezone

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


@router.get("/warga/export/{rt_group_id}", tags=["Warga"])
async def export_warga_data(
    rt_group_id:  UUID,
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    """Returns full resident data for Excel export."""
    from sqlalchemy import select as sa_select

    result = await db.execute(
        sa_select(ResidentModel)
        .where(
            ResidentModel.rt_group_id == rt_group_id,
            ResidentModel.status      == "active",
        )
        .order_by(
            ResidentModel.no_kk.nullslast(),
            ResidentModel.kepala_keluarga.desc(),
            ResidentModel.full_name,
        )
    )
    residents = result.scalars().all()

    return [
        {
            "id":                  str(r.id),
            "full_name":           r.full_name,
            "nik":                 r.nik,
            "no_kk":               r.no_kk,
            "tanggal_lahir":       r.tanggal_lahir.isoformat() if r.tanggal_lahir else None,
            "tempat_lahir":        r.tempat_lahir,
            "jenis_kelamin":       r.jenis_kelamin,
            "agama":               r.agama,
            "pekerjaan":           r.pekerjaan,
            "status_kawin":        r.status_kawin,
            "status_tinggal":      r.status_tinggal,
            "hubungan_dengan_kk":  r.hubungan_dengan_kk,
            "kepala_keluarga":     r.kepala_keluarga,
            "pendidikan_terakhir": r.pendidikan_terakhir,
            "kewarganegaraan":     r.kewarganegaraan or "WNI",
            "alamat_ktp":          r.alamat_ktp,
            "phone":               r.phone,
            "block_unit":          f"Blok {r.block} No. {r.unit_number}" if r.block else None,
            "is_anggota_kk":       r.is_anggota_kk,
        }
        for r in residents
    ]


@router.get("/warga/statistik/{rt_group_id}", tags=["Warga"])
async def get_statistik_demografis(
    rt_group_id:  UUID,
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    from datetime import date

    from sqlalchemy import select as sa_select

    result = await db.execute(
        sa_select(ResidentModel).where(
            ResidentModel.rt_group_id == rt_group_id,
            ResidentModel.status      == "active",
        )
    )
    all_residents = result.scalars().all()
    total = len(all_residents)

    if total == 0:
        return {"total_warga": 0, "total_kk": 0, "kepala_keluarga": 0,
                "jenis_kelamin": [], "agama": [], "pendidikan": [],
                "pekerjaan": [], "status_tinggal": [], "usia": [],
                "kewarganegaraan": []}

    def count_by(field):
        counts = {}
        for r in all_residents:
            val = getattr(r, field, None) or "Tidak Diisi"
            counts[val] = counts.get(val, 0) + 1
        return [{"name": k, "value": v}
                for k, v in sorted(counts.items(), key=lambda x: -x[1])]

    today = date.today()
    usia_buckets = {"Balita (0-4)": 0, "Anak (5-11)": 0,
                    "Remaja (12-18)": 0, "Dewasa (19-59)": 0,
                    "Lansia (60+)": 0, "Tidak Diisi": 0}
    for r in all_residents:
        if not r.tanggal_lahir:
            usia_buckets["Tidak Diisi"] += 1
            continue
        age = (today - r.tanggal_lahir).days // 365
        if age <= 4:    usia_buckets["Balita (0-4)"] += 1
        elif age <= 11: usia_buckets["Anak (5-11)"] += 1
        elif age <= 18: usia_buckets["Remaja (12-18)"] += 1
        elif age <= 59: usia_buckets["Dewasa (19-59)"] += 1
        else:           usia_buckets["Lansia (60+)"] += 1

    PENDIDIKAN_ORDER = ["TIDAK SEKOLAH","BELUM SEKOLAH","SD","SMP","SMA",
                        "SMK","D3","S1","S2","S3","LAINNYA","Tidak Diisi"]
    pend_counts = {}
    for r in all_residents:
        val = r.pendidikan_terakhir or "Tidak Diisi"
        pend_counts[val] = pend_counts.get(val, 0) + 1

    return {
        "total_warga":     total,
        "total_kk":        len({r.no_kk for r in all_residents if r.no_kk}),
        "kepala_keluarga": sum(1 for r in all_residents if r.kepala_keluarga),
        "jenis_kelamin":   count_by("jenis_kelamin"),
        "agama":           count_by("agama"),
        "pendidikan":      [{"name": k, "value": pend_counts[k]}
                            for k in PENDIDIKAN_ORDER if k in pend_counts],
        "pekerjaan":       count_by("pekerjaan"),
        "status_tinggal":  count_by("status_tinggal"),
        "usia":            [{"name": k, "value": v}
                            for k, v in usia_buckets.items() if v > 0],
        "kewarganegaraan": count_by("kewarganegaraan"),
    }


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
    

FIELD_LABELS: dict[str, str] = {
    "full_name":           "Nama Lengkap",
    "phone":               "Nomor HP",
    "nik":                 "NIK",
    "no_kk":               "Nomor KK",
    "tanggal_lahir":       "Tanggal Lahir",
    "tempat_lahir":        "Tempat Lahir",
    "jenis_kelamin":       "Jenis Kelamin",
    "agama":               "Agama",
    "pekerjaan":           "Pekerjaan",
    "status_kawin":        "Status Perkawinan",
    "status_tinggal":      "Status Tinggal",
    "status_keluarga":     "Status dalam Keluarga",
    "kepala_keluarga":     "Kepala Keluarga",
    "alamat_ktp":          "Alamat KTP",
    "pendidikan_terakhir": "Pendidikan Terakhir",
    "kewarganegaraan":     "Kewarganegaraan",
    "hubungan_dengan_kk":  "Hubungan dengan KK",
}


# ═══════════════════════════════════════════════════════════════════════════════
# PATCH /warga/{resident_id}/admin-update
# Ketua RT full-authority profile update — immediate, no approval needed
# ═══════════════════════════════════════════════════════════════════════════════

@router.patch("/warga/{resident_id}/admin-update", tags=["Warga"])
async def admin_update_resident(
    resident_id:  UUID,
    body:         AdminUpdateResidentRequest,
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    """
    Ketua RT updates any warga profile field immediately.
    Every changed field is logged to resident_change_logs with
    old value, new value, who changed it, and when.

    Only fields explicitly provided in the request body are updated.
    Fields set to None in the JSON are ignored (partial update).
    Fields explicitly sent as null overwrite to null — use with care.
    """
    import uuid as _uuid
    from datetime import datetime, timezone

    from app.modules.iam.infrastructure.models import UserModel
    from app.modules.warga.domain.entities import (Agama, HubunganDenganKK,
                                                   JenisKelamin,
                                                   Kewarganegaraan, Pekerjaan,
                                                   PendidikanTerakhir,
                                                   StatusKawin, StatusKeluarga,
                                                   StatusTinggal)
    from sqlalchemy import insert as sa_insert
    from sqlalchemy import select as sa_select

    repo     = PgResidentRepository(db)
    resident = await repo.get_by_id(resident_id)
    if not resident:
        raise HTTPException(status_code=404, detail="Warga tidak ditemukan")

    # Verify Ketua RT is managing this resident's RT group
    from app.modules.iam.infrastructure.models import RTGroupModel
    rt_result = await db.execute(
        sa_select(RTGroupModel).where(
            RTGroupModel.admin_user_id == _uuid.UUID(current_user["user_id"])
        )
    )
    rt_group = rt_result.scalar_one_or_none()
    if not rt_group or rt_group.id != resident.rt_group_id:
        raise HTTPException(
            status_code=403,
            detail="Anda tidak memiliki akses ke data warga ini"
        )

    # Fetch changer's name for the log
    changer = await db.get(UserModel, _uuid.UUID(current_user["user_id"]))
    changer_name = changer.full_name if changer else "Unknown"

    # ── Build diff — only process fields that were explicitly provided ────
    # Use model_fields_set to detect which fields were in the request body.
    # This correctly distinguishes "not sent" from "sent as null".
    provided = body.model_fields_set
    now      = datetime.now(timezone.utc)
    logs     = []

    def get_old_value(field: str) -> str | None:
        """Get current string representation of a field for the log."""
        val = getattr(resident, field, None)
        if val is None:
            return None
        if hasattr(val, "value"):   # enum
            return val.value
        return str(val)

    def coerce_enum(field: str, raw: str | None):
        """Safely coerce a string to the correct domain enum."""
        if raw is None:
            return None
        enum_map = {
            "jenis_kelamin":       JenisKelamin,
            "agama":               Agama,
            "pekerjaan":           Pekerjaan,
            "status_kawin":        StatusKawin,
            "status_tinggal":      StatusTinggal,
            "status_keluarga":     StatusKeluarga,
            "pendidikan_terakhir": PendidikanTerakhir,
            "kewarganegaraan":     Kewarganegaraan,
            "hubungan_dengan_kk":  HubunganDenganKK,
        }
        if field in enum_map:
            try:
                return enum_map[field](raw)
            except ValueError:
                raise HTTPException(
                    status_code=422,
                    detail=f"Nilai '{raw}' tidak valid untuk field {field}"
                )
        return raw

    # Build kwargs for update_profile() + collect log entries
    update_kwargs: dict = {}

    for field in FIELD_LABELS:
        if field not in provided:
            continue   # not in request — skip

        raw_new   = getattr(body, field, None)
        old_value = get_old_value(field)

        # Coerce enum fields
        coerced = coerce_enum(field, raw_new)
        update_kwargs[field] = coerced

        # Determine new_value string for log
        if coerced is None:
            new_value = None
        elif hasattr(coerced, "value"):
            new_value = coerced.value
        elif isinstance(coerced, bool):
            new_value = "Ya" if coerced else "Tidak"
        else:
            new_value = str(coerced)

        # Only log if value actually changed
        old_str = "Ya" if old_value == "True" else ("Tidak" if old_value == "False" else old_value)
        if old_str != new_value:
            logs.append({
                "id":             _uuid.uuid4(),
                "resident_id":    resident_id,
                "rt_group_id":    resident.rt_group_id,
                "changed_by":     _uuid.UUID(current_user["user_id"]),
                "changed_by_role": current_user.get("role", "ketua_rt"),
                "changed_by_name": changer_name,
                "resident_name":  resident.full_name,
                "field_name":     field,
                "field_label":    FIELD_LABELS[field],
                "old_value":      old_str,
                "new_value":      new_value,
                "changed_at":     now,
            })

    if not update_kwargs:
        return {"message": "Tidak ada perubahan", "changed_fields": 0}

    # ── Apply update via domain entity ────────────────────────────────────
    resident.update_profile(**update_kwargs)
    await repo.save(resident)

    # ── Write audit log entries ───────────────────────────────────────────
    # Direct insert — not through repository pattern (pure infrastructure)
    if logs:
        from app.modules.warga.infrastructure.models import \
            ResidentChangeLogModel
        for log in logs:
            db.add(ResidentChangeLogModel(**log))

    await db.commit()

    return {
        "message":        f"Data {resident.full_name} berhasil diperbarui",
        "changed_fields": len(logs),
        "changes":        [
            {
                "field":     l["field_name"],
                "label":     l["field_label"],
                "old_value": l["old_value"],
                "new_value": l["new_value"],
            }
            for l in logs
        ],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /warga/{resident_id}/change-log
# Returns audit trail for a specific resident
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/warga/{resident_id}/change-log", response_model=list[ChangeLogEntry], tags=["Warga"])
async def get_resident_change_log(
    resident_id:  UUID,
    limit:        int  = 20,
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    """
    Returns last N changes to a resident profile.
    Sorted newest-first. Used by the change log tab in KKDetailModal.
    """
    from app.modules.warga.infrastructure.models import ResidentChangeLogModel
    from sqlalchemy import desc as sa_desc
    from sqlalchemy import select as sa_select

    result = await db.execute(
        sa_select(ResidentChangeLogModel)
        .where(ResidentChangeLogModel.resident_id == resident_id)
        .order_by(sa_desc(ResidentChangeLogModel.changed_at))
        .limit(limit)
    )
    rows = result.scalars().all()

    return [
        {
            "id":              str(r.id),
            "field_name":      r.field_name,
            "field_label":     r.field_label,
            "old_value":       r.old_value,
            "new_value":       r.new_value,
            "changed_by":      str(r.changed_by),
            "changed_by_name": r.changed_by_name,
            "changed_by_role": r.changed_by_role,
            "resident_name":   r.resident_name,
            "changed_at":      r.changed_at.isoformat(),
        }
        for r in rows
    ]