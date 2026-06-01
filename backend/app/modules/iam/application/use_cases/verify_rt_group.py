"""Use case: Superadmin approves or rejects a Ketua RT verification request.

Called by POST /onboarding/rt-groups/{id}/verify
Only users with role=superadmin may call this.

On approve:
  - RTGroup.approve() transitions status → active
  - User status is set to active (if still pending)
  - RTGroupVerified domain event fires → WA "Selamat, akun Anda aktif!" message

On reject:
  - RTGroup.reject() transitions status → rejected
  - RTGroupRejected domain event fires → WA "Mohon upload ulang dokumen Anda"
  - rejection_reason is mandatory (minimum 10 chars, enforced in schema)
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from app.core.events import event_bus
from app.core.exceptions import EntityNotFoundError, InvalidStateTransitionError
from app.modules.iam.domain.entities import UserStatus
from app.modules.iam.domain.repositories import RTGroupRepository, UserRepository


class VerifyRTGroupUseCase:

    def __init__(
        self,
        rt_group_repo: RTGroupRepository,
        user_repo:     UserRepository,
    ) -> None:
        self._rt_group_repo = rt_group_repo
        self._user_repo     = user_repo

    async def execute(
        self,
        *,
        rt_group_id:      UUID,
        superadmin_id:    UUID,
        action:           Literal["approve", "reject"],
        rejection_reason: str | None = None,
    ):
        # ── Load ──────────────────────────────────────────────────────────
        rt_group = await self._rt_group_repo.get_by_id(rt_group_id)
        if not rt_group:
            raise EntityNotFoundError(f"RT Group {rt_group_id} tidak ditemukan")

        # ── Validate the superadmin exists ────────────────────────────────
        superadmin = await self._user_repo.get_by_id(superadmin_id)
        if not superadmin or not superadmin.is_superadmin:
            raise InvalidStateTransitionError("Hanya superadmin yang dapat melakukan verifikasi")

        # ── Delegate all state-machine logic to the domain entity ─────────
        if action == "approve":
            rt_group.approve(verified_by=superadmin_id)

            # Activate the Ketua RT user account if still pending
            ketua = await self._user_repo.get_by_id(rt_group.admin_user_id)
            if ketua and ketua.status == UserStatus.PENDING:
                ketua.status = UserStatus.ACTIVE
                await self._user_repo.save(ketua)

        elif action == "reject":
            if not rejection_reason or not rejection_reason.strip():
                raise InvalidStateTransitionError(
                    "Alasan penolakan wajib diisi saat menolak verifikasi"
                )
            rt_group.reject(
                rejected_by=superadmin_id,
                reason=rejection_reason,
            )

        # ── Persist ───────────────────────────────────────────────────────
        rt_group = await self._rt_group_repo.save(rt_group)

        # ── Publish events ────────────────────────────────────────────────
        for event in rt_group.pull_events():
            await event_bus.publish(event)

        return rt_group
