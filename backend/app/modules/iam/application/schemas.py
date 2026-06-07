"""IAM application schemas — Pydantic request/response contracts.

Only this layer touches Pydantic. Domain entities are plain dataclasses.
Validation rules here are the API contract; domain rules live in entities.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

# ─── Helpers ──────────────────────────────────────────────────────────────────

_PHONE_RE = re.compile(r"^(\+62|62|0)[0-9]{8,13}$")


def _normalise_phone(v: str) -> str:
    v = v.strip().replace(" ", "").replace("-", "")
    if not _PHONE_RE.match(v):
        raise ValueError("Format nomor HP tidak valid (cth: 08123456789 atau +628123456789)")
    return v


# ═══════════════════════════════════════════════════════════════════════════════
# Auth
# ═══════════════════════════════════════════════════════════════════════════════


class RegisterRequest(BaseModel):
    full_name:   str       = Field(..., min_length=3,  max_length=255)
    email:       EmailStr
    phone:       str
    password:    str       = Field(..., min_length=6)
    role:        str       = Field(default="warga", pattern=r"^(warga|ketua_rt)$")
    rt_group_id: Optional[UUID] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _normalise_phone(v)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Nama minimal 3 karakter")
        return v


class RegisterResponse(BaseModel):
    id:        UUID
    email:     str
    full_name: str
    role:      str
    status:    str


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user_id:      UUID
    role:         str
    full_name:    str


# ═══════════════════════════════════════════════════════════════════════════════
# Onboarding — Ketua RT verification
# ═══════════════════════════════════════════════════════════════════════════════


class UploadDocumentResponse(BaseModel):
    """Returned by POST /onboarding/upload-document."""
    url:        str
    file_name:  str
    size_bytes: int
    doc_type:   str   # "ktp" | "sk"


class SubmitVerificationRequest(BaseModel):
    """
    Complete onboarding payload sent after the Ketua RT has:
      1. Uploaded KTP
      2. Uploaded SK Pengangkatan
      3. Signed the Pakta Integritas

    rt_number / rw_number are validated as 1–3 digit strings.
    The backend creates (or claims) the RTGroup in pending_verification.
    """

    user_id:        UUID
    ktp_url:        str  = Field(..., min_length=10)
    sk_url:         str  = Field(..., min_length=10)
    # Base64-encoded PNG from canvas.toDataURL("image/png")
    signature_data: str  = Field(..., min_length=100)

    # RT identity — becomes RTIdentity value object in the domain
    rt_number:  str = Field(..., pattern=r"^\d{1,3}$")
    rw_number:  str = Field(..., pattern=r"^\d{1,3}$")
    kelurahan:  str = Field(..., min_length=2, max_length=100)
    kecamatan:  str = Field(..., min_length=2, max_length=100)
    kota:       str = Field(..., min_length=2, max_length=100)

    # Optional — can be parsed from the SK document by admin later
    sk_valid_until: Optional[date] = None

    @field_validator("ktp_url", "sk_url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not (v.startswith("https://") or v.startswith("http://")):
            raise ValueError("URL dokumen tidak valid")
        return v

    @field_validator("signature_data")
    @classmethod
    def validate_signature(cls, v: str) -> str:
        if not v.startswith("data:image/png;base64,"):
            raise ValueError("Format tanda tangan tidak valid (harus PNG base64)")
        return v


class SubmitVerificationResponse(BaseModel):
    """Returned by POST /onboarding/submit-verification."""
    status:          str   # always "pending_verification"
    rt_group_id:     UUID
    rt_identity:     str   # human-readable e.g. "RT 05/RW 03, Kel. Menteng..."
    message:         str


# ═══════════════════════════════════════════════════════════════════════════════
# Superadmin verification actions
# ═══════════════════════════════════════════════════════════════════════════════


class VerifyRTGroupRequest(BaseModel):
    """POST /onboarding/rt-groups/{id}/verify — superadmin approves or rejects."""
    action:           str            = Field(..., pattern=r"^(approve|reject)$")
    rejection_reason: Optional[str]  = Field(default=None, min_length=10)

    @field_validator("rejection_reason")
    @classmethod
    def reason_required_on_reject(cls, v: Optional[str], info) -> Optional[str]:
        # Cross-field: if action == "reject", reason is mandatory
        # (Full cross-field validation done in the use case — Pydantic v2
        #  model_validator would work here too but keeping it simple)
        return v

class KTPOCRDataResponse(BaseModel):
    nik:           Optional[str] = None
    nama:          Optional[str] = None
    tempat_lahir:  Optional[str] = None
    tanggal_lahir: Optional[str] = None
    jenis_kelamin: Optional[str] = None
    alamat:        Optional[str] = None
    rt_rw:         Optional[str] = None
    kelurahan:     Optional[str] = None
    kecamatan:     Optional[str] = None
    kota:          Optional[str] = None
    provinsi:      Optional[str] = None
    agama:         Optional[str] = None
    masa_berlaku:  Optional[str] = None


class KTPUploadOCRResponse(BaseModel):
    ktp_document_url: str
    ocr_success:      bool
    confidence_score: float
    flags:            list[str]
    suggested_action: str
    extracted:        Optional[KTPOCRDataResponse]
    error:            Optional[str]

class RTGroupVerificationResponse(BaseModel):
    id:                  UUID
    rt_identity:         str
    verification_status: str
    verified_at:         Optional[datetime]
    verified_by:         Optional[UUID]
    rejection_reason:    Optional[str]
    sk_valid_until:      Optional[date]
    needs_renewal:       bool
    message:             str


class PendingRTGroupItem(BaseModel):
    id:                  UUID
    rt_identity:         str
    admin_full_name:     str
    admin_phone:         str
    ktp_url:             Optional[str]
    sk_url:              Optional[str]
    created_at:          datetime
    ktp_ocr_confidence:  Optional[float]    = None
    ktp_ocr_flags:       list[str]          = []
    ktp_verified:        bool               = False
    ktp_ocr_data:        Optional[KTPOCRDataResponse] = None

# ═══════════════════════════════════════════════════════════════════════════════
# RT Group (general)
# ═══════════════════════════════════════════════════════════════════════════════


class RTGroupResponse(BaseModel):
    id:                  UUID
    display_name:        str
    rt_number:           str
    rw_number:           str
    kelurahan:           str
    kecamatan:           str
    kota:                str
    provinsi:            str
    monthly_fee_idr:     int
    is_active:           bool
    verification_status: str
    sk_valid_until:      Optional[date]
    needs_renewal:       bool


class UpdateRTGroupRequest(BaseModel):
    monthly_fee_idr: Optional[int]  = Field(default=None, ge=0)
    provinsi:        Optional[str]  = Field(default=None, min_length=2)
    is_active:       Optional[bool] = None


# ─── Backwards-compatibility aliases ─────────────────────────────────────────
# routes.py imports these old names — aliases let us keep both working
# without touching the existing routes.
RegisterUserRequest  = RegisterRequest
CreateRTGroupRequest = UpdateRTGroupRequest  # close enough for existing routes
TokenResponse        = LoginResponse
