"""Use case: Admin resolves a laporan."""
from uuid import UUID
from app.core.events import event_bus
from app.core.exceptions import EntityNotFoundError
from app.modules.komunikasi.domain.repositories import LaporanRepository


class ResolveLaporan:
    def __init__(self, repo: LaporanRepository):
        self.repo = repo

    async def execute(self, laporan_id: UUID, resolved_by: UUID, notes: str = ""):
        laporan = await self.repo.get_by_id(laporan_id)
        if not laporan:
            raise EntityNotFoundError(f"Laporan {laporan_id} tidak ditemukan")
        laporan.resolve(resolved_by=resolved_by, notes=notes)
        saved = await self.repo.save(laporan)
        for event in saved.pull_events():
            await event_bus.publish(event)
        return saved
