"""Subscription Pydantic schemas — request/response models.
Annual plan only: Rp 450.000/tahun.
"""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


# ── Request schemas ────────────────────────────────────────────────────────

class SubmitPaymentRequest(BaseModel):
    """
    POST /subscription/payment
    Ketua RT submits bukti bayar for annual subscription.
    plan is always "annual" — kept for API compatibility.
    """
    plan:            str           = "annual"
    bukti_bayar_url: Optional[str] = None
    notes:           Optional[str] = None


class ReviewPaymentRequest(BaseModel):
    """
    PATCH /subscription/payment/{payment_id}/review
    Superadmin confirms or rejects a payment.
    """
    action:           str            # "confirm" | "reject"
    rejection_reason: Optional[str] = None


class GrantFreeSubscriptionRequest(BaseModel):
    """
    POST /subscription/grant
    Superadmin grants free subscription period to an RT.
    """
    rt_group_id: UUID
    plan:        str = "annual"   # always annual
    months:      int              # how many months to grant


# ── Response schemas ───────────────────────────────────────────────────────

class SubscriptionStatusResponse(BaseModel):
    """
    GET /subscription/my-status
    Frontend uses access_level to show/hide features.
    access_level: "full" | "grace" | "locked"
    """
    rt_group_id:       UUID
    plan:              str
    status:            str
    access_level:      str
    trial_ends_at:     Optional[str]
    current_period_end: Optional[str]
    grace_ends_at:     Optional[str]
    days_until_expiry: Optional[int]
    days_until_locked: Optional[int]
    pending_payment:   bool


class PaymentResponse(BaseModel):
    """Single payment record."""
    id:               UUID
    rt_group_id:      UUID
    plan:             str
    amount_idr:       int
    status:           str
    bukti_bayar_url:  Optional[str]
    notes:            Optional[str]
    period_start:     Optional[str]
    period_end:       Optional[str]
    confirmed_by:     Optional[UUID]
    confirmed_at:     Optional[str]
    rejection_reason: Optional[str]
    created_at:       str


class PendingPaymentItem(BaseModel):
    """Item in superadmin payment review queue."""
    payment_id:          UUID
    rt_group_id:         UUID
    rt_name:             str
    ketua_rt_name:       str
    ketua_rt_phone:      str
    plan:                str
    amount_idr:          int
    bukti_bayar_url:     Optional[str]
    notes:               Optional[str]
    submitted_at:        str
    subscription_status: str
