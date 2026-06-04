"""
IAM routes — all endpoints for auth, users, and RT groups.
IntegrityError caught at every write endpoint to prevent 500s
from DB-level unique constraint violations.
"""
import re as _re
from datetime import date as _date
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.exceptions import (DuplicateEntityError, EntityNotFoundError,
                                 UnauthorizedError, ValidationError)
from app.modules.iam.application.schemas import (CreateRTGroupRequest,
                                                 LoginRequest,
                                                 RegisterUserRequest)
from app.modules.iam.application.use_cases.assign_role import AssignRole
from app.modules.iam.application.use_cases.create_rt_group import CreateRTGroup
from app.modules.iam.application.use_cases.login_user import LoginUser
from app.modules.iam.application.use_cases.register_user import RegisterUser
from app.modules.iam.application.use_cases.verify_user import VerifyUser
from app.modules.iam.infrastructure.repository import (PgRTGroupRepository,
                                                       PgUserRepository)
from app.modules.warga.infrastructure.repository import PgResidentRepository
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

class UpdateProfileRequest(BaseModel):
    # Core — users table
    full_name: str
    phone:     str

    # Rich profile — residents table (all optional)
    nik:             Optional[str] = None
    no_kk:           Optional[str] = None
    tanggal_lahir:   Optional[str] = None   # ISO date string "YYYY-MM-DD"
    tempat_lahir:    Optional[str] = None
    jenis_kelamin:   Optional[str] = None
    agama:           Optional[str] = None
    pekerjaan:       Optional[str] = None
    status_kawin:    Optional[str] = None
    status_tinggal:  Optional[str] = None
    status_keluarga: Optional[str] = None
    kepala_keluarga: Optional[bool] = None
    alamat_ktp:          Optional[str] = None
    pendidikan_terakhir: Optional[str] = None
    kewarganegaraan:     Optional[str] = None
    hubungan_dengan_kk:  Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Nama lengkap minimal 3 karakter")
        if len(v) > 100:
            raise ValueError("Nama lengkap maksimal 100 karakter")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip().replace("-", "").replace(" ", "")
        if not _re.match(r"^(\\+62|62|0)[0-9]{8,13}$", v):
            raise ValueError("Format nomor HP tidak valid (contoh: 081234567890)")
        if v.startswith("0"):
            v = "62" + v[1:]
        elif v.startswith("+"):
            v = v[1:]
        return v

    @field_validator("nik")
    @classmethod
    def validate_nik(cls, v: Optional[str]) -> Optional[str]:
        if v is None: return v
        v = v.strip()
        if not v.isdigit() or len(v) != 16:
            raise ValueError("NIK harus 16 digit angka")
        return v

    @field_validator("no_kk")
    @classmethod
    def validate_no_kk(cls, v: Optional[str]) -> Optional[str]:
        if v is None: return v
        v = v.strip()
        if not v.isdigit() or len(v) != 16:
            raise ValueError("Nomor KK harus 16 digit angka")
        return v


def _integrity_message(e: IntegrityError) -> str:
    """
    Converts a PostgreSQL UniqueViolationError into a human-readable
    Indonesian message by inspecting the constraint name.
    """
    msg = str(e.orig).lower()
    if "uq_users_phone" in msg:
        return "Nomor HP sudah terdaftar"
    if "uq_users_email" in msg or "users_email_key" in msg:
        return "Email sudah terdaftar"
    if "uq_residents_rt_user" in msg:
        return "Anda sudah terdaftar sebagai warga di RT ini"
    if "uq_invoices_resident_period" in msg:
        return "Tagihan untuk periode ini sudah ada"
    if "uq_rt_groups_location" in msg:
        return "RT/RW di lokasi ini sudah terdaftar"
    return "Data duplikat — periksa kembali input Anda"


# ── Auth ──────────────────────────────────────────────────────────

