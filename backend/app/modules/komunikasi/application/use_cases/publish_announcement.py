"""Use case: Admin publishes an announcement to all warga."""
from uuid import UUID
from app.core.events import event_bus
from app.modules.komunikasi.domain.entities import Announcement, AnnouncementType, DeliveryChannel
from app.modules.komunikasi.domain.repositories import AnnouncementRepository


class PublishAnnouncement:
    def __init__(self, repo: AnnouncementRepository):
        self.repo = repo

    async def execute(
        self, rt_group_id: UUID, created_by: UUID, title: str, body: str,
        ann_type: AnnouncementType = AnnouncementType.INFO,
        channel: DeliveryChannel = DeliveryChannel.BOTH,
        recipient_count: int = 0,
    ) -> Announcement:
        ann = Announcement.publish(
            rt_group_id=rt_group_id, created_by=created_by,
            title=title, body=body, ann_type=ann_type,
            channel=channel, recipient_count=recipient_count,
        )
        saved = await self.repo.save(ann)
        for event in saved.pull_events():
            await event_bus.publish(event)
        return saved
