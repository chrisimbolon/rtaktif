# backend/app/modules/iam/domain/entities.py

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from uuid import UUID

from app.core.base_entity import BaseEntity
from app.core.exceptions import InvalidStateTransitionError
from app.modules.iam.domain.events import UserRegistered, UserVerified, RoleAssigned, RTGroupCreated


class UserRole(str, Enum):
    WARGA      = "warga"
    ADMIN_RT   = "admin_rt"
    ADMIN_RW   = "admin_rw"
    SUPER_ADMIN = "super_admin"


class UserStatus(str, Enum):
    PENDING   = "pending"
    ACTIVE    = "active"
    SUSPENDED = "suspended"


@dataclass
class User(BaseEntity):
    """Aggregate Root — identity & access."""
    email: str = ""
    phone: str = ""
    hashed_password: str = ""
    full_name: str = ""
    role: UserRole = UserRole.WARGA
    status: UserStatus = UserStatus.PENDING
    rt_group_id: Optional[UUID] = None

    @classmethod
    def register(
        cls,
        email: str,
        phone: str,
        hashed_password: str,
        full_name: str,
    ) -> "User":
        user = cls(
            email=email, phone=phone,
            hashed_password=hashed_password, full_name=full_name,
        )
        user.add_event(UserRegistered(
            user_id=user.id, email=email, full_name=full_name,
        ))
        return user

    def verify(self, verified_by: UUID) -> None:
        if self.status != UserStatus.PENDING:
            raise InvalidStateTransitionError(
                f"Cannot verify user with status: {self.status}"
            )
        self.status = UserStatus.ACTIVE
        self.add_event(UserVerified(user_id=self.id, verified_by=verified_by))

    def assign_role(self, role: UserRole, assigned_by: UUID) -> None:
        self.role = role
        self.add_event(RoleAssigned(
            user_id=self.id, role=role.value, assigned_by=assigned_by,
        ))

    def assign_to_rt(self, rt_group_id: UUID) -> None:
        self.rt_group_id = rt_group_id

    def suspend(self) -> None:
        self.status = UserStatus.SUSPENDED

    @property
    def is_admin(self) -> bool:
        return self.role in (UserRole.ADMIN_RT, UserRole.ADMIN_RW, UserRole.SUPER_ADMIN)

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE


@dataclass
class RTGroup(BaseEntity):
    """Aggregate Root — neighbourhood group (RT)."""
    rt_number: str = ""
    rw_number: str = ""
    kelurahan: str = ""
    kecamatan: str = ""
    kota: str = ""
    provinsi: str = "Bengkulu"
    admin_user_id: Optional[UUID] = None
    monthly_fee_idr: int = 30_000

    @classmethod
    def create(
        cls,
        rt_number: str,
        rw_number: str,
        kelurahan: str,
        kecamatan: str,
        kota: str,
        admin_user_id: UUID,
        monthly_fee_idr: int = 30_000,
        provinsi: str = "Bengkulu",
    ) -> "RTGroup":
        rt = cls(
            rt_number=rt_number, rw_number=rw_number,
            kelurahan=kelurahan, kecamatan=kecamatan,
            kota=kota, provinsi=provinsi,
            admin_user_id=admin_user_id,
            monthly_fee_idr=monthly_fee_idr,
        )
        rt.add_event(RTGroupCreated(
            rt_group_id=rt.id, rt_number=rt_number,
            rw_number=rw_number, admin_user_id=admin_user_id,
        ))
        return rt

    @property
    def display_name(self) -> str:
        return f"RT {self.rt_number}/RW {self.rw_number} — {self.kelurahan}, {self.kota}"
