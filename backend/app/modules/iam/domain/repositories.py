"""Abstract repository interfaces — domain layer only sees these, never SQLAlchemy."""
from abc import abstractmethod
from typing import Optional
from uuid import UUID

from app.core.base_repository import BaseRepository
from app.modules.iam.domain.entities import User, RTGroup


class UserRepository(BaseRepository[User]):
    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[User]: ...

    @abstractmethod
    async def exists_by_email(self, email: str) -> bool: ...

    @abstractmethod
    async def get_by_rt_group(self, rt_group_id: UUID) -> list[User]: ...


class RTGroupRepository(BaseRepository[RTGroup]):
    @abstractmethod
    async def get_by_admin(self, admin_user_id: UUID) -> Optional[RTGroup]: ...
