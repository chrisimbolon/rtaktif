"""
Tagihan ORM models — production-grade schema.

Design decisions:
  - invoices: one row per billing period per resident (enforced by UNIQUE constraint)
  - payments:  separate table for the actual payment transaction
               → supports future multi-payment / partial payment scenarios
               → full audit trail: who confirmed, when, via what method
  - paid_at:   on invoice so you can query "all invoices paid in May" without a JOIN
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base, TZDateTime


class InvoiceModel(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        # Core business invariant: one invoice per resident per billing period
        UniqueConstraint("resident_id", "period_year", "period_month", name="uq_invoices_resident_period"),
        # Most common admin query: all invoices for RT 05 in May 2026
        Index("ix_invoices_rt_period", "rt_group_id", "period_year", "period_month"),
        # Overdue checker: find all issued/overdue invoices per RT
        Index("ix_invoices_rt_status", "rt_group_id", "status"),
    )

    id:           Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resident_id:  Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("residents.id", ondelete="RESTRICT"),  # can't delete resident with invoices
        nullable=False, index=True,
    )
    rt_group_id:  Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rt_groups.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    period_year:  Mapped[int]  = mapped_column(Integer, nullable=False)
    period_month: Mapped[int]  = mapped_column(Integer, nullable=False)
    amount_idr:   Mapped[int]  = mapped_column(Integer, nullable=False)
    status:       Mapped[str]  = mapped_column(String(20), server_default="issued", nullable=False, index=True)
    # Denormalised for fast reads (don't need JOIN to payments for basic status checks)
    paid_at:      Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    notes:        Mapped[str]  = mapped_column(Text, server_default="", nullable=False)
    created_at:   Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now(), nullable=False)
    updated_at:   Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class PaymentModel(Base):
    """
    Separate payments table — audit trail for every payment transaction.

    Relationship: Invoice 1→N Payment (usually 1:1, but handles corrections).
    The 'confirmed' payment is the one referenced by invoices.status = 'paid'.
    """
    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payments_invoice_id",  "invoice_id"),
        Index("ix_payments_resident_id", "resident_id"),
        Index("ix_payments_paid_at",     "paid_at"),
    )

    id:           Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id:   Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="RESTRICT"),  # never delete invoices with payments
        nullable=False,
    )
    resident_id:  Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("residents.id", ondelete="RESTRICT"),
        nullable=False,
    )
    amount_idr:     Mapped[int]            = mapped_column(Integer, nullable=False)
    method:         Mapped[str]            = mapped_column(String(50), server_default="bank_transfer", nullable=False)
    bukti_url:      Mapped[str | None]     = mapped_column(String(500), nullable=True)
    confirmed_by:   Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), nullable=False)  # admin user ID
    paid_at:        Mapped[datetime]       = mapped_column(TZDateTime, nullable=False)           # actual payment timestamp
    notes:          Mapped[str]            = mapped_column(Text, server_default="", nullable=False)
    created_at:     Mapped[datetime]       = mapped_column(TZDateTime, server_default=func.now(), nullable=False)
