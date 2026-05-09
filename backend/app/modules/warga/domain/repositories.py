from abc import abstractmethod
from typing import Optional
from uuid import UUID
from app.core.base_repository import BaseRepository
from app.modules.warga.domain.entities import Resident, ResidentStatus


class ResidentRepository(BaseRepository[Resident]):
    @abstractmethod
    async def get_by_user_id(self, user_id: UUID) -> Optional[Resident]: ...

    @abstractmethod
    async def get_by_rt_group(
        self, rt_group_id: UUID, status: Optional[ResidentStatus] = None
    ) -> list[Resident]: ...

    @abstractmethod
    async def count_active_by_rt(self, rt_group_id: UUID) -> int: ...
