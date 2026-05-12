"""Warga ORM models — production-grade schema."""
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base, TZDateTime


class ResidentModel(Base):
    __tablename__ = "residents"
    __table_args__ = (
        # One resident registration per user per RT group
        UniqueConstraint("rt_group_id", "user_id", name="uq_residents_rt_user"),
        # Fast lookup: active residents in an RT for invoice generation
        Index("ix_residents_rt_status", "rt_group_id", "status"),
    )

    id:             Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rt_group_id:    Mapped[uuid.UUID]      = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rt_groups.id", ondelete="RESTRICT"),   # can't delete RT with residents
        nullable=False, index=True,
    )
    user_id:        Mapped[uuid.UUID]      = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),        # delete user → delete their resident record
        nullable=False, index=True,
    )
    full_name:      Mapped[str]            = mapped_column(String(255), nullable=False)
    phone:          Mapped[str]            = mapped_column(String(20),  server_default="", nullable=False)
    nik:            Mapped[str | None]     = mapped_column(String(16),  nullable=True)
    street:         Mapped[str]            = mapped_column(String(255), server_default="", nullable=False)
    rt_number:      Mapped[str]            = mapped_column(String(10),  server_default="", nullable=False)
    rw_number:      Mapped[str]            = mapped_column(String(10),  server_default="", nullable=False)
    kelurahan:      Mapped[str]            = mapped_column(String(100), server_default="", nullable=False)
    kecamatan:      Mapped[str]            = mapped_column(String(100), server_default="", nullable=False)
    kota:           Mapped[str]            = mapped_column(String(100), server_default="", nullable=False)
    block:          Mapped[str]            = mapped_column(String(20),  server_default="", nullable=False)
    unit_number:    Mapped[str]            = mapped_column(String(20),  server_default="", nullable=False)
    ownership_type: Mapped[str]            = mapped_column(String(20),  server_default="owner",   nullable=False)
    status:         Mapped[str]            = mapped_column(String(20),  server_default="pending", nullable=False, index=True)
    member_count:   Mapped[int]            = mapped_column(Integer, server_default="1", nullable=False)
    kk_file_url:    Mapped[str | None]     = mapped_column(String(500), nullable=True)
    ktp_file_url:   Mapped[str | None]     = mapped_column(String(500), nullable=True)
    verified_at:    Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    verified_by:    Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
