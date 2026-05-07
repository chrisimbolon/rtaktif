"""Use case: Assign role to a user."""
from uuid import UUID
from app.core.events import event_bus
from app.core.exceptions import EntityNotFoundError, UnauthorizedError
from app.modules.iam.domain.entities import UserRole
from app.modules.iam.domain.repositories import UserRepository
from app.modules.iam.domain.policies import AdminPolicy


class AssignRole:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def execute(self, target_user_id: UUID, role: str, assigned_by: UUID):
        actor = await self.user_repo.get_by_id(assigned_by)
        if not actor or not AdminPolicy.can_assign_roles(actor):
            raise UnauthorizedError("Tidak memiliki akses untuk mengubah role")

        target = await self.user_repo.get_by_id(target_user_id)
        if not target:
            raise EntityNotFoundError(f"User {target_user_id} tidak ditemukan")

        target.assign_role(UserRole(role), assigned_by=assigned_by)
        saved = await self.user_repo.save(target)
        for event in saved.pull_events():
            await event_bus.publish(event)
        return saved
