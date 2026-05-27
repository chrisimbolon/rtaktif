"""
IAM routes — all endpoints for auth, users, and RT groups.
IntegrityError caught at every write endpoint to prevent 500s
from DB-level unique constraint violations.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.exceptions import (
    DuplicateEntityError, UnauthorizedError,
    ValidationError, EntityNotFoundError,
)
from app.modules.iam.application.schemas import (
    RegisterUserRequest, LoginRequest, CreateRTGroupRequest,
)
from app.modules.iam.application.use_cases.register_user import RegisterUser
from app.modules.iam.application.use_cases.login_user import LoginUser
from app.modules.iam.application.use_cases.verify_user import VerifyUser
from app.modules.iam.application.use_cases.create_rt_group import CreateRTGroup
from app.modules.iam.application.use_cases.assign_role import AssignRole
from app.modules.iam.infrastructure.repository import (
    PgUserRepository, PgRTGroupRepository,
)

router = APIRouter()


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


@router.patch("/users/{user_id}/verify", tags=["Users"])
async def verify_user(
    user_id: UUID,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await VerifyUser(PgUserRepository(db)).execute(
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
            "display_name": rt.display_name,
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
        return {"id": str(rt.id), "display_name": rt.display_name}
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
    users = await PgUserRepository(db).get_by_rt_group(rt_group_id)

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
        "display_name":    rt.display_name,
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
        "display_name":    rt.display_name,
    }

