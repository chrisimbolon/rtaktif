import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class AnnouncementModel(Base):
    __tablename__ = "announcements"
    id:              Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rt_group_id:     Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    created_by:      Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    title:           Mapped[str]       = mapped_column(String(255), nullable=False)
    body:            Mapped[str]       = mapped_column(String(2000), nullable=False)
    ann_type:        Mapped[str]       = mapped_column(String(20), default="info")
    channel:         Mapped[str]       = mapped_column(String(20), default="both")
    recipient_count: Mapped[int]       = mapped_column(Integer, default=0)
    created_at:      Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:      Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LaporanModel(Base):
    __tablename__ = "laporan_warga"
    id:               Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rt_group_id:      Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    resident_id:      Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), nullable=False)
    title:            Mapped[str]            = mapped_column(String(255), nullable=False)
    description:      Mapped[str]            = mapped_column(String(2000), default="")
    photo_url:        Mapped[str | None]     = mapped_column(String(500), nullable=True)
    status:           Mapped[str]            = mapped_column(String(20), default="open", index=True)
    resolved_by:      Mapped[uuid.UUID|None] = mapped_column(UUID(as_uuid=True), nullable=True)
    resolution_notes: Mapped[str]            = mapped_column(String(1000), default="")
    created_at:       Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:       Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
