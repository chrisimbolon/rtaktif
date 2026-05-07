from abc import abstractmethod
from uuid import UUID
from app.core.base_repository import BaseRepository
from app.modules.komunikasi.domain.entities import Announcement, LaporanWarga, LaporanStatus


class AnnouncementRepository(BaseRepository[Announcement]):
    @abstractmethod
    async def get_by_rt_group(self, rt_group_id: UUID, limit: int = 20) -> list[Announcement]: ...


class LaporanRepository(BaseRepository[LaporanWarga]):
    @abstractmethod
    async def get_by_rt_group(
        self, rt_group_id: UUID, status: LaporanStatus | None = None
    ) -> list[LaporanWarga]: ...

    @abstractmethod
    async def get_by_resident(self, resident_id: UUID) -> list[LaporanWarga]: ...