@router.post("/auth/register", status_code=status.HTTP_201_CREATED, tags=["Auth"])
async def register(
    body: RegisterUserRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await RegisterUser(PgUserRepository(db)).execute(
            email=body.email,
            phone=body.phone,
            password=body.password,
            full_name=body.full_name,
            rt_group_id=body.rt_group_id,
        )
        return {"id": str(user.id), "email": user.email, "status": user.status}
    except DuplicateEntityError as e:
        raise HTTPException(status_code=409, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.message)
    except IntegrityError as e:
        # DB-level unique constraint violations not caught by app logic
        # e.g. uq_users_phone when same phone is used twice
        raise HTTPException(status_code=409, detail=_integrity_message(e))


@router.post("/auth/login", tags=["Auth"])
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await LoginUser(PgUserRepository(db)).execute(
            email=body.email,
            password=body.password,
        )
        return result
    except UnauthorizedError as e:
        raise HTTPException(status_code=401, detail=e.message)


# ── Users ─────────────────────────────────────────────────────────

@router.get("/users/me", tags=["Users"])
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await PgUserRepository(db).get_by_id(UUID(current_user["user_id"]))
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    return {
        "id":          str(user.id),
        "email":       user.email,
        "full_name":   user.full_name,
        "role":        user.role,
        "status":      user.status,
        "rt_group_id": str(user.rt_group_id) if user.rt_group_id else None,
    }

@router.patch("/users/me/profile", tags=["Users"])
async def update_my_profile(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update own profile — full_name + phone in users table,
    rich fields (NIK, tanggal_lahir, agama, etc.) in residents table.
    """
    from app.modules.warga.domain.entities import (Agama, HubunganDenganKK,
                                                   JenisKelamin, Kewarganegaraan,
                                                   PendidikanTerakhir, Pekerjaan,
                                                   StatusKawin, StatusKeluarga,
                                                   StatusTinggal)
    from app.modules.warga.infrastructure.repository import \
        PgResidentRepository

    user_id = UUID(current_user["user_id"])

    # ── 1. Update users table ─────────────────────────────────────
    repo = PgUserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    if body.phone != user.phone:
        existing = await repo.get_by_phone(body.phone)
        if existing and existing.id != user.id:
            raise HTTPException(
                status_code=409,
                detail="Nomor HP sudah digunakan akun lain"
            )

    user.full_name = body.full_name.strip()
    user.phone     = body.phone
    saved_user     = await repo.save(user)

    # ── 2. Update residents table (if warga has a resident record) ─
    resident_repo = PgResidentRepository(db)
    resident      = await resident_repo.get_by_user_id(user_id)

    if resident:
        tanggal_lahir = None
        if body.tanggal_lahir:
            try:
                tanggal_lahir = _date.fromisoformat(body.tanggal_lahir)
            except ValueError:
                pass

        resident.update_profile(
            full_name       = body.full_name.strip(),
            phone           = body.phone,
            nik             = body.nik,
            no_kk           = body.no_kk,
            tanggal_lahir   = tanggal_lahir,
            tempat_lahir    = body.tempat_lahir,
            jenis_kelamin   = JenisKelamin(body.jenis_kelamin)   if body.jenis_kelamin   else None,
            agama           = Agama(body.agama)                   if body.agama           else None,
            pekerjaan       = Pekerjaan(body.pekerjaan)           if body.pekerjaan       else None,
            status_kawin    = StatusKawin(body.status_kawin)      if body.status_kawin    else None,
            status_tinggal  = StatusTinggal(body.status_tinggal)  if body.status_tinggal  else None,
            status_keluarga = StatusKeluarga(body.status_keluarga)if body.status_keluarga else None,
            kepala_keluarga = body.kepala_keluarga,
            alamat_ktp           = body.alamat_ktp,
            pendidikan_terakhir  = PendidikanTerakhir(body.pendidikan_terakhir) if body.pendidikan_terakhir else None,
            kewarganegaraan      = Kewarganegaraan(body.kewarganegaraan)        if body.kewarganegaraan     else None,
            hubungan_dengan_kk   = HubunganDenganKK(body.hubungan_dengan_kk)   if body.hubungan_dengan_kk  else None,
        )
        await resident_repo.save(resident)

    return {
        "id":        str(saved_user.id),
        "email":     saved_user.email,
        "full_name": saved_user.full_name,
        "phone":     saved_user.phone,
        "role":      saved_user.role,
        "status":    saved_user.status,
        "message":   "Profil berhasil diperbarui",
    }

@router.patch("/users/{user_id}/verify", tags=["Users"])
async def verify_user(
    user_id: UUID,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await VerifyUser(
            PgUserRepository(db),
            PgResidentRepository(db),      # ← NEW: auto-create resident
            PgRTGroupRepository(db),       # ← NEW: fetch RT for address
        ).execute(
            user_id=user_id,
            verified_by=UUID(current_user["user_id"]),
        )
        return {"id": str(user.id), "status": user.status}
    except EntityNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.patch("/users/{user_id}/role", tags=["Users"])
async def assign_role(
    user_id: UUID,
    role: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await AssignRole(PgUserRepository(db)).execute(
            target_user_id=user_id,
            role=role,
            assigned_by=UUID(current_user["user_id"]),
        )
        return {"id": str(user.id), "role": user.role}
    except (EntityNotFoundError, UnauthorizedError) as e:
        raise HTTPException(status_code=400, detail=e.message)
    
# ── add a DELETE/suspend endpoint ───────────────────────────────────────
@router.patch("/users/{user_id}/suspend", tags=["Users"])
async def suspend_user(
    user_id: UUID,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Suspend a user — admin only."""
    repo = PgUserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    user.status = "suspended"
    await repo.save(user)
    await db.commit()
    return {"id": str(user.id), "status": user.status}


# ── RT Groups ─────────────────────────────────────────────────────

class UpdateRTGroupRequest(BaseModel):
    rt_number:       Optional[str] = None
    rw_number:       Optional[str] = None
    kelurahan:       Optional[str] = None
    kecamatan:       Optional[str] = None
    kota:            Optional[str] = None
    provinsi:        Optional[str] = None
    monthly_fee_idr: Optional[int] = None

@router.get("/rt-groups", tags=["RT Groups"])
async def list_rt_groups(
    db: AsyncSession = Depends(get_db),
):
    """
    List all RT groups — public endpoint, no auth required.
    Used by the register page so warga can pick their RT.
    """
    rt_groups = await PgRTGroupRepository(db).get_all()
    return [
        {
            "id":           str(rt.id),
            "display_name": f"RT {rt.rt_number}/RW {rt.rw_number}, {rt.kelurahan}",
            "rt_number":    rt.rt_number,
            "rw_number":    rt.rw_number,
            "kelurahan":    rt.kelurahan,
            "kecamatan":    rt.kecamatan,
            "kota":         rt.kota,
        }
        for rt in rt_groups
    ]

@router.post("/rt-groups", status_code=201, tags=["RT Groups"])
async def create_rt_group(
    body: CreateRTGroupRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        rt = await CreateRTGroup(PgRTGroupRepository(db)).execute(
            rt_number=body.rt_number,
            rw_number=body.rw_number,
            kelurahan=body.kelurahan,
            kecamatan=body.kecamatan,
            kota=body.kota,
            provinsi=body.provinsi,
            admin_user_id=UUID(current_user["user_id"]),
            monthly_fee_idr=body.monthly_fee_idr,
        )
        return {"id": str(rt.id), "display_name": f"RT {rt.rt_number}/RW {rt.rw_number}, {rt.kelurahan}"}
    except IntegrityError as e:
        raise HTTPException(status_code=409, detail=_integrity_message(e))

@router.get("/rt-groups/{rt_group_id}/members", tags=["RT Groups"])
async def get_rt_members(
    rt_group_id: UUID,
    status:      Optional[str] = None,   # pending | active | suspended
    role:        Optional[str] = None,   # warga | admin_rt
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    List members of an RT group.
    Optional filters: ?status=pending, ?status=active, ?role=warga
    """
    users = await PgUserRepository(db).list_by_rt_group(rt_group_id)

    # Apply optional filters
    if status:
        users = [u for u in users if u.status == status]
    if role:
        users = [u for u in users if u.role == role]

    return [
        {
            "id":        str(u.id),
            "full_name": u.full_name,
            "email":     u.email,
            "phone":     getattr(u, "phone", None),
            "role":      u.role,
            "status":    u.status,
            "created_at": str(u.created_at) if hasattr(u, "created_at") else None,
        }
        for u in users
    ]


# ── GET /rt-groups/{rt_group_id} ─────────────────────────────────────────────
@router.get("/rt-groups/{rt_group_id}", tags=["RT Groups"])
async def get_rt_group(
    rt_group_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch a single RT group by ID.
    Any authenticated user can fetch their own RT group.
    """
    rt = await PgRTGroupRepository(db).get_by_id(rt_group_id)
    if not rt:
        raise HTTPException(status_code=404, detail="RT group tidak ditemukan")
    return {
        "id":              str(rt.id),
        "rt_number":       rt.rt_number,
        "rw_number":       rt.rw_number,
        "kelurahan":       rt.kelurahan,
        "kecamatan":       rt.kecamatan,
        "kota":            rt.kota,
        "provinsi":        rt.provinsi,
        "monthly_fee_idr": rt.monthly_fee_idr,
        "display_name":    f"RT {rt.rt_number}/RW {rt.rw_number}, {rt.kelurahan}",
    }


# ── PATCH /rt-groups/{rt_group_id} ───────────────────────────────────────────
@router.patch("/rt-groups/{rt_group_id}", tags=["RT Groups"])
async def update_rt_group(
    rt_group_id: UUID,
    body: UpdateRTGroupRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Update RT group details. Admin only.
    Partial update — only fields provided will be changed.
    """
    repo = PgRTGroupRepository(db)
    rt = await repo.get_by_id(rt_group_id)
    if not rt:
        raise HTTPException(status_code=404, detail="RT group tidak ditemukan")

    # Apply partial updates — only override fields that were sent
    if body.rt_number       is not None: rt.rt_number       = body.rt_number
    if body.rw_number       is not None: rt.rw_number       = body.rw_number
    if body.kelurahan       is not None: rt.kelurahan       = body.kelurahan
    if body.kecamatan       is not None: rt.kecamatan       = body.kecamatan
    if body.kota            is not None: rt.kota            = body.kota
    if body.provinsi        is not None: rt.provinsi        = body.provinsi
    if body.monthly_fee_idr is not None: rt.monthly_fee_idr = body.monthly_fee_idr

    try:
        await repo.save(rt)
        await db.commit()
    except IntegrityError as e:
        raise HTTPException(status_code=409, detail=_integrity_message(e))

    return {
        "id":              str(rt.id),
        "rt_number":       rt.rt_number,
        "rw_number":       rt.rw_number,
        "kelurahan":       rt.kelurahan,
        "kecamatan":       rt.kecamatan,
        "kota":            rt.kota,
        "provinsi":        rt.provinsi,
        "monthly_fee_idr": rt.monthly_fee_idr,
        "display_name":    f"RT {rt.rt_number}/RW {rt.rw_number}, {rt.kelurahan}",
    }

