"""Use case: Admin verifies a pending resident."""
from uuid import UUID
from app.core.events import event_bus
from app.core.exceptions import EntityNotFoundError
from app.modules.warga.domain.repositories import ResidentRepository


class VerifyResident:
    def __init__(self, repo: ResidentRepository):
        self.repo = repo

    async def execute(self, resident_id: UUID, verified_by: UUID):
        resident = await self.repo.get_by_id(resident_id)
        if not resident:
            raise EntityNotFoundError(f"Warga {resident_id} tidak ditemukan")
        resident.verify(verified_by=verified_by)
        saved = await self.repo.save(resident)
        for event in saved.pull_events():
            await event_bus.publish(event)
        return saved
