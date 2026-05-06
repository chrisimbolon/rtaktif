"""
IAM routes — mirrors hr-app presentation/api/v1/routes.py convention.
Thin layer: validate input → call use case → return response.
Zero business logic here.
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.exceptions import DuplicateEntityError, UnauthorizedError, ValidationError, EntityNotFoundError
from app.modules.iam.application.schemas import (
    RegisterUserRequest, LoginRequest, CreateRTGroupRequest,
    TokenResponse, UserResponse, RTGroupResponse,
)
from app.modules.iam.application.use_cases.register_user import RegisterUser
from app.modules.iam.application.use_cases.login_user import LoginUser
from app.modules.iam.application.use_cases.verify_user import VerifyUser
from app.modules.iam.application.use_cases.create_rt_group import CreateRTGroup
from app.modules.iam.application.use_cases.assign_role import AssignRole
from app.modules.iam.infrastructure.repository import PgUserRepository, PgRTGroupRepository

router = APIRouter()


# ── Auth ──────────────────────────────────────────────────────────
@router.post("/auth/register", status_code=status.HTTP_201_CREATED, tags=["Auth"])
async def register(body: RegisterUserRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await RegisterUser(PgUserRepository(db)).execute(
            email=body.email, phone=body.phone,
            password=body.password, full_name=body.full_name,
            rt_group_id=body.rt_group_id,
        )
        return {"id": str(user.id), "email": user.email, "status": user.status}
    except DuplicateEntityError as e:
        raise HTTPException(status_code=409, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.message)


@router.post("/auth/login", response_model=TokenResponse, tags=["Auth"])
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await LoginUser(PgUserRepository(db)).execute(
            email=body.email, password=body.password,
        )
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
    return {"id": str(user.id), "email": user.email,
            "full_name": user.full_name, "role": user.role, "status": user.status}


@router.patch("/users/{user_id}/verify", tags=["Users"])
async def verify_user(
    user_id: UUID,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await VerifyUser(PgUserRepository(db)).execute(
            user_id=user_id, verified_by=UUID(current_user["user_id"])
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
            target_user_id=user_id, role=role,
            assigned_by=UUID(current_user["user_id"]),
        )
        return {"id": str(user.id), "role": user.role}
    except (EntityNotFoundError, UnauthorizedError) as e:
        raise HTTPException(status_code=400, detail=e.message)


# ── RT Groups ─────────────────────────────────────────────────────
@router.post("/rt-groups", status_code=201, tags=["RT Groups"])
async def create_rt_group(
    body: CreateRTGroupRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rt = await CreateRTGroup(PgRTGroupRepository(db)).execute(
        rt_number=body.rt_number, rw_number=body.rw_number,
        kelurahan=body.kelurahan, kecamatan=body.kecamatan,
        kota=body.kota, provinsi=body.provinsi,
        admin_user_id=UUID(current_user["user_id"]),
        monthly_fee_idr=body.monthly_fee_idr,
    )
    return {"id": str(rt.id), "display_name": rt.display_name}


@router.get("/rt-groups/{rt_group_id}/members", tags=["RT Groups"])
async def get_rt_members(
    rt_group_id: UUID,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    users = await PgUserRepository(db).get_by_rt_group(rt_group_id)
    return [{"id": str(u.id), "full_name": u.full_name,
             "role": u.role, "status": u.status} for u in users]
