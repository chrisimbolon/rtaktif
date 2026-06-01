"""Use case: Ketua RT submits their full onboarding verification package.

Orchestrates:
  1. Validate the user exists and is in the correct state
  2. Check the RT identity is not already claimed by another account
  3. Create or update the RTGroup (pending_verification)
  4. Persist the SK + KTP document URLs and signature
  5. Assign the user role=ketua_rt and link rt_group_id
  6. Publish RTGroupCreated domain event (fires WA confirmation via event bus)

Why this is a separate use case and not part of register_user:
  - Registration is stateless and synchronous (returns immediately)
  - Onboarding is document-heavy and has its own lifecycle
  - Separation means registration can succeed even if onboarding fails —
    the user account exists and can retry onboarding
"""

from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from app.core.events import event_bus
from app.core.exceptions import (
    DomainException,
    EntityNotFoundError,
    InvalidStateTransitionError,
)
from app.modules.iam.domain.entities import (
    RTGroup,
    RTIdentity,
    RTVerificationStatus,
    UserRole,
)
from app.modules.iam.domain.repositories import RTGroupRepository, UserRepository


class SubmitVerificationUseCase:
    """
    Called once by POST /onboarding/submit-verification.

    The use case is idempotent for the same user_id — if the user has
    already submitted, calling again replaces the previous submission
    (e.g. after a rejection) and resets to pending_verification.
    """

    def __init__(
        self,
        user_repo:     UserRepository,
        rt_group_repo: RTGroupRepository,
    ) -> None:
        self._user_repo     = user_repo
        self._rt_group_repo = rt_group_repo

    async def execute(
        self,
        *,
        user_id:        UUID,
        ktp_url:        str,
        sk_url:         str,
        signature_data: str,
        rt_number:      str,
        rw_number:      str,
        kelurahan:      str,
        kecamatan:      str,
        kota:           str,
        sk_valid_until: Optional[date] = None,
    ) -> RTGroup:

        # ── 1. Load and validate the user ─────────────────────────────────
        user = await self._user_repo.get_by_id(user_id)
        if not user:
            raise EntityNotFoundError(f"User {user_id} tidak ditemukan")

        if user.role not in (UserRole.KETUA_RT, UserRole.WARGA):
            raise InvalidStateTransitionError(
                "Hanya pengguna dengan role ketua_rt atau warga yang dapat "
                "melakukan onboarding Ketua RT"
            )

        # ── 2. Build the RT identity value object ──────────────────────────
        # RTIdentity.__post_init__ normalises and validates the 5-tuple.
        # If any field is invalid it raises DomainException — surfaces as 422.
        identity = RTIdentity(
            rt_number=rt_number,
            rw_number=rw_number,
            kelurahan=kelurahan,
            kecamatan=kecamatan,
            kota=kota,
        )

        # ── 3. Check for RT identity conflicts ────────────────────────────
        existing_group = await self._rt_group_repo.find_by_identity(identity)

        if existing_group and existing_group.admin_user_id != user_id:
            # Another user has already claimed this RT.
            # Give a human-friendly message — not a raw 409.
            raise InvalidStateTransitionError(
                f"{identity} sudah terdaftar oleh akun lain. "
                "Jika Anda adalah Ketua RT yang sah, hubungi support@rtmudah.com"
            )

        # ── 4. Create or update the RT group ──────────────────────────────
        if existing_group and existing_group.admin_user_id == user_id:
            # Re-submission (e.g. after rejection) — reuse the same group
            rt_group = existing_group
            # submit_sk resets to pending_verification if rejected/expired
            rt_group.submit_sk(
                sk_document_url=sk_url,
                sk_valid_until=sk_valid_until,
            )
            # KTP URL stored separately (not part of the RTGroup aggregate —
            # it belongs to the User's identity, not the RT's).
            # We store it on the user for the superadmin review screen.
            rt_group.ktp_url     = ktp_url        # type: ignore[attr-defined]
            rt_group.signature_data = signature_data  # type: ignore[attr-defined]
        else:
            # First-time submission — create the group
            rt_group = RTGroup.create(
                identity=identity,
                admin_user_id=user_id,
            )
            rt_group.submit_sk(
                sk_document_url=sk_url,
                sk_valid_until=sk_valid_until,
            )
            # Attach supplementary fields for the superadmin review
            rt_group.ktp_url        = ktp_url         # type: ignore[attr-defined]
            rt_group.signature_data = signature_data  # type: ignore[attr-defined]

        # ── 5. Persist the RT group ───────────────────────────────────────
        rt_group = await self._rt_group_repo.save(rt_group)

        # ── 6. Upgrade user role + link to RT group ───────────────────────
        user.role        = UserRole.KETUA_RT
        user.rt_group_id = rt_group.id
        await self._user_repo.save(user)

        # ── 7. Publish domain events ──────────────────────────────────────
        # RTGroupCreated was appended by RTGroup.create() or submit_sk().
        # The event bus delivers them to subscribers (WA blast, email, etc.)
        # without this use case needing to know who's listening.
        for event in rt_group.pull_events():
            await event_bus.publish(event)

        return rt_group
