from datetime import date as _date
from typing import Optional
from uuid import UUID

from app.modules.warga.domain.entities import OwnershipType
from pydantic import BaseModel, field_validator


class RegisterResidentRequest(BaseModel):
    rt_group_id: UUID
    full_name: str
    phone: str
    street: str
    rt_number: str
    rw_number: str
    kelurahan: str
    kecamatan: str
    kota: str
    block: str
    unit_number: str
    ownership_type: OwnershipType = OwnershipType.OWNER
    member_count: int = 1


class ResidentResponse(BaseModel):
    id: UUID
    full_name: str
    phone: str
    block_unit_display: str
    status: str
    ownership_type: str
    member_count: int
    kk_file_url: Optional[str]
    ktp_file_url: Optional[str]


class AddAnggotaRequest(BaseModel):
    """Request body for adding a family member (anggota KK)."""
    full_name:           str
    hubungan_dengan_kk:  str

    phone:               Optional[str] = None
    nik:                 Optional[str] = None
    tanggal_lahir:       Optional[str] = None
    tempat_lahir:        Optional[str] = None
    jenis_kelamin:       Optional[str] = None
    agama:               Optional[str] = None
    pekerjaan:           Optional[str] = None
    status_kawin:        Optional[str] = None
    status_tinggal:      Optional[str] = None
    pendidikan_terakhir: Optional[str] = None
    kewarganegaraan:     Optional[str] = None


class AdminUpdateResidentRequest(BaseModel):
    """
    PATCH /warga/{resident_id}/admin-update
    All fields optional — partial update.
    """
    full_name:           Optional[str]   = None
    phone:               Optional[str]   = None
    nik:                 Optional[str]   = None
    no_kk:               Optional[str]   = None
    tanggal_lahir:       Optional[_date] = None
    tempat_lahir:        Optional[str]   = None
    jenis_kelamin:       Optional[str]   = None
    agama:               Optional[str]   = None
    pekerjaan:           Optional[str]   = None
    status_kawin:        Optional[str]   = None
    status_tinggal:      Optional[str]   = None
    status_keluarga:     Optional[str]   = None
    kepala_keluarga:     Optional[bool]  = None
    alamat_ktp:          Optional[str]   = None
    pendidikan_terakhir: Optional[str]   = None
    kewarganegaraan:     Optional[str]   = None
    hubungan_dengan_kk:  Optional[str]   = None

    @field_validator("tanggal_lahir", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        """Convert empty string to None so Optional[date] validation passes."""
        if v == "" or v is None:
            return None
        return v

    @field_validator(
        "full_name", "phone", "nik", "no_kk", "tempat_lahir",
        "jenis_kelamin", "agama", "pekerjaan", "status_kawin",
        "status_tinggal", "status_keluarga", "alamat_ktp",
        "pendidikan_terakhir", "kewarganegaraan", "hubungan_dengan_kk",
        mode="before"
    )
    @classmethod
    def empty_str_fields_to_none(cls, v):
        """Convert empty string to None for all Optional[str] fields."""
        if v == "":
            return None
        return v

class ChangeLogEntry(BaseModel):
    """Single entry in a resident\'s change log — returned to frontend."""
    id:               UUID
    field_name:       str
    field_label:      str
    old_value:        Optional[str]
    new_value:        Optional[str]
    changed_by:       UUID
    changed_by_name:  str          # denormalised for display
    changed_by_role:  str
    resident_name:    str
    changed_at:       str          # ISO string

class SubmitChangeRequestBody(BaseModel):
    """
    POST /warga/me/change-requests
    All fields optional — only changed fields create a request.
    Same shape as AdminUpdateResidentRequest, but warga-facing.
    """
    full_name:           Optional[str]   = None
    phone:               Optional[str]   = None
    nik:                 Optional[str]   = None
    no_kk:               Optional[str]   = None
    tanggal_lahir:       Optional[_date] = None
    tempat_lahir:        Optional[str]   = None
    jenis_kelamin:       Optional[str]   = None
    agama:               Optional[str]   = None
    pekerjaan:           Optional[str]   = None
    status_kawin:        Optional[str]   = None
    status_tinggal:      Optional[str]   = None
    alamat_ktp:          Optional[str]   = None
    pendidikan_terakhir: Optional[str]   = None

    @field_validator(
        "phone", "nik", "no_kk", "tempat_lahir", "jenis_kelamin", "agama",
        "pekerjaan", "status_kawin", "status_tinggal", "alamat_ktp",
        "pendidikan_terakhir", "full_name",
        mode="before",
    )
    @classmethod
    def empty_string_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    @field_validator("tanggal_lahir", mode="before")
    @classmethod
    def empty_date_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v


# ── Review (Ketua RT approve/reject) ───────────────────────────────────────────

class ReviewChangeRequestBody(BaseModel):
    """
    PATCH /warga/change-requests/{id}/review
    """
    action:           str            # "approve" | "reject"
    rejection_reason: Optional[str] = None


# ── Responses ───────────────────────────────────────────────────────────────────

class ChangeRequestItem(BaseModel):
    """Single field-change request — used in both warga history + Ketua RT queue."""
    id:                UUID
    resident_id:       UUID
    resident_name:     str
    requested_by:      UUID
    requested_by_name: str
    field_name:        str
    field_label:       str
    old_value:         Optional[str]
    new_value:         Optional[str]
    status:            str
    reviewed_by_name:  Optional[str]
    reviewed_at:       Optional[str]
    rejection_reason:  Optional[str]
    created_at:        str


class SubmitChangeRequestResponse(BaseModel):
    """Returned after warga submits self-edit request."""
    created_count: int
    requests:       list[ChangeRequestItem]
    message:        str
