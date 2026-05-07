from typing import Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.komunikasi.domain.entities import (
    Announcement, LaporanWarga, AnnouncementType, DeliveryChannel, LaporanStatus
)
from app.modules.komunikasi.domain.repositories import AnnouncementRepository, LaporanRepository
from app.modules.komunikasi.infrastructure.models import AnnouncementModel, LaporanModel


class PgAnnouncementRepository(AnnouncementRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, entity_id: UUID) -> Optional[Announcement]:
        row = await self.session.get(AnnouncementModel, entity_id)
        return self._to_entity(row) if row else None

    async def get_by_rt_group(self, rt_group_id: UUID, limit: int = 20) -> list[Announcement]:
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
                id=entity.id, rt_group_id=entity.rt_group_id, created_by=entity.created_by,
                title=entity.title, body=entity.body, ann_type=entity.ann_type.value,
                channel=entity.channel.value, recipient_count=entity.recipient_count,
                created_at=entity.created_at, updated_at=entity.updated_at,
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
            id=row.id, rt_group_id=row.rt_group_id, created_by=row.created_by,
            title=row.title, body=row.body,
            ann_type=AnnouncementType(row.ann_type),
            channel=DeliveryChannel(row.channel),
            recipient_count=row.recipient_count,
            created_at=row.created_at, updated_at=row.updated_at,
        )


class PgLaporanRepository(LaporanRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, entity_id: UUID) -> Optional[LaporanWarga]:
        row = await self.session.get(LaporanModel, entity_id)
        return self._to_entity(row) if row else None

    async def get_by_rt_group(self, rt_group_id: UUID, status=None) -> list[LaporanWarga]:
        q = select(LaporanModel).where(LaporanModel.rt_group_id == rt_group_id)
        if status:
            q = q.where(LaporanModel.status == status.value)
        result = await self.session.execute(q.order_by(LaporanModel.created_at.desc()))
        return [self._to_entity(r) for r in result.scalars().all()]

    async def get_by_resident(self, resident_id: UUID) -> list[LaporanWarga]:
        result = await self.session.execute(
            select(LaporanModel).where(LaporanModel.resident_id == resident_id)
        )
        return [self._to_entity(r) for r in result.scalars().all()]

    async def save(self, entity: LaporanWarga) -> LaporanWarga:
        existing = await self.session.get(LaporanModel, entity.id)
        if existing:
            existing.status           = entity.status.value
            existing.resolved_by      = entity.resolved_by
            existing.resolution_notes = entity.resolution_notes
        else:
            self.session.add(LaporanModel(
                id=entity.id, rt_group_id=entity.rt_group_id,
                resident_id=entity.resident_id, title=entity.title,
                description=entity.description, photo_url=entity.photo_url,
                status=entity.status.value, created_at=entity.created_at,
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
            id=row.id, rt_group_id=row.rt_group_id, resident_id=row.resident_id,
            title=row.title, description=row.description, photo_url=row.photo_url,
            status=LaporanStatus(row.status), resolved_by=row.resolved_by,
            resolution_notes=row.resolution_notes,
            created_at=row.created_at, updated_at=row.updated_at,
        )
