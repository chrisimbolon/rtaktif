"""Komunikasi domain entities — updated with resolved_at."""
from dataclasses import dataclass
from datetime import datetime, timezone
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
    APP      = "app"
    WHATSAPP = "whatsapp"
    BOTH     = "both"


class LaporanStatus(str, Enum):
    OPEN        = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED    = "resolved"


class NotifType(str, Enum):
    WHATSAPP = "whatsapp"
    PUSH     = "push"
    BOTH     = "both"


class TriggerType(str, Enum):
    INVOICE_REMINDER = "invoice_reminder"
    ANNOUNCEMENT     = "announcement"
    MANUAL_BLAST     = "manual_blast"


@dataclass
class Announcement(BaseEntity):
    rt_group_id:     Optional[UUID]          = None
    created_by:      Optional[UUID]          = None
    title:           str                     = ""
    body:            str                     = ""
    ann_type:        AnnouncementType        = AnnouncementType.INFO
    channel:         DeliveryChannel         = DeliveryChannel.BOTH
    recipient_count: int                     = 0

    @classmethod
    def publish(
        cls,
        rt_group_id: UUID,
        created_by: UUID,
        title: str,
        body: str,
        ann_type: AnnouncementType,
        channel: DeliveryChannel,
        recipient_count: int = 0,
    ) -> "Announcement":
        ann = cls(
            rt_group_id=rt_group_id, created_by=created_by,
            title=title, body=body, ann_type=ann_type,
            channel=channel, recipient_count=recipient_count,
        )
        ann.add_event(AnnouncementPublished(
            announcement_id=ann.id,
            rt_group_id=rt_group_id,
            channel=channel.value,
        ))
        return ann


@dataclass
class LaporanWarga(BaseEntity):
    rt_group_id:      Optional[UUID]          = None
    resident_id:      Optional[UUID]          = None
    title:            str                     = ""
    description:      str                     = ""
    photo_url:        Optional[str]           = None
    status:           LaporanStatus           = LaporanStatus.OPEN
    resolved_by:      Optional[UUID]          = None
    resolved_at:      Optional[datetime]      = None   # NEW — when it was resolved
    resolution_notes: str                     = ""

    @classmethod
    def submit(
        cls,
        rt_group_id: UUID,
        resident_id: UUID,
        title: str,
        description: str,
        photo_url: Optional[str] = None,
    ) -> "LaporanWarga":
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
        self.status           = LaporanStatus.RESOLVED
        self.resolved_by      = resolved_by
        self.resolved_at      = datetime.now(timezone.utc)
        self.resolution_notes = notes
        self.add_event(LaporanResolved(laporan_id=self.id, resolved_by=resolved_by))


@dataclass
class NotificationLog(BaseEntity):
    """
    Immutable audit record — created once, never updated.
    Answers: did the WA blast go out? to whom? when? did it succeed?
    """
    rt_group_id:      Optional[UUID]     = None
    sent_by:          Optional[UUID]     = None
    trigger_type:     TriggerType        = TriggerType.MANUAL_BLAST
    trigger_id:       Optional[UUID]     = None
    notif_type:       NotifType          = NotifType.WHATSAPP
    recipient_count:  int                = 0
    message_preview:  str                = ""
    status:           str                = "sent"   # "sent" | "failed" | "partial"
    failed_count:     int                = 0
    error_detail:     Optional[str]      = None
    sent_at:          Optional[datetime] = None

    @classmethod
    def record(
        cls,
        rt_group_id: UUID,
        sent_by: UUID,
        trigger_type: TriggerType,
        notif_type: NotifType,
        recipient_count: int,
        message_preview: str,
        sent_at: Optional[datetime] = None,
        trigger_id: Optional[UUID] = None,
        status: str = "sent",
        failed_count: int = 0,
        error_detail: Optional[str] = None,
    ) -> "NotificationLog":
        return cls(
            rt_group_id=rt_group_id,
            sent_by=sent_by,
            trigger_type=trigger_type,
            trigger_id=trigger_id,
            notif_type=notif_type,
            recipient_count=recipient_count,
            message_preview=message_preview[:200],
            status=status,
            failed_count=failed_count,
            error_detail=error_detail,
            sent_at=sent_at or datetime.now(timezone.utc),
        )
