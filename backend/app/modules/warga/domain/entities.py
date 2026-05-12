"""Warga domain entities — updated with verified_at/verified_by."""
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID

from app.core.base_entity import BaseEntity
from app.core.exceptions import InvalidStateTransitionError
from app.modules.warga.domain.events import ResidentRegistered, ResidentVerified, ResidentMovedOut


class ResidentStatus(str, Enum):
    PENDING   = "pending"
    ACTIVE    = "active"
    MOVED_OUT = "moved_out"


class OwnershipType(str, Enum):
    OWNER  = "owner"
    TENANT = "tenant"


@dataclass
class Resident(BaseEntity):
    """Aggregate Root — a household (KK) registered in an RT."""
    rt_group_id:    Optional[UUID]          = None
    user_id:        Optional[UUID]          = None
    full_name:      str                     = ""
    phone:          str                     = ""
    nik:            Optional[str]           = None
    street:         str                     = ""
    rt_number:      str                     = ""
    rw_number:      str                     = ""
    kelurahan:      str                     = ""
    kecamatan:      str                     = ""
    kota:           str                     = ""
    block:          str                     = ""
    unit_number:    str                     = ""
    ownership_type: OwnershipType           = OwnershipType.OWNER
    status:         ResidentStatus          = ResidentStatus.PENDING
    member_count:   int                     = 1
    kk_file_url:    Optional[str]           = None
    ktp_file_url:   Optional[str]           = None
    verified_at:    Optional[datetime]      = None
    verified_by:    Optional[UUID]          = None

    @classmethod
    def register(
        cls,
        rt_group_id: UUID, user_id: UUID, full_name: str, phone: str,
        street: str, rt_number: str, rw_number: str,
        kelurahan: str, kecamatan: str, kota: str,
        block: str, unit_number: str,
        ownership_type: OwnershipType = OwnershipType.OWNER,
        member_count: int = 1,
    ) -> "Resident":
        r = cls(
            rt_group_id=rt_group_id, user_id=user_id,
            full_name=full_name, phone=phone,
            street=street, rt_number=rt_number, rw_number=rw_number,
            kelurahan=kelurahan, kecamatan=kecamatan, kota=kota,
            block=block, unit_number=unit_number,
            ownership_type=ownership_type, member_count=member_count,
        )
        r.add_event(ResidentRegistered(
            resident_id=r.id, rt_group_id=rt_group_id, full_name=full_name,
        ))
        return r

    def verify(self, verified_by: UUID) -> None:
        if self.status != ResidentStatus.PENDING:
            raise InvalidStateTransitionError(f"Tidak bisa verifikasi status: {self.status}")
        self.status      = ResidentStatus.ACTIVE
        self.verified_at = datetime.now(timezone.utc)
        self.verified_by = verified_by
        self.add_event(ResidentVerified(resident_id=self.id, verified_by=verified_by))

    def move_out(self) -> None:
        if self.status == ResidentStatus.MOVED_OUT:
            raise InvalidStateTransitionError("Warga sudah pindah")
        self.status = ResidentStatus.MOVED_OUT
        self.add_event(ResidentMovedOut(resident_id=self.id, rt_group_id=self.rt_group_id))

    def upload_kk(self, url: str) -> None:
        self.kk_file_url = url

    def upload_ktp(self, url: str) -> None:
        self.ktp_file_url = url

    @property
    def is_active(self) -> bool:
        return self.status == ResidentStatus.ACTIVE

    @property
    def block_unit_display(self) -> str:
        return f"Blok {self.block} No. {self.unit_number}"
