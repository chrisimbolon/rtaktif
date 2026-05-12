"""Unit tests — Komunikasi entities including NotificationLog."""
import pytest
from uuid import uuid4
from datetime import datetime, timezone

from app.modules.komunikasi.domain.entities import (
    Announcement, LaporanWarga, NotificationLog,
    AnnouncementType, DeliveryChannel, LaporanStatus,
    NotifType, TriggerType,
)
from app.modules.komunikasi.domain.events import (
    AnnouncementPublished, LaporanSubmitted, LaporanResolved,
)
from app.core.exceptions import InvalidStateTransitionError


def test_publish_announcement_emits_event():
    ann = Announcement.publish(
        rt_group_id=uuid4(), created_by=uuid4(),
        title="Kerja Bakti", body="Ayo kerja bakti besok!",
        ann_type=AnnouncementType.EVENT, channel=DeliveryChannel.BOTH,
    )
    events = ann.pull_events()
    assert isinstance(events[0], AnnouncementPublished)
    assert events[0].channel == "both"


def test_submit_laporan_sets_open_status():
    l = LaporanWarga.submit(
        rt_group_id=uuid4(), resident_id=uuid4(),
        title="Lampu mati", description="Lampu jalan sudah 3 hari mati.",
    )
    assert l.status == LaporanStatus.OPEN
    assert l.resolved_at is None


def test_resolve_sets_resolved_at_timezone_aware():
    l = LaporanWarga.submit(uuid4(), uuid4(), "Test", "Test description here")
    l.resolve(resolved_by=uuid4(), notes="Fixed.")
    assert l.status == LaporanStatus.RESOLVED
    assert l.resolved_at is not None
    assert l.resolved_at.tzinfo is not None


def test_cannot_resolve_twice():
    l = LaporanWarga.submit(uuid4(), uuid4(), "Test", "Test description here")
    l.resolve(resolved_by=uuid4(), notes="First.")
    with pytest.raises(InvalidStateTransitionError):
        l.resolve(resolved_by=uuid4(), notes="Second.")


def test_notification_log_truncates_preview():
    log = NotificationLog.record(
        rt_group_id=uuid4(), sent_by=uuid4(),
        trigger_type=TriggerType.MANUAL_BLAST,
        notif_type=NotifType.WHATSAPP,
        recipient_count=1, message_preview="A" * 300,
    )
    assert len(log.message_preview) == 200


def test_notification_log_records_failure():
    log = NotificationLog.record(
        rt_group_id=uuid4(), sent_by=uuid4(),
        trigger_type=TriggerType.INVOICE_REMINDER,
        notif_type=NotifType.WHATSAPP,
        recipient_count=5, message_preview="Test",
        status="failed", failed_count=5,
        error_detail="Rate limit exceeded",
    )
    assert log.status == "failed"
    assert log.failed_count == 5
