from dataclasses import dataclass
from enum import Enum
from typing import Optional
from uuid import UUID
from app.core.base_entity import BaseEntity
from app.core.exceptions import InvalidStateTransitionError
from app.modules.tagihan.domain.events import InvoiceGenerated, PaymentConfirmed, InvoiceMarkedOverdue


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
class Invoice(BaseEntity):
    """Aggregate Root — monthly iuran invoice lifecycle."""
    resident_id: Optional[UUID] = None
    rt_group_id: Optional[UUID] = None
    period_year: int = 0
    period_month: int = 0
    amount_idr: int = 0
    status: InvoiceStatus = InvoiceStatus.ISSUED
    payment_method: Optional[PaymentMethod] = None
    bukti_url: Optional[str] = None
    confirmed_by: Optional[UUID] = None
    notes: str = ""

    @classmethod
    def generate(cls, resident_id: UUID, rt_group_id: UUID,
                 year: int, month: int, amount_idr: int) -> "Invoice":
        inv = cls(
            resident_id=resident_id, rt_group_id=rt_group_id,
            period_year=year, period_month=month,
            amount_idr=amount_idr, status=InvoiceStatus.ISSUED,
        )
        inv.add_event(InvoiceGenerated(
            invoice_id=inv.id, resident_id=resident_id,
            rt_group_id=rt_group_id, amount_idr=amount_idr,
            period_year=year, period_month=month,
        ))
        return inv

    def confirm_payment(self, method: PaymentMethod,
                        confirmed_by: UUID, bukti_url: Optional[str] = None) -> None:
        if self.status not in (InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE):
            raise InvalidStateTransitionError(
                f"Tidak bisa konfirmasi pembayaran untuk status: {self.status}"
            )
        self.status        = InvoiceStatus.PAID
        self.payment_method = method
        self.confirmed_by  = confirmed_by
        self.bukti_url     = bukti_url
        self.add_event(PaymentConfirmed(
            invoice_id=self.id, resident_id=self.resident_id,
            amount_idr=self.amount_idr, method=method.value,
        ))

    def mark_overdue(self) -> None:
        if self.status != InvoiceStatus.ISSUED:
            return
        self.status = InvoiceStatus.OVERDUE
        self.add_event(InvoiceMarkedOverdue(
            invoice_id=self.id, resident_id=self.resident_id,
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
