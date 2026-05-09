from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID
from app.core.events import DomainEvent


@dataclass
class ResidentRegistered(DomainEvent):
    resident_id: UUID = None
    rt_group_id: UUID = None
    full_name: str = ""
    occurred_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ResidentVerified(DomainEvent):
    resident_id: UUID = None
    verified_by: UUID = None
    occurred_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ResidentMovedOut(DomainEvent):
    resident_id: UUID = None
    rt_group_id: UUID = None
    occurred_at: datetime = field(default_factory=datetime.utcnow)
