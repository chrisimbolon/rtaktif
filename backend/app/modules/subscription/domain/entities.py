"""Subscription domain entities — RTMudah SaaS billing.

Pricing model (final):
  Trial:  7 days free
  Annual: Rp 400.000/tahun — only plan available
  Grace:  14 days after expiry before full lock
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4


# ── Enums ──────────────────────────────────────────────────────────────────

class SubscriptionPlan(str, Enum):
    TRIAL  = "trial"
    ANNUAL = "annual"


class SubscriptionStatus(str, Enum):
    TRIAL     = "trial"
    ACTIVE    = "active"
    GRACE     = "grace"
    LOCKED    = "locked"
    CANCELLED = "cancelled"


class PaymentStatus(str, Enum):
    PENDING   = "pending"
    CONFIRMED = "confirmed"
    REJECTED  = "rejected"


class PaymentPlan(str, Enum):
    ANNUAL = "annual"


# ── Pricing constants ──────────────────────────────────────────────────────

ANNUAL_PRICE_IDR = 400_000   # Rp 400.000/tahun — only plan
TRIAL_DAYS       = 7
GRACE_DAYS       = 14


# ── Subscription aggregate ─────────────────────────────────────────────────

@dataclass
class RTSubscription:
    """
    Aggregate root for RT subscription lifecycle.

    Status transitions:
        trial  → active  (on first payment confirmed)
        active → grace   (on period_end passed, no new payment)
        grace  → active  (on payment confirmed during grace)
        grace  → locked  (on grace_ends_at passed)
        locked → active  (on payment confirmed — reactivation)
        any    → cancelled (manual cancellation by superadmin)
    """
    id:                   UUID
    rt_group_id:          UUID
    plan:                 SubscriptionPlan
    status:               SubscriptionStatus
    trial_ends_at:        Optional[datetime]
    current_period_start: Optional[datetime]
    current_period_end:   Optional[datetime]
    grace_ends_at:        Optional[datetime]
    locked_at:            Optional[datetime]
    created_at:           datetime
    updated_at:           datetime

    @classmethod
    def create_trial(cls, rt_group_id: UUID) -> "RTSubscription":
        """Create a fresh 7-day trial subscription on RT registration."""
        now = datetime.now(timezone.utc)
        return cls(
            id                   = uuid4(),
            rt_group_id          = rt_group_id,
            plan                 = SubscriptionPlan.TRIAL,
            status               = SubscriptionStatus.TRIAL,
            trial_ends_at        = now + timedelta(days=TRIAL_DAYS),
            current_period_start = None,
            current_period_end   = None,
            grace_ends_at        = None,
            locked_at            = None,
            created_at           = now,
            updated_at           = now,
        )

    def get_access_level(self) -> str:
        """
        Returns one of: 'full' | 'grace' | 'locked'
        Called on every protected request to determine what the RT can do.
        """
        now = datetime.now(timezone.utc)

        if self.status == SubscriptionStatus.TRIAL:
            return "full" if self.trial_ends_at and now < self.trial_ends_at else "grace"

        if self.status == SubscriptionStatus.ACTIVE:
            return "full" if self.current_period_end and now < self.current_period_end else "grace"

        if self.status == SubscriptionStatus.GRACE:
            return "grace" if self.grace_ends_at and now < self.grace_ends_at else "locked"

        return "locked"   # locked or cancelled

    def days_until_expiry(self) -> Optional[int]:
        """Days until current period ends."""
        if self.status == SubscriptionStatus.TRIAL and self.trial_ends_at:
            return max(0, (self.trial_ends_at - datetime.now(timezone.utc)).days)
        if self.status == SubscriptionStatus.ACTIVE and self.current_period_end:
            return max(0, (self.current_period_end - datetime.now(timezone.utc)).days)
        return None

    def days_until_locked(self) -> Optional[int]:
        """Days until access is fully locked. Only relevant in grace status."""
        if self.status == SubscriptionStatus.GRACE and self.grace_ends_at:
            return max(0, (self.grace_ends_at - datetime.now(timezone.utc)).days)
        return None

    def activate(self, plan: PaymentPlan, from_dt: Optional[datetime] = None) -> None:
        """
        Transition to active after annual payment confirmed.
        Extends from current_period_end if active/grace (renewal),
        or from now if first payment / reactivation from locked.
        """
        now   = datetime.now(timezone.utc)
        start = from_dt or now

        # Renewal: extend from current period end, not from now
        if self.status in (SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE):
            if self.current_period_end and self.current_period_end > now:
                start = self.current_period_end

        # Annual is the only plan — always 365 days
        end = start + timedelta(days=365)

        self.plan                 = SubscriptionPlan.ANNUAL
        self.status               = SubscriptionStatus.ACTIVE
        self.current_period_start = start
        self.current_period_end   = end
        self.grace_ends_at        = None
        self.locked_at            = None
        self.updated_at           = now

    def enter_grace(self) -> None:
        """Called when period expires. Sets grace window = 14 days."""
        now    = datetime.now(timezone.utc)
        expiry = self.current_period_end or self.trial_ends_at or now
        self.status        = SubscriptionStatus.GRACE
        self.grace_ends_at = expiry + timedelta(days=GRACE_DAYS)
        self.updated_at    = now

    def lock(self) -> None:
        """Called when grace period expires."""
        now = datetime.now(timezone.utc)
        self.status     = SubscriptionStatus.LOCKED
        self.locked_at  = now
        self.updated_at = now


# ── Payment entity ─────────────────────────────────────────────────────────

@dataclass
class SubscriptionPayment:
    """
    Represents a single annual payment attempt by a Ketua RT.
    Immutable once confirmed or rejected.
    """
    id:               UUID
    rt_group_id:      UUID
    subscription_id:  UUID
    plan:             PaymentPlan
    amount_idr:       int
    period_start:     Optional[datetime]
    period_end:       Optional[datetime]
    bukti_bayar_url:  Optional[str]
    status:           PaymentStatus
    confirmed_by:     Optional[UUID]
    confirmed_at:     Optional[datetime]
    rejection_reason: Optional[str]
    notes:            Optional[str]
    created_at:       datetime
    updated_at:       datetime

    @classmethod
    def create(
        cls,
        rt_group_id:     UUID,
        subscription_id: UUID,
        bukti_bayar_url: Optional[str] = None,
        notes:           Optional[str] = None,
    ) -> "SubscriptionPayment":
        now = datetime.now(timezone.utc)
        return cls(
            id               = uuid4(),
            rt_group_id      = rt_group_id,
            subscription_id  = subscription_id,
            plan             = PaymentPlan.ANNUAL,
            amount_idr       = ANNUAL_PRICE_IDR,
            period_start     = None,
            period_end       = None,
            bukti_bayar_url  = bukti_bayar_url,
            status           = PaymentStatus.PENDING,
            confirmed_by     = None,
            confirmed_at     = None,
            rejection_reason = None,
            notes            = notes,
            created_at       = now,
            updated_at       = now,
        )
