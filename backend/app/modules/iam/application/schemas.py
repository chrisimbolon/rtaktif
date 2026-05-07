"""Pydantic request/response schemas for IAM — mirrors hr-app application/schemas.py."""
from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional


class RegisterUserRequest(BaseModel):
    email: EmailStr
    phone: str
    password: str
    full_name: str
    rt_group_id: Optional[UUID] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CreateRTGroupRequest(BaseModel):
    rt_number: str
    rw_number: str
    kelurahan: str
    kecamatan: str
    kota: str
    provinsi: str = "Bengkulu"
    monthly_fee_idr: int = 30_000


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    status: str
    rt_group_id: Optional[UUID]


class RTGroupResponse(BaseModel):
    id: UUID
    rt_number: str
    rw_number: str
    kelurahan: str
    kecamatan: str
    kota: str
    monthly_fee_idr: int
    display_name: str
