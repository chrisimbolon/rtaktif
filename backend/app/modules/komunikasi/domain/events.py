from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID
from app.core.events import DomainEvent


@dataclass
class AnnouncementPublished(DomainEvent):
    announcement_id: UUID = None
    rt_group_id: UUID = None
    channel: str = ""
    occurred_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class LaporanSubmitted(DomainEvent):
    laporan_id: UUID = None
    resident_id: UUID = None
    rt_group_id: UUID = None
    title: str = ""
    occurred_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class LaporanResolved(DomainEvent):
    laporan_id: UUID = None
    resolved_by: UUID = None
    occurred_at: datetime = field(default_factory=datetime.utcnow)
