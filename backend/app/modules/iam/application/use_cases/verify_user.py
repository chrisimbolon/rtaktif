"""
Use case: Admin verifies a pending user account.

On verification:
  1. User.status  → active
  2. Auto-creates Resident record (warga role + rt_group_id only)

This is the moment a User becomes a Resident of the RT.
  Registration = "I want to join" → User created (pending)
  Verification = "Ketua RT confirms" → Resident born (active)
"""
from uuid import UUID

from app.core.events import event_bus
from app.core.exceptions import EntityNotFoundError
from app.modules.iam.domain.repositories import (RTGroupRepository,
                                                 UserRepository)
from app.modules.warga.domain.entities import OwnershipType, Resident
from app.modules.warga.domain.repositories import ResidentRepository


class VerifyUser:
    def __init__(
        self,
        user_repo:     UserRepository,
        resident_repo: ResidentRepository,
        rt_group_repo: RTGroupRepository,
    ):
        self.user_repo     = user_repo
        self.resident_repo = resident_repo
        self.rt_group_repo = rt_group_repo

    async def execute(self, user_id: UUID, verified_by: UUID):
        # ── 1. Load and verify the user ──────────────────────────────────────
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise EntityNotFoundError(f"User {user_id} tidak ditemukan")

        user.verify(verified_by=verified_by)
        saved = await self.user_repo.save(user)

        for event in saved.pull_events():
            await event_bus.publish(event)

        # ── 2. Auto-create Resident record for warga ─────────────────────────
        # Only applies when:
        #   - role is "warga" (not admin_rt / admin_rw / super_admin)
        #   - user belongs to an RT group
        #   - no existing resident record (idempotent — safe to call twice)
        if saved.role == "warga" and saved.rt_group_id:
            existing = await self.resident_repo.get_by_user_id(user_id)

            if not existing:
                # Fetch RT for address pre-fill
                rt = await self.rt_group_repo.get_by_id(saved.rt_group_id)

                resident = Resident.register(
                    rt_group_id    = saved.rt_group_id,
                    user_id        = saved.id,
                    full_name      = saved.full_name,
                    phone          = getattr(saved, "phone", ""),
                    # Address pre-filled from RT — warga updates full details later
                    street         = "",
                    rt_number      = rt.rt_number if rt else "",
                    rw_number      = rt.rw_number if rt else "",
                    kelurahan      = rt.kelurahan  if rt else "",
                    kecamatan      = rt.kecamatan  if rt else "",
                    kota           = rt.kota        if rt else "",
                    block          = "",
                    unit_number    = "",
                    ownership_type = OwnershipType.OWNER,
                    member_count   = 1,
                )

                # Mark active immediately — verification is happening right now
                resident.verify(verified_by=verified_by)
                await self.resident_repo.save(resident)

                for event in resident.pull_events():
                    await event_bus.publish(event)

        return saved
