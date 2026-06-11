"""
Subscription API routes — RTMudah SaaS billing.
Annual plan only: Rp 400.000/tahun.

File: app/modules/subscription/presentation/api/v1/routes.py
"""

import uuid as _uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin, require_superadmin
from app.modules.subscription.application.schemas import (
    GrantFreeSubscriptionRequest,
    PaymentResponse,
    PendingPaymentItem,
    ReviewPaymentRequest,
    SubmitPaymentRequest,
    SubscriptionStatusResponse,
)
from app.modules.subscription.domain.entities import (
    ANNUAL_PRICE_IDR,
    GRACE_DAYS,
    TRIAL_DAYS,
)
from app.modules.subscription.infrastructure.models import (
    RTSubscriptionModel,
    SubscriptionPaymentModel,
)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/subscription", tags=["Subscription"])


# ── Helpers ────────────────────────────────────────────────────────────────

def _compute_access_level(row: RTSubscriptionModel) -> str:
    now = datetime.now(timezone.utc)
    if row.status == "trial":
        return "full" if row.trial_ends_at and now < row.trial_ends_at else "grace"
    if row.status == "active":
        return "full" if row.current_period_end and now < row.current_period_end else "grace"
    if row.status == "grace":
        return "grace" if row.grace_ends_at and now < row.grace_ends_at else "locked"
    return "locked"


def _days_until(dt: datetime | None) -> int | None:
    if not dt:
        return None
    return max(0, (dt - datetime.now(timezone.utc)).days)


async def _get_subscription(rt_group_id: UUID, db: AsyncSession) -> RTSubscriptionModel | None:
    result = await db.execute(
        select(RTSubscriptionModel).where(
            RTSubscriptionModel.rt_group_id == rt_group_id
        )
    )
    return result.scalar_one_or_none()


async def _get_rt_group_for_user(user_id: UUID, db: AsyncSession):
    from app.modules.iam.infrastructure.models import RTGroupModel
    result = await db.execute(
        select(RTGroupModel).where(RTGroupModel.admin_user_id == user_id)
    )
    return result.scalar_one_or_none()


