"""
Komunikasi ORM models — production-grade schema.
Includes notification_logs for WA blast audit trail.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, Index, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base, TZDateTime


class AnnouncementModel(Base):
    __tablename__ = "announcements"
    __table_args__ = (
        Index("ix_announcements_rt_created", "rt_group_id", "created_at"),
    )

    id:              Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rt_group_id:     Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rt_groups.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    created_by:      Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,                                 # nullable so admin account deletions don't orphan announcements
    )
    title:           Mapped[str]  = mapped_column(String(255), nullable=False)
    body:            Mapped[str]  = mapped_column(Text, nullable=False)           # TEXT — no artificial limit
    ann_type:        Mapped[str]  = mapped_column(String(20), server_default="info", nullable=False)
    channel:         Mapped[str]  = mapped_column(String(20), server_default="both", nullable=False)
    recipient_count: Mapped[int]  = mapped_column(Integer, server_default="0", nullable=False)
    created_at: Mapped[datetime]  = mapped_column(TZDateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime]  = mapped_column(TZDateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class LaporanModel(Base):
    __tablename__ = "laporan_warga"
    __table_args__ = (
        # Fast lookup: open laporan per RT (most common admin view)
        Index("ix_laporan_rt_status", "rt_group_id", "status"),
        Index("ix_laporan_resident",  "resident_id"),
    )

    id:               Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rt_group_id:      Mapped[uuid.UUID]      = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rt_groups.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    resident_id:      Mapped[uuid.UUID]      = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("residents.id", ondelete="CASCADE"),
        nullable=False,
    )
    title:            Mapped[str]            = mapped_column(String(255), nullable=False)
    description:      Mapped[str]            = mapped_column(Text, server_default="", nullable=False)   # TEXT
    photo_url:        Mapped[str | None]     = mapped_column(String(500), nullable=True)
    status:           Mapped[str]            = mapped_column(String(20), server_default="open", nullable=False, index=True)
    resolved_by:      Mapped[uuid.UUID|None] = mapped_column(UUID(as_uuid=True), nullable=True)
    resolved_at:      Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)               # when it was resolved
    resolution_notes: Mapped[str]            = mapped_column(Text, server_default="", nullable=False)  # TEXT
    created_at:       Mapped[datetime]       = mapped_column(TZDateTime, server_default=func.now(), nullable=False)
    updated_at:       Mapped[datetime]       = mapped_column(TZDateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class NotificationLogModel(Base):
    """
    Audit trail for every WA blast / push notification sent.
    Answers: "Did the reminder go out? To whom? When?"
    """
    __tablename__ = "notification_logs"
    __table_args__ = (
        Index("ix_notif_rt_sent_at",  "rt_group_id", "sent_at"),
        Index("ix_notif_type_status", "notif_type",  "status"),
    )

    id:           Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rt_group_id:  Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rt_groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    sent_by:      Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)  # admin user ID
    # What triggered this notification?
    trigger_type: Mapped[str]       = mapped_column(String(50), nullable=False)           # "invoice_reminder" | "announcement" | "manual_blast"
    trigger_id:   Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)  # e.g. announcement_id or invoice_id
    # Delivery details
    notif_type:   Mapped[str]       = mapped_column(String(20), nullable=False)           # "whatsapp" | "push" | "both"
    recipient_count: Mapped[int]    = mapped_column(Integer, server_default="0", nullable=False)
    message_preview: Mapped[str]    = mapped_column(String(200), server_default="", nullable=False)  # first 200 chars
    # Outcome
    status:       Mapped[str]       = mapped_column(String(20), server_default="sent", nullable=False)  # "sent" | "failed" | "partial"
    failed_count: Mapped[int]       = mapped_column(Integer, server_default="0", nullable=False)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at:      Mapped[datetime]  = mapped_column(TZDateTime, nullable=False)
    created_at:   Mapped[datetime]  = mapped_column(TZDateTime, server_default=func.now(), nullable=False)
