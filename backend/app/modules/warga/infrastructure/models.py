"""Warga ORM models — enriched with Indonesian RT profile fields."""
import uuid
from datetime import date, datetime

from app.core.database import Base, TZDateTime
from sqlalchemy import (Boolean, Date, ForeignKey, Index, Integer, String,
                        Text, UniqueConstraint)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func


class ResidentModel(Base):
    __tablename__ = "residents"
    __table_args__ = (
        # UniqueConstraint("rt_group_id", "user_id", name="uq_residents_rt_user"),
        Index("ix_residents_rt_status",     "rt_group_id", "status"),
        Index("ix_residents_status_tinggal","status_tinggal"),
        Index("ix_residents_no_kk",         "no_kk"),
    )

    id:             Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rt_group_id:    Mapped[uuid.UUID]       = mapped_column(
        UUID(as_uuid=True), ForeignKey("rt_groups.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    user_id:        Mapped[uuid.UUID | None]       = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True, index=True,
    )

    is_anggota_kk:    Mapped[bool]           = mapped_column(Boolean, server_default="false", nullable=False)
    added_by_user_id: Mapped[uuid.UUID | None]= mapped_column(UUID(as_uuid=True), nullable=True)

    # ── Core identity ──────────────────────────────────────────────
    full_name:      Mapped[str]             = mapped_column(String(255), nullable=False)
    phone:          Mapped[str]             = mapped_column(String(20),  server_default="", nullable=False)
    nik:            Mapped[str | None]      = mapped_column(String(16),  nullable=True)
    no_kk:          Mapped[str | None]      = mapped_column(String(16),  nullable=True)

    # ── KTP fields ────────────────────────────────────────────────
    tanggal_lahir:  Mapped[date | None]     = mapped_column(Date,        nullable=True)
    tempat_lahir:   Mapped[str | None]      = mapped_column(String(100), nullable=True)
    jenis_kelamin:  Mapped[str | None]      = mapped_column(String(20),  nullable=True)
    agama:          Mapped[str | None]      = mapped_column(String(20),  nullable=True)
    alamat_ktp:     Mapped[str | None]      = mapped_column(Text,        nullable=True)

    # ── Education + citizenship ───────────────────────────────────────────────
    pendidikan_terakhir: Mapped[str | None] = mapped_column(String(30), nullable=True)
    kewarganegaraan:     Mapped[str]        = mapped_column(String(10), server_default="WNI", nullable=False)
    hubungan_dengan_kk:  Mapped[str | None] = mapped_column(String(30), nullable=True)

    # ── Socioeconomic ─────────────────────────────────────────────
    pekerjaan:      Mapped[str | None]      = mapped_column(String(50),  nullable=True)
    status_kawin:   Mapped[str | None]      = mapped_column(String(20),  nullable=True)

    # ── RT-specific ───────────────────────────────────────────────
    status_tinggal:  Mapped[str]            = mapped_column(String(20),  server_default="TETAP", nullable=False)
    status_keluarga: Mapped[str | None]     = mapped_column(String(20),  nullable=True)
    kepala_keluarga: Mapped[bool]           = mapped_column(Boolean,     server_default="false", nullable=False)

    # ── Address ───────────────────────────────────────────────────
    street:         Mapped[str]             = mapped_column(String(255), server_default="", nullable=False)
    rt_number:      Mapped[str]             = mapped_column(String(10),  server_default="", nullable=False)
    rw_number:      Mapped[str]             = mapped_column(String(10),  server_default="", nullable=False)
    kelurahan:      Mapped[str]             = mapped_column(String(100), server_default="", nullable=False)
    kecamatan:      Mapped[str]             = mapped_column(String(100), server_default="", nullable=False)
    kota:           Mapped[str]             = mapped_column(String(100), server_default="", nullable=False)
    block:          Mapped[str]             = mapped_column(String(20),  server_default="", nullable=False)
    unit_number:    Mapped[str]             = mapped_column(String(20),  server_default="", nullable=False)

    # ── Ownership + status ────────────────────────────────────────
    ownership_type: Mapped[str]             = mapped_column(String(20),  server_default="owner",   nullable=False)
    status:         Mapped[str]             = mapped_column(String(20),  server_default="pending", nullable=False, index=True)
    member_count:   Mapped[int]             = mapped_column(Integer,     server_default="1",       nullable=False)

    # ── Documents ─────────────────────────────────────────────────
    kk_file_url:    Mapped[str | None]      = mapped_column(String(500), nullable=True)
    ktp_file_url:   Mapped[str | None]      = mapped_column(String(500), nullable=True)

    # ── Verification ─────────────────────────────────────────────
    verified_at:    Mapped[datetime | None] = mapped_column(TZDateTime,  nullable=True)
    verified_by:    Mapped[uuid.UUID | None]= mapped_column(UUID(as_uuid=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class ResidentChangeLogModel(Base):
    """
    Immutable audit log for all resident profile changes.
    Append-only — never updated or deleted.
    Created by PATCH /warga/{id}/admin-update.
    """
    __tablename__ = "resident_change_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    resident_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("residents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rt_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    changed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    changed_by_role: Mapped[str] = mapped_column(String(30), nullable=False)
    changed_by_name: Mapped[str] = mapped_column(String(255), nullable=False, server_default="")
    resident_name:   Mapped[str] = mapped_column(String(255), nullable=False, server_default="")
    field_name:  Mapped[str]      = mapped_column(String(50),  nullable=False)
    field_label: Mapped[str]      = mapped_column(String(100), nullable=False, server_default="")
    old_value:   Mapped[str|None] = mapped_column(Text, nullable=True)
    new_value:   Mapped[str|None] = mapped_column(Text, nullable=True)
    changed_at:  Mapped[datetime] = mapped_column(
        TZDateTime, server_default=func.now(), nullable=False
    )