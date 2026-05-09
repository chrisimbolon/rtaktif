import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class ResidentModel(Base):
    __tablename__ = "residents"

    id:             Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rt_group_id:    Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    user_id:        Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    full_name:      Mapped[str]            = mapped_column(String(255), nullable=False)
    phone:          Mapped[str]            = mapped_column(String(20), default="")
    nik:            Mapped[str | None]     = mapped_column(String(16), nullable=True)
    street:         Mapped[str]            = mapped_column(String(255), default="")
    rt_number:      Mapped[str]            = mapped_column(String(10), default="")
    rw_number:      Mapped[str]            = mapped_column(String(10), default="")
    kelurahan:      Mapped[str]            = mapped_column(String(100), default="")
    kecamatan:      Mapped[str]            = mapped_column(String(100), default="")
    kota:           Mapped[str]            = mapped_column(String(100), default="")
    block:          Mapped[str]            = mapped_column(String(20), default="")
    unit_number:    Mapped[str]            = mapped_column(String(20), default="")
    ownership_type: Mapped[str]            = mapped_column(String(20), default="owner")
    status:         Mapped[str]            = mapped_column(String(20), default="pending", index=True)
    member_count:   Mapped[int]            = mapped_column(Integer, default=1)
    kk_file_url:    Mapped[str | None]     = mapped_column(String(500), nullable=True)
    ktp_file_url:   Mapped[str | None]     = mapped_column(String(500), nullable=True)
    created_at:     Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:     Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
