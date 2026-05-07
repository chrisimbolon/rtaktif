from dataclasses import dataclass
from enum import Enum
from typing import Optional
from uuid import UUID
from app.core.base_entity import BaseEntity
from app.core.exceptions import InvalidStateTransitionError
from app.modules.komunikasi.domain.events import (
    AnnouncementPublished, LaporanSubmitted, LaporanResolved
)


class AnnouncementType(str, Enum):
    INFO   = "info"
    URGENT = "urgent"
    EVENT  = "event"


class DeliveryChannel(str, Enum):
    APP       = "app"
    WHATSAPP  = "whatsapp"
    BOTH      = "both"


class LaporanStatus(str, Enum):
    OPEN        = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED    = "resolved"


@dataclass
class Announcement(BaseEntity):
    rt_group_id: Optional[UUID] = None
    created_by: Optional[UUID] = None
    title: str = ""
    body: str = ""
    ann_type: AnnouncementType = AnnouncementType.INFO
    channel: DeliveryChannel = DeliveryChannel.BOTH
    recipient_count: int = 0

    @classmethod
    def publish(cls, rt_group_id: UUID, created_by: UUID, title: str,
                body: str, ann_type: AnnouncementType,
                channel: DeliveryChannel, recipient_count: int = 0) -> "Announcement":
        ann = cls(
            rt_group_id=rt_group_id, created_by=created_by, title=title,
            body=body, ann_type=ann_type, channel=channel,
            recipient_count=recipient_count,
        )
        ann.add_event(AnnouncementPublished(
            announcement_id=ann.id, rt_group_id=rt_group_id, channel=channel.value,
        ))
        return ann


@dataclass
class LaporanWarga(BaseEntity):
    rt_group_id: Optional[UUID] = None
    resident_id: Optional[UUID] = None
    title: str = ""
    description: str = ""
    photo_url: Optional[str] = None
    status: LaporanStatus = LaporanStatus.OPEN
    resolved_by: Optional[UUID] = None
    resolution_notes: str = ""

    @classmethod
    def submit(cls, rt_group_id: UUID, resident_id: UUID, title: str,
               description: str, photo_url: Optional[str] = None) -> "LaporanWarga":
        laporan = cls(
            rt_group_id=rt_group_id, resident_id=resident_id,
            title=title, description=description, photo_url=photo_url,
        )
        laporan.add_event(LaporanSubmitted(
            laporan_id=laporan.id, resident_id=resident_id,
            rt_group_id=rt_group_id, title=title,
        ))
        return laporan

    def start_progress(self) -> None:
        if self.status != LaporanStatus.OPEN:
            raise InvalidStateTransitionError("Laporan bukan dalam status OPEN")
        self.status = LaporanStatus.IN_PROGRESS

    def resolve(self, resolved_by: UUID, notes: str = "") -> None:
        if self.status == LaporanStatus.RESOLVED:
            raise InvalidStateTransitionError("Laporan sudah diselesaikan")
        self.status = LaporanStatus.RESOLVED
        self.resolved_by = resolved_by
        self.resolution_notes = notes
        self.add_event(LaporanResolved(laporan_id=self.id, resolved_by=resolved_by))
