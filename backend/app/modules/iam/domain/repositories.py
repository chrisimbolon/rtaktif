"""IAM domain repository interfaces — pure abstractions, no SQLAlchemy.

The domain layer defines WHAT it needs; infrastructure provides HOW.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional
from uuid import UUID

from app.modules.iam.domain.entities import (RTGroup, RTIdentity,
                                             RTVerificationStatus, User)


class UserRepository(ABC):

    @abstractmethod
    async def get_by_id(self, user_id: UUID) -> Optional[User]: ...

    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[User]: ...

    @abstractmethod
    async def get_by_phone(self, phone: str) -> Optional[User]: ...

    @abstractmethod
    async def save(self, user: User) -> User: ...

    @abstractmethod
    async def list_by_rt_group(self, rt_group_id: UUID) -> list[User]: ...


class RTGroupRepository(ABC):

    @abstractmethod
    async def get_by_id(self, rt_group_id: UUID) -> Optional[RTGroup]: ...

    @abstractmethod
    async def find_by_identity(self, identity: RTIdentity) -> Optional[RTGroup]:
        """Return the RTGroup matching this exact 5-tuple, or None.

        Used to enforce the uniqueness invariant before creating a new
        group — the DB constraint is the last line of defence, but we
        check here first to give a friendly domain error.
        """
        ...

    @abstractmethod
    async def list_pending_verification(self) -> list[RTGroup]:
        """Return all groups awaiting superadmin approval — the review queue."""
        ...

    @abstractmethod
    async def list_expiring_soon(self, within_days: int = 30) -> list[RTGroup]:
        """Return active groups whose SK expires within N days."""
        ...

    @abstractmethod
    async def save(self, rt_group: RTGroup) -> RTGroup: ...
