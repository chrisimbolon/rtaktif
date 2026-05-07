"""SQLAlchemy ORM models for IAM module."""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class UserModel(Base):
    __tablename__ = "users"

    id:              Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email:           Mapped[str]             = mapped_column(String(255), unique=True, nullable=False, index=True)
    phone:           Mapped[str]             = mapped_column(String(20), nullable=False)
    hashed_password: Mapped[str]             = mapped_column(String(255), nullable=False)
    full_name:       Mapped[str]             = mapped_column(String(255), nullable=False)
    role:            Mapped[str]             = mapped_column(String(50), default="warga", index=True)
    status:          Mapped[str]             = mapped_column(String(50), default="pending", index=True)
    rt_group_id:     Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    created_at:      Mapped[datetime]        = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:      Mapped[datetime]        = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RTGroupModel(Base):
    __tablename__ = "rt_groups"

    id:              Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rt_number:       Mapped[str]       = mapped_column(String(10), nullable=False)
    rw_number:       Mapped[str]       = mapped_column(String(10), nullable=False)
    kelurahan:       Mapped[str]       = mapped_column(String(100))
    kecamatan:       Mapped[str]       = mapped_column(String(100))
    kota:            Mapped[str]       = mapped_column(String(100))
    provinsi:        Mapped[str]       = mapped_column(String(100), default="Bengkulu")
    admin_user_id:   Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    monthly_fee_idr: Mapped[int]       = mapped_column(Integer, default=30_000)
    created_at:      Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:      Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
