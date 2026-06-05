from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from app.modules.warga.domain.entities import OwnershipType


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
