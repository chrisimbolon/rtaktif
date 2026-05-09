import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class InvoiceModel(Base):
    __tablename__ = "invoices"

    id:             Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resident_id:    Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    rt_group_id:    Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    period_year:    Mapped[int]            = mapped_column(Integer, nullable=False)
    period_month:   Mapped[int]            = mapped_column(Integer, nullable=False)
    amount_idr:     Mapped[int]            = mapped_column(Integer, nullable=False)
    status:         Mapped[str]            = mapped_column(String(20), default="issued", index=True)
    payment_method: Mapped[str | None]     = mapped_column(String(50), nullable=True)
    bukti_url:      Mapped[str | None]     = mapped_column(String(500), nullable=True)
    confirmed_by:   Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    notes:          Mapped[str]            = mapped_column(String(500), default="")
    created_at:     Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:     Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
