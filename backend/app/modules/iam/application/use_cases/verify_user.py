"""Use case: Admin verifies a pending user account."""
from uuid import UUID
from app.core.events import event_bus
from app.core.exceptions import EntityNotFoundError
from app.modules.iam.domain.repositories import UserRepository


class VerifyUser:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def execute(self, user_id: UUID, verified_by: UUID):
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise EntityNotFoundError(f"User {user_id} tidak ditemukan")
        user.verify(verified_by=verified_by)
        saved = await self.user_repo.save(user)
        for event in saved.pull_events():
            await event_bus.publish(event)
        return saved
