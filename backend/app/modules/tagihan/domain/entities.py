"""
Tagihan domain entities.

Invoice aggregate root manages the billing lifecycle.
Payment is a separate entity (stored in payments table) — not just
a field on Invoice — to maintain full audit trail.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID

from app.core.base_entity import BaseEntity
from app.core.exceptions import InvalidStateTransitionError
from app.modules.tagihan.domain.events import (
    InvoiceGenerated, PaymentConfirmed, InvoiceMarkedOverdue
)


class InvoiceStatus(str, Enum):
    ISSUED    = "issued"
    PAID      = "paid"
    OVERDUE   = "overdue"
    CANCELLED = "cancelled"


class PaymentMethod(str, Enum):
    BANK_TRANSFER = "bank_transfer"
    CASH          = "cash"
    E_WALLET      = "e_wallet"


@dataclass
class Payment(BaseEntity):
    """
    Separate entity — one row in the `payments` table per confirmation.
    Decoupled from Invoice so the audit trail is immutable.
    """
    invoice_id:   Optional[UUID]     = None
    resident_id:  Optional[UUID]     = None
    amount_idr:   int                = 0
    method:       PaymentMethod      = PaymentMethod.BANK_TRANSFER
    bukti_url:    Optional[str]      = None
    confirmed_by: Optional[UUID]     = None
    paid_at:      Optional[datetime] = field(default_factory=lambda: datetime.now(timezone.utc))
    notes:        str                = ""


@dataclass
class Invoice(BaseEntity):
    """
    Aggregate Root — billing lifecycle for one resident/period.

    paid_at is denormalised on the invoice for fast queries
    ("show me all invoices paid in May") without JOINing payments.
    The canonical record of the payment is in the Payment entity.
    """
    resident_id:  Optional[UUID]         = None
    rt_group_id:  Optional[UUID]         = None
    period_year:  int                    = 0
    period_month: int                    = 0
    amount_idr:   int                    = 0
    status:       InvoiceStatus          = InvoiceStatus.ISSUED
    paid_at:      Optional[datetime]     = None   # set when confirmed
    notes:        str                    = ""
    # Loaded lazily — not always populated
    payment:      Optional[Payment]      = field(default=None, compare=False, repr=False)

    @classmethod
    def generate(
        cls,
        resident_id: UUID,
        rt_group_id: UUID,
        year: int,
        month: int,
        amount_idr: int,
    ) -> "Invoice":
        inv = cls(
            resident_id=resident_id,
            rt_group_id=rt_group_id,
            period_year=year,
            period_month=month,
            amount_idr=amount_idr,
            status=InvoiceStatus.ISSUED,
        )
        inv.add_event(InvoiceGenerated(
            invoice_id=inv.id,
            resident_id=resident_id,
            rt_group_id=rt_group_id,
            amount_idr=amount_idr,
            period_year=year,
            period_month=month,
        ))
        return inv

    def confirm_payment(
        self,
        method: PaymentMethod,
        confirmed_by: UUID,
        bukti_url: Optional[str] = None,
        notes: str = "",
    ) -> Payment:
        """
        Confirms payment. Returns a Payment entity to be persisted separately.
        Sets paid_at on the invoice for fast denormalised queries.
        """
        if self.status not in (InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE):
            raise InvalidStateTransitionError(
                f"Tidak bisa konfirmasi pembayaran untuk status: {self.status}"
            )
        now = datetime.now(timezone.utc)
        self.status  = InvoiceStatus.PAID
        self.paid_at = now

        payment = Payment(
            invoice_id=self.id,
            resident_id=self.resident_id,
            amount_idr=self.amount_idr,
            method=method,
            bukti_url=bukti_url,
            confirmed_by=confirmed_by,
            paid_at=now,
            notes=notes,
        )
        self.payment = payment

        self.add_event(PaymentConfirmed(
            invoice_id=self.id,
            resident_id=self.resident_id,
            amount_idr=self.amount_idr,
            method=method.value,
            paid_at=now,
        ))
        return payment

    def mark_overdue(self) -> None:
        if self.status != InvoiceStatus.ISSUED:
            return
        self.status = InvoiceStatus.OVERDUE
        self.add_event(InvoiceMarkedOverdue(
            invoice_id=self.id,
            resident_id=self.resident_id,
        ))

    def cancel(self) -> None:
        if self.status == InvoiceStatus.PAID:
            raise InvalidStateTransitionError("Tidak bisa batalkan tagihan yang sudah lunas")
        self.status = InvoiceStatus.CANCELLED

    @property
    def is_paid(self) -> bool:
        return self.status == InvoiceStatus.PAID

    @property
    def period_label(self) -> str:
        from app.shared.constants.indonesia import INDONESIAN_MONTHS
        return f"{INDONESIAN_MONTHS[self.period_month]} {self.period_year}"
