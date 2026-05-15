"""IAM ORM models — production-grade schema."""
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base, TZDateTime


class UserModel(Base):
    __tablename__ = "users"
    __table_args__ = (
        # One phone per account
        UniqueConstraint("phone", name="uq_users_phone"),
        Index("ix_users_role_status", "role", "status"),
    )

    id:              Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email:           Mapped[str]             = mapped_column(String(255), unique=True, nullable=False, index=True)
    phone:           Mapped[str]             = mapped_column(String(20),  nullable=False)
    hashed_password: Mapped[str]             = mapped_column(String(255), nullable=False)
    full_name:       Mapped[str]             = mapped_column(String(255), nullable=False)
    role:            Mapped[str]             = mapped_column(String(50),  server_default="warga",   index=True)
    status:          Mapped[str]             = mapped_column(String(50),  server_default="pending", index=True)
    rt_group_id:     Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rt_groups.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    created_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class RTGroupModel(Base):
    __tablename__ = "rt_groups"
    __table_args__ = (
        # RT 05 / RW 02 in Bengkulu must be unique
        UniqueConstraint("rt_number", "rw_number", "kelurahan", "kota", name="uq_rt_groups_location"),
    )

    id:              Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rt_number:       Mapped[str]       = mapped_column(String(10),  nullable=False)
    rw_number:       Mapped[str]       = mapped_column(String(10),  nullable=False)
    kelurahan:       Mapped[str]       = mapped_column(String(100), nullable=False)
    kecamatan:       Mapped[str]       = mapped_column(String(100), nullable=False)
    kota:            Mapped[str]       = mapped_column(String(100), nullable=False)
    provinsi:        Mapped[str]       = mapped_column(String(100), server_default="Bengkulu", nullable=False)
    admin_user_id:   Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)  # no FK — avoids circular
    monthly_fee_idr: Mapped[int]       = mapped_column(Integer, server_default="30000", nullable=False)
    is_active:       Mapped[bool]      = mapped_column(server_default="true", nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
