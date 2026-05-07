"""Use case: Warga submits a laporan (issue report)."""
from uuid import UUID
from typing import Optional
from app.core.events import event_bus
from app.modules.komunikasi.domain.entities import LaporanWarga
from app.modules.komunikasi.domain.repositories import LaporanRepository


class SubmitLaporan:
    def __init__(self, repo: LaporanRepository):
        self.repo = repo

    async def execute(
        self, rt_group_id: UUID, resident_id: UUID,
        title: str, description: str, photo_url: Optional[str] = None,
    ) -> LaporanWarga:
        laporan = LaporanWarga.submit(
            rt_group_id=rt_group_id, resident_id=resident_id,
            title=title, description=description, photo_url=photo_url,
        )
        saved = await self.repo.save(laporan)
        for event in saved.pull_events():
            await event_bus.publish(event)
        return saved
