"""Use case: Create a new RT group."""
from uuid import UUID
from app.core.events import event_bus
from app.modules.iam.domain.entities import RTGroup
from app.modules.iam.domain.repositories import RTGroupRepository


class CreateRTGroup:
    def __init__(self, rt_repo: RTGroupRepository):
        self.rt_repo = rt_repo

    async def execute(
        self,
        rt_number: str,
        rw_number: str,
        kelurahan: str,
        kecamatan: str,
        kota: str,
        admin_user_id: UUID,
        monthly_fee_idr: int = 30_000,
        provinsi: str = "Bengkulu",
    ) -> RTGroup:
        rt = RTGroup.create(
            rt_number=rt_number, rw_number=rw_number,
            kelurahan=kelurahan, kecamatan=kecamatan,
            kota=kota, admin_user_id=admin_user_id,
            monthly_fee_idr=monthly_fee_idr, provinsi=provinsi,
        )
        saved = await self.rt_repo.save(rt)
        for event in saved.pull_events():
            await event_bus.publish(event)
        return saved
