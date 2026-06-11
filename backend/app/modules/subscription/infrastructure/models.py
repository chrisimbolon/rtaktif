"""Subscription ORM models — RTMudah SaaS billing.

File: app/modules/subscription/infrastructure/models.py

Uses String(20) for all status/plan columns.
Values validated at Python/Pydantic layer — no PostgreSQL ENUM types.
"""
import uuid
from datetime import datetime

from app.core.database import Base, TZDateTime
from sqlalchemy import (
    ForeignKey, Index, Integer, String, Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func


class RTSubscriptionModel(Base):
    """
    One row per RT group — tracks the current subscription state.
    Created automatically when an RT is approved (trial status).

    plan values:   trial | monthly | annual
    status values: trial | active | grace | locked | cancelled
    """
    __tablename__ = "rt_subscriptions"
    __table_args__ = (
        UniqueConstraint("rt_group_id", name="uq_rt_subscriptions_rt_group"),
        Index("ix_rt_subscriptions_status",     "status"),
        Index("ix_rt_subscriptions_trial_ends", "trial_ends_at"),
        Index("ix_rt_subscriptions_period_end", "current_period_end"),
        Index("ix_rt_subscriptions_grace_ends", "grace_ends_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    rt_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rt_groups.id", ondelete="CASCADE"),
        nullable=False,
    )

    # plan: trial | monthly | annual
    plan: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="trial"
    )

    # status: trial | active | grace | locked | cancelled
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="trial"
    )

    trial_ends_at:        Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    current_period_start: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    current_period_end:   Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    grace_ends_at:        Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    locked_at:            Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SubscriptionPaymentModel(Base):
    """
    Payment history. One row per payment attempt.
    Append-only — never updated, only inserted.

    plan values:   monthly | annual
    status values: pending | confirmed | rejected
    """
    __tablename__ = "subscription_payments"
    __table_args__ = (
        Index("ix_sub_payments_status",   "status", "created_at"),
        Index("ix_sub_payments_rt_group", "rt_group_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    rt_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rt_groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rt_subscriptions.id", ondelete="CASCADE"),
        nullable=False,
    )

    # plan: monthly | annual
    plan: Mapped[str] = mapped_column(String(20), nullable=False)

    amount_idr:      Mapped[int]          = mapped_column(Integer,   nullable=False)
    period_start:    Mapped[datetime|None] = mapped_column(TZDateTime, nullable=True)
    period_end:      Mapped[datetime|None] = mapped_column(TZDateTime, nullable=True)
    bukti_bayar_url: Mapped[str|None]      = mapped_column(Text,      nullable=True)

    # status: pending | confirmed | rejected
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending"
    )

    confirmed_by:     Mapped[uuid.UUID|None] = mapped_column(UUID(as_uuid=True), nullable=True)
    confirmed_at:     Mapped[datetime|None]  = mapped_column(TZDateTime, nullable=True)
    rejection_reason: Mapped[str|None]       = mapped_column(Text, nullable=True)
    notes:            Mapped[str|None]       = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
