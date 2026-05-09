"""Use case: Register a new resident (warga) in an RT group."""
from uuid import UUID
from app.core.events import event_bus
from app.modules.warga.domain.entities import Resident, OwnershipType
from app.modules.warga.domain.repositories import ResidentRepository


class RegisterResident:
    def __init__(self, repo: ResidentRepository):
        self.repo = repo

    async def execute(
        self, rt_group_id: UUID, user_id: UUID, full_name: str, phone: str,
        street: str, rt_number: str, rw_number: str, kelurahan: str,
        kecamatan: str, kota: str, block: str, unit_number: str,
        ownership_type: OwnershipType = OwnershipType.OWNER, member_count: int = 1,
    ) -> Resident:
        resident = Resident.register(
            rt_group_id=rt_group_id, user_id=user_id, full_name=full_name,
            phone=phone, street=street, rt_number=rt_number, rw_number=rw_number,
            kelurahan=kelurahan, kecamatan=kecamatan, kota=kota,
            block=block, unit_number=unit_number,
            ownership_type=ownership_type, member_count=member_count,
        )
        saved = await self.repo.save(resident)
        for event in saved.pull_events():
            await event_bus.publish(event)
        return saved
