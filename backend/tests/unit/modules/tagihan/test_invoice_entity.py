"""Unit tests — Tagihan Invoice + Payment entities."""
import pytest
from datetime import datetime, timezone
from uuid import uuid4

from app.modules.tagihan.domain.entities import Invoice, Payment, InvoiceStatus, PaymentMethod
from app.modules.tagihan.domain.events import InvoiceGenerated, PaymentConfirmed
from app.modules.tagihan.domain.policies import BillingPolicy
from app.core.exceptions import InvalidStateTransitionError


def make_invoice(**overrides) -> Invoice:
    defaults = dict(
        resident_id=uuid4(), rt_group_id=uuid4(),
        year=2026, month=5, amount_idr=30_000,
    )
    return Invoice.generate(**{**defaults, **overrides})


# ── Invoice generation ─────────────────────────────────────────────
def test_generate_creates_issued_invoice():
    inv = make_invoice()
    assert inv.status     == InvoiceStatus.ISSUED
    assert inv.amount_idr == 30_000
    assert inv.paid_at    is None


def test_generate_emits_invoice_generated_event():
    inv    = make_invoice()
    events = inv.pull_events()
    assert any(isinstance(e, InvoiceGenerated) for e in events)


def test_period_label_returns_indonesian():
    inv = make_invoice(year=2026, month=5)
    assert "Mei"  in inv.period_label
    assert "2026" in inv.period_label


# ── Payment confirmation ───────────────────────────────────────────
def test_confirm_payment_returns_payment_entity():
    inv = make_invoice()
    inv.pull_events()
    admin_id = uuid4()
    payment  = inv.confirm_payment(method=PaymentMethod.BANK_TRANSFER, confirmed_by=admin_id)
    assert isinstance(payment, Payment)
    assert payment.invoice_id  == inv.id
    assert payment.amount_idr  == 30_000
    assert payment.confirmed_by == admin_id


def test_confirm_payment_sets_paid_status_and_paid_at():
    inv = make_invoice()
    inv.pull_events()
    inv.confirm_payment(method=PaymentMethod.BANK_TRANSFER, confirmed_by=uuid4())
    assert inv.status  == InvoiceStatus.PAID
    assert inv.paid_at is not None
    assert inv.is_paid is True
    # paid_at should be timezone-aware
    assert inv.paid_at.tzinfo is not None


def test_confirm_payment_emits_event_with_paid_at():
    inv = make_invoice()
    inv.pull_events()
    inv.confirm_payment(method=PaymentMethod.CASH, confirmed_by=uuid4())
    events = inv.pull_events()
    confirmed = next(e for e in events if isinstance(e, PaymentConfirmed))
    assert confirmed.paid_at is not None
    assert confirmed.method == "cash"


def test_payment_stored_on_invoice():
    inv = make_invoice()
    inv.pull_events()
    inv.confirm_payment(method=PaymentMethod.E_WALLET, confirmed_by=uuid4(),
                        bukti_url="https://example.com/bukti.jpg")
    assert inv.payment is not None
    assert inv.payment.bukti_url == "https://example.com/bukti.jpg"
    assert inv.payment.method    == PaymentMethod.E_WALLET


# ── State machine ──────────────────────────────────────────────────
def test_can_confirm_overdue_invoice():
    inv = make_invoice()
    inv.pull_events()
    inv.mark_overdue()
    # Should NOT raise — overdue invoices can still be paid
    payment = inv.confirm_payment(method=PaymentMethod.CASH, confirmed_by=uuid4())
    assert inv.status == InvoiceStatus.PAID
    assert payment is not None


def test_cannot_confirm_cancelled_invoice():
    inv = make_invoice()
    inv.cancel()
    with pytest.raises(InvalidStateTransitionError):
        inv.confirm_payment(method=PaymentMethod.CASH, confirmed_by=uuid4())


def test_cannot_cancel_paid_invoice():
    inv = make_invoice()
    inv.confirm_payment(method=PaymentMethod.CASH, confirmed_by=uuid4())
    with pytest.raises(InvalidStateTransitionError):
        inv.cancel()


def test_mark_overdue_changes_status():
    inv = make_invoice()
    inv.pull_events()
    inv.mark_overdue()
    assert inv.status == InvoiceStatus.OVERDUE


def test_mark_overdue_on_paid_does_nothing():
    inv = make_invoice()
    inv.confirm_payment(method=PaymentMethod.CASH, confirmed_by=uuid4())
    inv.mark_overdue()   # should be a no-op
    assert inv.status == InvoiceStatus.PAID


# ── Billing policy ─────────────────────────────────────────────────
def test_billing_policy_allows_generation_when_no_existing():
    assert BillingPolicy.can_generate_for_month(0) is True


def test_billing_policy_blocks_duplicate_generation():
    assert BillingPolicy.can_generate_for_month(1)  is False
    assert BillingPolicy.can_generate_for_month(47) is False


def test_billing_policy_overdue_detection():
    from datetime import date
    inv = make_invoice(year=2020, month=1)  # Jan 2020 — definitely overdue
    assert BillingPolicy.is_overdue(inv) is True


def test_billing_policy_not_overdue_for_paid():
    inv = make_invoice(year=2020, month=1)
    inv.confirm_payment(method=PaymentMethod.CASH, confirmed_by=uuid4())
    assert BillingPolicy.is_overdue(inv) is False
