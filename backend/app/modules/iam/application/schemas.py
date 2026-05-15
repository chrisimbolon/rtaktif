"""Pydantic request/response schemas for IAM."""
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from uuid import UUID
from typing import Optional


class RegisterUserRequest(BaseModel):
    email:      EmailStr
    phone:      str
    password:   str
    full_name:  str
    rt_group_id: Optional[UUID] = None

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password minimal 6 karakter")
        return v

    @field_validator("full_name")
    @classmethod
    def full_name_min_length(cls, v: str) -> str:
        if len(v.strip()) < 3:
            raise ValueError("Nama lengkap minimal 3 karakter")
        return v.strip()

    @field_validator("phone")
    @classmethod
    def phone_format(cls, v: str) -> str:
        import re
        cleaned = re.sub(r"[\s\-\(\)]", "", v)
        if not re.match(r"^(08|628)\d{8,12}$", cleaned):
            raise ValueError("Format nomor HP tidak valid (contoh: 081234567890)")
        return cleaned


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


class CreateRTGroupRequest(BaseModel):
    rt_number:       str
    rw_number:       str
    kelurahan:       str
    kecamatan:       str
    kota:            str
    provinsi:        str = "Bengkulu"
    monthly_fee_idr: int = 30_000


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"


class UserResponse(BaseModel):
    id:          UUID
    email:       str
    full_name:   str
    role:        str
    status:      str
    rt_group_id: Optional[UUID]


class RTGroupResponse(BaseModel):
    id:              UUID
    rt_number:       str
    rw_number:       str
    kelurahan:       str
    kecamatan:       str
    kota:            str
    monthly_fee_idr: int
    display_name:    str
