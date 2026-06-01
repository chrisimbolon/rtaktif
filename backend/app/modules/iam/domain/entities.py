"""IAM domain entities — User + RTGroup aggregates.

Design principles:
  • Pure Python dataclasses — zero infrastructure imports.
  • RTGroup is the aggregate root for the verification lifecycle.
  • All state transitions go through explicit methods that raise domain
    exceptions on invalid moves — no silent no-ops.
  • RTIdentity is an immutable value object; equality is structural.
  • Domain events are collected via add_event() and drained via pull_events()
    which matches BaseEntity's interface exactly.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from app.core.base_entity import BaseEntity, DomainEvent
from app.core.exceptions import DomainException, InvalidStateTransitionError

# ═══════════════════════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════════════════════


class UserRole(str, Enum):
    SUPERADMIN = "superadmin"   # RTMudah platform staff
    KETUA_RT   = "ketua_rt"     # Verified Ketua RT
    WARGA      = "warga"        # Regular resident


class UserStatus(str, Enum):
    PENDING  = "pending"    # Registered, not yet verified
    ACTIVE   = "active"     # Verified, can log in
    INACTIVE = "inactive"   # Soft-deactivated


class RTVerificationStatus(str, Enum):
    """State machine for Ketua RT onboarding trust layer.

    Valid transitions:
        pending_verification → active      (superadmin approves SK)
        pending_verification → rejected    (superadmin rejects SK)
        active               → expired     (scheduled job, SK term ended)
        expired              → pending_verification  (Ketua submits renewal)
        rejected             → pending_verification  (Ketua re-submits SK)
    """
    PENDING_VERIFICATION = "pending_verification"
    ACTIVE               = "active"
    REJECTED             = "rejected"
    EXPIRED              = "expired"


# ═══════════════════════════════════════════════════════════════════════════════
# Value Objects
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass(frozen=True)
class RTIdentity:
    """Canonical 5-tuple that uniquely identifies an RT in Indonesia.

    Immutable by design — changing any field produces a new identity,
    which should trigger a fresh verification cycle.

    Fields are normalised on construction (stripped + title-cased) so
    "menteng" and "Menteng " hash identically.
    """

    rt_number: str   # "05"
    rw_number: str   # "03"
    kelurahan: str   # "Menteng"
    kecamatan: str   # "Menteng"
    kota: str        # "Jakarta Pusat"

    def __post_init__(self) -> None:
        for attr in ("rt_number", "rw_number", "kelurahan", "kecamatan", "kota"):
            raw = getattr(self, attr)
            if not raw or not raw.strip():
                raise DomainException(f"RTIdentity.{attr} cannot be blank")
            object.__setattr__(self, attr, raw.strip().title())

        for num_attr in ("rt_number", "rw_number"):
            val = getattr(self, num_attr)
            if not re.match(r"^\d{1,3}$", val):
                raise DomainException(
                    f"RTIdentity.{num_attr} must be 1-3 digits, got '{val}'"
                )

    def __str__(self) -> str:
        return (
            f"RT {self.rt_number}/RW {self.rw_number}, "
            f"Kel. {self.kelurahan}, Kec. {self.kecamatan}, {self.kota}"
        )

    def as_display(self) -> str:
        return str(self)


# ═══════════════════════════════════════════════════════════════════════════════
# Domain Events
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class RTGroupCreated(DomainEvent):
    rt_group_id:   UUID
    identity:      RTIdentity
    admin_user_id: UUID


@dataclass
class RTGroupVerified(DomainEvent):
    rt_group_id: UUID
    verified_by: UUID
    identity:    RTIdentity


@dataclass
class RTGroupRejected(DomainEvent):
    rt_group_id: UUID
    rejected_by: UUID
    reason:      str
    identity:    RTIdentity


@dataclass
class RTGroupExpired(DomainEvent):
    rt_group_id:   UUID
    identity:      RTIdentity
    sk_valid_until: date


@dataclass
class RTGroupRenewalSubmitted(DomainEvent):
    rt_group_id: UUID
    identity:    RTIdentity
    new_sk_url:  str


@dataclass
class UserVerified(DomainEvent):
    user_id:     UUID
    verified_by: UUID


# ═══════════════════════════════════════════════════════════════════════════════
# RTGroup Aggregate
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class RTGroup(BaseEntity):
    """Aggregate root for an RT neighbourhood group.

    Field ordering rule (Python dataclass inheritance):
      BaseEntity fields all have defaults → every RTGroup field MUST also
      have a default so Python doesn't complain about ordering.
      Fields that are logically required are enforced by the .create()
      factory which raises if they're None/empty.

    Never instantiate RTGroup() directly — always use RTGroup.create().
    """

    # ── Required (set via factory, default=None as dataclass technicality) ─
    identity:      Optional[RTIdentity] = field(default=None)
    admin_user_id: Optional[UUID]       = field(default=None)

    # ── Optional with sensible defaults ───────────────────────────────────
    monthly_fee_idr: int  = 30_000
    is_active:       bool = True
    provinsi:        str  = "Indonesia"

    # ── Flat location fields (synced from identity in __post_init__) ───────
    rt_number: str = field(init=False, default="")
    rw_number: str = field(init=False, default="")
    kelurahan: str = field(init=False, default="")
    kecamatan: str = field(init=False, default="")
    kota:      str = field(init=False, default="")

    # ── Verification state machine ─────────────────────────────────────────
    verification_status: RTVerificationStatus = RTVerificationStatus.PENDING_VERIFICATION
    sk_document_url:     Optional[str]        = None
    sk_valid_until:      Optional[date]       = None
    verified_at:         Optional[datetime]   = None
    verified_by:         Optional[UUID]       = None
    rejection_reason:    Optional[str]        = None

    def __post_init__(self) -> None:
        # BaseEntity.__post_init__ initialises _events — must call it
        super().__post_init__()
        # Sync flat location fields from the value object
        if self.identity is not None:
            self.rt_number = self.identity.rt_number
            self.rw_number = self.identity.rw_number
            self.kelurahan = self.identity.kelurahan
            self.kecamatan = self.identity.kecamatan
            self.kota      = self.identity.kota

    # ── Factory ───────────────────────────────────────────────────────────

    @classmethod
    def create(
        cls,
        identity:        RTIdentity,
        admin_user_id:   UUID,
        monthly_fee_idr: int = 30_000,
        provinsi:        str = "Indonesia",
    ) -> "RTGroup":
        if identity is None:
            raise DomainException("RTGroup.identity is required")
        if admin_user_id is None:
            raise DomainException("RTGroup.admin_user_id is required")

        group = cls(
            id=uuid4(),
            identity=identity,
            admin_user_id=admin_user_id,
            monthly_fee_idr=monthly_fee_idr,
            provinsi=provinsi,
        )
        group.add_event(
            RTGroupCreated(
                rt_group_id=group.id,
                identity=identity,
                admin_user_id=admin_user_id,
            )
        )
        return group

    # ── State machine ──────────────────────────────────────────────────────

    def submit_sk(
        self,
        sk_document_url: str,
        sk_valid_until:  Optional[date] = None,
    ) -> None:
        """Ketua RT uploads or re-uploads their Surat Keputusan.

        Allowed from: pending_verification, rejected, expired.
        Transitions rejected/expired → pending_verification automatically.
        """
        if not sk_document_url or not sk_document_url.strip():
            raise DomainException("SK document URL cannot be blank")

        self.sk_document_url  = sk_document_url.strip()
        self.sk_valid_until   = sk_valid_until
        self.rejection_reason = None
        self.verified_at      = None
        self.verified_by      = None

        if self.verification_status in (
            RTVerificationStatus.REJECTED,
            RTVerificationStatus.EXPIRED,
        ):
            self.verification_status = RTVerificationStatus.PENDING_VERIFICATION
            self.add_event(
                RTGroupRenewalSubmitted(
                    rt_group_id=self.id,
                    identity=self.identity,
                    new_sk_url=self.sk_document_url,
                )
            )

    def approve(self, verified_by: UUID) -> None:
        """Superadmin approves the SK — group becomes fully active."""
        if self.verification_status != RTVerificationStatus.PENDING_VERIFICATION:
            raise InvalidStateTransitionError(
                f"Cannot approve RTGroup in status '{self.verification_status.value}'. "
                "Only pending_verification groups can be approved."
            )
        if not self.sk_document_url:
            raise InvalidStateTransitionError(
                "Cannot approve RTGroup without an uploaded SK document."
            )

        self.verification_status = RTVerificationStatus.ACTIVE
        self.verified_at         = datetime.now(timezone.utc)
        self.verified_by         = verified_by
        self.rejection_reason    = None
        self.add_event(
            RTGroupVerified(
                rt_group_id=self.id,
                verified_by=verified_by,
                identity=self.identity,
            )
        )

    def reject(self, rejected_by: UUID, reason: str) -> None:
        """Superadmin rejects the SK — Ketua RT must re-submit."""
        if self.verification_status != RTVerificationStatus.PENDING_VERIFICATION:
            raise InvalidStateTransitionError(
                f"Cannot reject RTGroup in status '{self.verification_status.value}'."
            )
        if not reason or not reason.strip():
            raise DomainException("Rejection reason cannot be blank")

        self.verification_status = RTVerificationStatus.REJECTED
        self.rejection_reason    = reason.strip()
        self.verified_at         = None
        self.verified_by         = None
        self.add_event(
            RTGroupRejected(
                rt_group_id=self.id,
                rejected_by=rejected_by,
                reason=reason.strip(),
                identity=self.identity,
            )
        )

    def expire(self) -> None:
        """Scheduled job marks the group expired when SK term ends."""
        if self.verification_status != RTVerificationStatus.ACTIVE:
            raise InvalidStateTransitionError(
                f"Only active RTGroups can be expired, got '{self.verification_status.value}'."
            )
        if not self.sk_valid_until:
            raise InvalidStateTransitionError(
                "Cannot expire RTGroup without a known sk_valid_until date."
            )

        self.verification_status = RTVerificationStatus.EXPIRED
        self.add_event(
            RTGroupExpired(
                rt_group_id=self.id,
                identity=self.identity,
                sk_valid_until=self.sk_valid_until,
            )
        )

    # ── Guards ─────────────────────────────────────────────────────────────

    @property
    def is_verified(self) -> bool:
        return self.verification_status == RTVerificationStatus.ACTIVE

    @property
    def needs_renewal(self) -> bool:
        if not self.sk_valid_until:
            return False
        return 0 <= (self.sk_valid_until - date.today()).days <= 30

    @property
    def is_sk_overdue(self) -> bool:
        if not self.sk_valid_until:
            return False
        return date.today() > self.sk_valid_until


# ═══════════════════════════════════════════════════════════════════════════════
# User Aggregate
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class User(BaseEntity):
    """User aggregate — authentication identity only.

    RT membership lives in the Warga module's Resident entity.
    Same field-ordering rule applies: all fields must have defaults
    because BaseEntity fields have defaults.
    """

    # ── Required (enforced by factory) ────────────────────────────────────
    email:           Optional[str] = None
    phone:           Optional[str] = None
    hashed_password: Optional[str] = None
    full_name:       Optional[str] = None

    # ── Optional with defaults ─────────────────────────────────────────────
    role:        UserRole            = UserRole.WARGA
    status:      UserStatus          = UserStatus.PENDING
    rt_group_id: Optional[UUID]      = None

    def __post_init__(self) -> None:
        super().__post_init__()

    # ── Factory ───────────────────────────────────────────────────────────

    @classmethod
    def create(
        cls,
        email:           str,
        phone:           str,
        hashed_password: str,
        full_name:       str,
        role:            UserRole = UserRole.WARGA,
    ) -> "User":
        return cls(
            id=uuid4(),
            email=email.lower().strip(),
            phone=phone.strip(),
            hashed_password=hashed_password,
            full_name=full_name.strip(),
            role=role,
            status=UserStatus.PENDING,
        )

    # ── State machine ──────────────────────────────────────────────────────

    def verify(self, verified_by: UUID) -> None:
        if self.status != UserStatus.PENDING:
            raise InvalidStateTransitionError(
                f"Cannot verify user in status '{self.status.value}'."
            )
        self.status = UserStatus.ACTIVE
        self.add_event(UserVerified(user_id=self.id, verified_by=verified_by))

    def deactivate(self) -> None:
        if self.status == UserStatus.INACTIVE:
            return  # idempotent
        self.status = UserStatus.INACTIVE

    def assign_rt_group(self, rt_group_id: UUID) -> None:
        self.rt_group_id = rt_group_id

    # ── Guards ─────────────────────────────────────────────────────────────

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE

    @property
    def is_ketua_rt(self) -> bool:
        return self.role == UserRole.KETUA_RT

    @property
    def is_superadmin(self) -> bool:
        return self.role == UserRole.SUPERADMIN