async def _create_trial(rt_group_id: UUID, db: AsyncSession) -> RTSubscriptionModel:
    now = datetime.now(timezone.utc)
    sub = RTSubscriptionModel(
        id            = _uuid.uuid4(),
        rt_group_id   = rt_group_id,
        plan          = "trial",
        status        = "trial",
        trial_ends_at = now + timedelta(days=TRIAL_DAYS),
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


def _payment_to_response(p: SubscriptionPaymentModel) -> PaymentResponse:
    return PaymentResponse(
        id               = p.id,
        rt_group_id      = p.rt_group_id,
        plan             = p.plan,
        amount_idr       = p.amount_idr,
        status           = p.status,
        bukti_bayar_url  = p.bukti_bayar_url,
        notes            = p.notes,
        period_start     = p.period_start.isoformat() if p.period_start else None,
        period_end       = p.period_end.isoformat() if p.period_end else None,
        confirmed_by     = p.confirmed_by,
        confirmed_at     = p.confirmed_at.isoformat() if p.confirmed_at else None,
        rejection_reason = p.rejection_reason,
        created_at       = p.created_at.isoformat(),
    )


# ═══════════════════════════════════════════════════════════════════════════
# GET /subscription/my-status
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/my-status", response_model=SubscriptionStatusResponse)
async def get_my_subscription_status(
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    user_id  = _uuid.UUID(current_user["user_id"])
    rt_group = await _get_rt_group_for_user(user_id, db)
    if not rt_group:
        raise HTTPException(status_code=404, detail="RT group tidak ditemukan")

    sub = await _get_subscription(rt_group.id, db)
    if not sub:
        sub = await _create_trial(rt_group.id, db)

    # Check pending payment
    pending_result = await db.execute(
        select(SubscriptionPaymentModel).where(
            SubscriptionPaymentModel.rt_group_id == rt_group.id,
            SubscriptionPaymentModel.status == "pending",
        )
    )
    has_pending = pending_result.scalar_one_or_none() is not None

    # Auto-transition stale statuses
    now = datetime.now(timezone.utc)
    if sub.status == "active" and sub.current_period_end and now >= sub.current_period_end:
        sub.status        = "grace"
        sub.grace_ends_at = sub.current_period_end + timedelta(days=GRACE_DAYS)
        await db.commit()
        await db.refresh(sub)

    if sub.status == "grace" and sub.grace_ends_at and now >= sub.grace_ends_at:
        sub.status    = "locked"
        sub.locked_at = now
        await db.commit()
        await db.refresh(sub)

    days_expiry = None
    if sub.status == "trial":
        days_expiry = _days_until(sub.trial_ends_at)
    elif sub.status == "active":
        days_expiry = _days_until(sub.current_period_end)

    return SubscriptionStatusResponse(
        rt_group_id        = rt_group.id,
        plan               = sub.plan,
        status             = sub.status,
        access_level       = _compute_access_level(sub),
        trial_ends_at      = sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
        current_period_end = sub.current_period_end.isoformat() if sub.current_period_end else None,
        grace_ends_at      = sub.grace_ends_at.isoformat() if sub.grace_ends_at else None,
        days_until_expiry  = days_expiry,
        days_until_locked  = _days_until(sub.grace_ends_at) if sub.status == "grace" else None,
        pending_payment    = has_pending,
    )


# ═══════════════════════════════════════════════════════════════════════════
# POST /subscription/payment
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/payment", response_model=PaymentResponse, status_code=201)
async def submit_payment(
    body:         SubmitPaymentRequest,
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    """Ketua RT uploads bukti bayar for annual subscription."""
    if body.plan != "annual":
        raise HTTPException(
            status_code=422,
            detail="RTMudah hanya tersedia dalam paket tahunan — Rp 400.000/tahun"
        )

    user_id  = _uuid.UUID(current_user["user_id"])
    rt_group = await _get_rt_group_for_user(user_id, db)
    if not rt_group:
        raise HTTPException(status_code=404, detail="RT group tidak ditemukan")

    sub = await _get_subscription(rt_group.id, db)
    if not sub:
        sub = await _create_trial(rt_group.id, db)

    # Block duplicate pending payments
    existing = await db.execute(
        select(SubscriptionPaymentModel).where(
            SubscriptionPaymentModel.rt_group_id == rt_group.id,
            SubscriptionPaymentModel.status == "pending",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Sudah ada pembayaran yang menunggu konfirmasi. "
                   "Tunggu konfirmasi sebelum submit ulang."
        )

    payment = SubscriptionPaymentModel(
        id              = _uuid.uuid4(),
        rt_group_id     = rt_group.id,
        subscription_id = sub.id,
        plan            = "annual",
        amount_idr      = ANNUAL_PRICE_IDR,
        bukti_bayar_url = body.bukti_bayar_url,
        notes           = body.notes,
        status          = "pending",
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return _payment_to_response(payment)


# ═══════════════════════════════════════════════════════════════════════════
# GET /subscription/payments
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/payments", response_model=list[PaymentResponse])
async def get_my_payments(
    current_user: dict = Depends(require_admin),
    db:           AsyncSession = Depends(get_db),
):
    user_id  = _uuid.UUID(current_user["user_id"])
    rt_group = await _get_rt_group_for_user(user_id, db)
    if not rt_group:
        raise HTTPException(status_code=404, detail="RT group tidak ditemukan")

    result = await db.execute(
        select(SubscriptionPaymentModel)
        .where(SubscriptionPaymentModel.rt_group_id == rt_group.id)
        .order_by(SubscriptionPaymentModel.created_at.desc())
    )
    return [_payment_to_response(p) for p in result.scalars().all()]


# ═══════════════════════════════════════════════════════════════════════════
# GET /subscription/pending-payments  (superadmin)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/pending-payments", response_model=list[PendingPaymentItem])
async def get_pending_payments(
    current_user: dict = Depends(require_superadmin),
    db:           AsyncSession = Depends(get_db),
):
    from app.modules.iam.infrastructure.models import RTGroupModel, UserModel

    result = await db.execute(
        select(SubscriptionPaymentModel)
        .where(SubscriptionPaymentModel.status == "pending")
        .order_by(SubscriptionPaymentModel.created_at.asc())
    )
    payments = result.scalars().all()

    items = []
    for p in payments:
        rt    = await db.get(RTGroupModel, p.rt_group_id)
        if not rt:
            continue
        ketua_result = await db.execute(
            select(UserModel).where(UserModel.id == rt.admin_user_id)
        )
        ketua = ketua_result.scalar_one_or_none()
        sub   = await _get_subscription(p.rt_group_id, db)

        items.append(PendingPaymentItem(
            payment_id          = p.id,
            rt_group_id         = p.rt_group_id,
            rt_name             = f"RT {rt.rt_number}/RW {rt.rw_number}, Kel. {rt.kelurahan}, {rt.kota}",
            ketua_rt_name       = ketua.full_name if ketua else "Unknown",
            ketua_rt_phone      = ketua.phone     if ketua else "",
            plan                = p.plan,
            amount_idr          = p.amount_idr,
            bukti_bayar_url     = p.bukti_bayar_url,
            notes               = p.notes,
            submitted_at        = p.created_at.isoformat(),
            subscription_status = sub.status if sub else "unknown",
        ))
    return items


# ═══════════════════════════════════════════════════════════════════════════
# PATCH /subscription/payment/{payment_id}/review  (superadmin)
# ═══════════════════════════════════════════════════════════════════════════

@router.patch("/payment/{payment_id}/review")
async def review_payment(
    payment_id:   UUID,
    body:         ReviewPaymentRequest,
    current_user: dict = Depends(require_superadmin),
    db:           AsyncSession = Depends(get_db),
):
    if body.action not in ("confirm", "reject"):
        raise HTTPException(status_code=422, detail="Action harus 'confirm' atau 'reject'")

    payment = await db.get(SubscriptionPaymentModel, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Pembayaran tidak ditemukan")
    if payment.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Pembayaran sudah {payment.status}, tidak bisa direview ulang"
        )

    now        = datetime.now(timezone.utc)
    admin_uuid = _uuid.UUID(current_user["user_id"])

    if body.action == "reject":
        payment.status           = "rejected"
        payment.confirmed_by     = admin_uuid
        payment.confirmed_at     = now
        payment.rejection_reason = body.rejection_reason
        await db.commit()
        return {"message": "Pembayaran ditolak", "payment_id": str(payment_id)}

    # ── CONFIRM ──────────────────────────────────────────────────────────
    payment.status       = "confirmed"
    payment.confirmed_by = admin_uuid
    payment.confirmed_at = now

    sub = await _get_subscription(payment.rt_group_id, db)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription tidak ditemukan")

    # Extend from current end if still active, otherwise from now
    if sub.status in ("active", "grace") and sub.current_period_end and sub.current_period_end > now:
        period_start = sub.current_period_end
    else:
        period_start = now

    period_end = period_start + timedelta(days=365)   # always annual

    payment.period_start = period_start
    payment.period_end   = period_end

    sub.plan                 = "annual"
    sub.status               = "active"
    sub.current_period_start = period_start
    sub.current_period_end   = period_end
    sub.grace_ends_at        = None
    sub.locked_at            = None
    sub.updated_at           = now

    await db.commit()
    return {
        "message":      f"Pembayaran dikonfirmasi — langganan aktif hingga {period_end.strftime('%d %b %Y')}",
        "payment_id":   str(payment_id),
        "period_start": period_start.isoformat(),
        "period_end":   period_end.isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════
# POST /subscription/grant  (superadmin)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/grant")
async def grant_free_subscription(
    body:         GrantFreeSubscriptionRequest,
    current_user: dict = Depends(require_superadmin),
    db:           AsyncSession = Depends(get_db),
):
    sub = await _get_subscription(body.rt_group_id, db)
    if not sub:
        sub = await _create_trial(body.rt_group_id, db)

    now          = datetime.now(timezone.utc)
    period_start = now
    if sub.status == "active" and sub.current_period_end and sub.current_period_end > now:
        period_start = sub.current_period_end

    period_end = period_start + timedelta(days=body.months * 30)

    sub.plan                 = "annual"
    sub.status               = "active"
    sub.current_period_start = period_start
    sub.current_period_end   = period_end
    sub.grace_ends_at        = None
    sub.locked_at            = None
    sub.updated_at           = now

    await db.commit()
    return {
        "message":     f"Langganan gratis diberikan hingga {period_end.strftime('%d %b %Y')}",
        "rt_group_id": str(body.rt_group_id),
        "period_end":  period_end.isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════
# POST /subscription/init-trial/{rt_group_id}  (superadmin)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/init-trial/{rt_group_id}", status_code=201)
async def init_trial(
    rt_group_id:  UUID,
    current_user: dict = Depends(require_superadmin),
    db:           AsyncSession = Depends(get_db),
):
    """Idempotent — safe to call multiple times."""
    existing = await _get_subscription(rt_group_id, db)
    if existing:
        return {"message": "Trial sudah ada", "subscription_id": str(existing.id)}

    sub = await _create_trial(rt_group_id, db)
    return {
        "message":         "Trial 7 hari dimulai",
        "subscription_id": str(sub.id),
        "trial_ends_at":   sub.trial_ends_at.isoformat(),
    }
