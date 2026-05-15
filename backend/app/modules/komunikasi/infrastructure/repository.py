"""PostgreSQL implementations — Komunikasi module repositories."""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.komunikasi.domain.entities import (
    Announcement, LaporanWarga, NotificationLog,
    AnnouncementType, DeliveryChannel, LaporanStatus,
    NotifType, TriggerType,
)
from app.modules.komunikasi.domain.repositories import (
    AnnouncementRepository, LaporanRepository, NotificationLogRepository,
)
from app.modules.komunikasi.infrastructure.models import (
    AnnouncementModel, LaporanModel, NotificationLogModel,
)


class PgAnnouncementRepository(AnnouncementRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, entity_id: UUID) -> Optional[Announcement]:
        row = await self.session.get(AnnouncementModel, entity_id)
        return self._to_entity(row) if row else None

    async def get_by_rt_group(self, rt_group_id: UUID, limit: int = 20) -> list[Announcement]:
        # Uses index: ix_announcements_rt_created
        result = await self.session.execute(
            select(AnnouncementModel)
            .where(AnnouncementModel.rt_group_id == rt_group_id)
            .order_by(AnnouncementModel.created_at.desc())
            .limit(limit)
        )
        return [self._to_entity(r) for r in result.scalars().all()]

    async def save(self, entity: Announcement) -> Announcement:
        existing = await self.session.get(AnnouncementModel, entity.id)
        if not existing:
            self.session.add(AnnouncementModel(
                id=entity.id,
                rt_group_id=entity.rt_group_id,
                created_by=entity.created_by,
                title=entity.title,
                body=entity.body,
                ann_type=entity.ann_type.value,
                channel=entity.channel.value,
                recipient_count=entity.recipient_count,
                created_at=entity.created_at,
                updated_at=entity.updated_at,
            ))
        await self.session.flush()
        return entity

    async def delete(self, entity_id: UUID) -> None:
        row = await self.session.get(AnnouncementModel, entity_id)
        if row:
            await self.session.delete(row)

    async def list_all(self) -> list[Announcement]:
        result = await self.session.execute(select(AnnouncementModel))
        return [self._to_entity(r) for r in result.scalars().all()]

    def _to_entity(self, row: AnnouncementModel) -> Announcement:
        return Announcement(
            id=row.id,
            rt_group_id=row.rt_group_id,
            created_by=row.created_by,
            title=row.title,
            body=row.body,
            ann_type=AnnouncementType(row.ann_type),
            channel=DeliveryChannel(row.channel),
            recipient_count=row.recipient_count,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


class PgLaporanRepository(LaporanRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, entity_id: UUID) -> Optional[LaporanWarga]:
        row = await self.session.get(LaporanModel, entity_id)
        return self._to_entity(row) if row else None

    async def get_by_rt_group(
        self, rt_group_id: UUID, status: Optional[LaporanStatus] = None
    ) -> list[LaporanWarga]:
        # Uses index: ix_laporan_rt_status
        q = select(LaporanModel).where(LaporanModel.rt_group_id == rt_group_id)
        if status:
            q = q.where(LaporanModel.status == status.value)
        result = await self.session.execute(
            q.order_by(LaporanModel.created_at.desc())
        )
        return [self._to_entity(r) for r in result.scalars().all()]

    async def get_by_resident(self, resident_id: UUID) -> list[LaporanWarga]:
        # Uses index: ix_laporan_resident
        result = await self.session.execute(
            select(LaporanModel)
            .where(LaporanModel.resident_id == resident_id)
            .order_by(LaporanModel.created_at.desc())
        )
        return [self._to_entity(r) for r in result.scalars().all()]

    async def save(self, entity: LaporanWarga) -> LaporanWarga:
        existing = await self.session.get(LaporanModel, entity.id)
        if existing:
            existing.status           = entity.status.value
            existing.resolved_by      = entity.resolved_by
            existing.resolved_at      = entity.resolved_at
            existing.resolution_notes = entity.resolution_notes
        else:
            self.session.add(LaporanModel(
                id=entity.id,
                rt_group_id=entity.rt_group_id,
                resident_id=entity.resident_id,
                title=entity.title,
                description=entity.description,
                photo_url=entity.photo_url,
                status=entity.status.value,
                resolved_by=entity.resolved_by,
                resolved_at=entity.resolved_at,
                resolution_notes=entity.resolution_notes,
                created_at=entity.created_at,
                updated_at=entity.updated_at,
            ))
        await self.session.flush()
        return entity

    async def delete(self, entity_id: UUID) -> None:
        row = await self.session.get(LaporanModel, entity_id)
        if row:
            await self.session.delete(row)

    async def list_all(self) -> list[LaporanWarga]:
        result = await self.session.execute(select(LaporanModel))
        return [self._to_entity(r) for r in result.scalars().all()]

    def _to_entity(self, row: LaporanModel) -> LaporanWarga:
        return LaporanWarga(
            id=row.id,
            rt_group_id=row.rt_group_id,
            resident_id=row.resident_id,
            title=row.title,
            description=row.description,
            photo_url=row.photo_url,
            status=LaporanStatus(row.status),
            resolved_by=row.resolved_by,
            resolved_at=row.resolved_at,
            resolution_notes=row.resolution_notes,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


class PgNotificationLogRepository(NotificationLogRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, entity_id: UUID) -> Optional[NotificationLog]:
        row = await self.session.get(NotificationLogModel, entity_id)
        return self._to_entity(row) if row else None

    async def get_by_rt_group(
        self, rt_group_id: UUID, limit: int = 50
    ) -> list[NotificationLog]:
        # Uses index: ix_notif_rt_sent_at
        result = await self.session.execute(
            select(NotificationLogModel)
            .where(NotificationLogModel.rt_group_id == rt_group_id)
            .order_by(NotificationLogModel.sent_at.desc())
            .limit(limit)
        )
        return [self._to_entity(r) for r in result.scalars().all()]

    async def save(self, entity: NotificationLog) -> NotificationLog:
        # Notification logs are immutable — insert only, never update
        existing = await self.session.get(NotificationLogModel, entity.id)
        if not existing:
            self.session.add(NotificationLogModel(
                id=entity.id,
                rt_group_id=entity.rt_group_id,
                sent_by=entity.sent_by,
                trigger_type=entity.trigger_type.value,
                trigger_id=entity.trigger_id,
                notif_type=entity.notif_type.value,
                recipient_count=entity.recipient_count,
                message_preview=entity.message_preview,
                status=entity.status,
                failed_count=entity.failed_count,
                error_detail=entity.error_detail,
                sent_at=entity.sent_at or datetime.now(timezone.utc),
                created_at=entity.created_at,
            ))
        await self.session.flush()
        return entity

    async def delete(self, entity_id: UUID) -> None:
        pass  # Notification logs are immutable — deletion not permitted

    async def list_all(self) -> list[NotificationLog]:
        result = await self.session.execute(select(NotificationLogModel))
        return [self._to_entity(r) for r in result.scalars().all()]

    def _to_entity(self, row: NotificationLogModel) -> NotificationLog:
        return NotificationLog(
            id=row.id,
            rt_group_id=row.rt_group_id,
            sent_by=row.sent_by,
            trigger_type=TriggerType(row.trigger_type),
            trigger_id=row.trigger_id,
            notif_type=NotifType(row.notif_type),
            recipient_count=row.recipient_count,
            message_preview=row.message_preview,
            status=row.status,
            failed_count=row.failed_count,
            error_detail=row.error_detail,
            sent_at=row.sent_at,
            created_at=row.created_at,
        )
