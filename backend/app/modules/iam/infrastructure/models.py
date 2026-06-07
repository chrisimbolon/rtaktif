"""IAM infrastructure models — SQLAlchemy ORM layer.

These are the only classes allowed to know about the DB schema.
The domain layer (entities.py) is completely unaware of SQLAlchemy.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from app.core.database import Base, TZDateTime
from app.modules.iam.domain.entities import RTVerificationStatus
from sqlalchemy import (Boolean, Date, Enum, Float, ForeignKey, Index, Integer,
                        String, Text, UniqueConstraint)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func


class UserModel(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("phone", name="uq_users_phone"),
        Index("ix_users_role_status", "role", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), server_default="warga", nullable=False)
    status: Mapped[str] = mapped_column(String(50), server_default="pending", nullable=False)
    rt_group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rt_groups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class RTGroupModel(Base):
    __tablename__ = "rt_groups"
    __table_args__ = (
        # ── Canonical identity constraint (5-tuple) ────────────────────────
        # Replaces the old uq_rt_groups_location which was missing kecamatan.
        # This is the DB-level guard against RT squatting and duplicate claims.
        UniqueConstraint(
            "rt_number", "rw_number", "kelurahan", "kecamatan", "kota",
            name="uq_rt_groups_identity",
        ),
        # ── Operational indexes ────────────────────────────────────────────
        # Superadmin verification queue: WHERE verification_status = 'pending_verification'
        Index("ix_rt_groups_verification_status", "verification_status"),
        # SK expiry sweep: WHERE sk_valid_until <= :cutoff AND verification_status = 'active'
        Index("ix_rt_groups_sk_expiry", "sk_valid_until", "verification_status"),
    )

    # ── Primary key ───────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Geographic identity (5-tuple) ─────────────────────────────────────
    rt_number:  Mapped[str] = mapped_column(String(10),  nullable=False)
    rw_number:  Mapped[str] = mapped_column(String(10),  nullable=False)
    kelurahan:  Mapped[str] = mapped_column(String(100), nullable=False)
    kecamatan:  Mapped[str] = mapped_column(String(100), nullable=False)
    kota:       Mapped[str] = mapped_column(String(100), nullable=False)
    provinsi:   Mapped[str] = mapped_column(
        String(100), server_default="Indonesia", nullable=False
    )

    # ── Ownership ─────────────────────────────────────────────────────────
    # No FK to users intentionally — the admin_user_id is the Ketua RT's
    # user.id, but we don't FK it so that a superadmin can transfer ownership
    # without cascading deletes.
    admin_user_id:    Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    monthly_fee_idr:  Mapped[int]       = mapped_column(Integer, server_default="30000", nullable=False)
    is_active:        Mapped[bool]      = mapped_column(Boolean, server_default="true", nullable=False)

    # ── Verification state machine ─────────────────────────────────────────
    verification_status: Mapped[str] = mapped_column(
        Enum(
            *[s.value for s in RTVerificationStatus],
            name="rt_verification_status",
        ),
        server_default=RTVerificationStatus.PENDING_VERIFICATION.value,
        nullable=False,
    )
    sk_document_url:  Mapped[str | None] = mapped_column(Text, nullable=True)
    sk_valid_until:   Mapped[datetime | None] = mapped_column(Date, nullable=True)

    # ── Verification audit trail ───────────────────────────────────────────
    verified_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL", name="fk_rt_groups_verified_by"),
        nullable=True,
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    ktp_document_url:   Mapped[str | None]  = mapped_column(Text,    nullable=True)
    ktp_ocr_data:       Mapped[dict | None] = mapped_column(JSONB,   nullable=True)
    ktp_ocr_flags:      Mapped[list | None] = mapped_column(ARRAY(String), nullable=True, server_default="{}")
    ktp_ocr_confidence: Mapped[float | None] = mapped_column(Float,  nullable=True)
    ktp_verified:       Mapped[bool]         = mapped_column(Boolean, nullable=False, server_default="false")
    ktp_verified_at:    Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    ktp_verified_by:    Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL", name="fk_rt_groups_ktp_verified_by"),
        nullable=True,
    )
    sk_notes:           Mapped[str | None]  = mapped_column(Text,    nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
