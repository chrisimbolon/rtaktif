from typing import Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.warga.domain.entities import Resident, ResidentStatus, OwnershipType
from app.modules.warga.domain.repositories import ResidentRepository
from app.modules.warga.infrastructure.models import ResidentModel


class PgResidentRepository(ResidentRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, entity_id: UUID) -> Optional[Resident]:
        row = await self.session.get(ResidentModel, entity_id)
        return self._to_entity(row) if row else None

    async def get_by_user_id(self, user_id: UUID) -> Optional[Resident]:
        result = await self.session.execute(
            select(ResidentModel).where(ResidentModel.user_id == user_id)
        )
        row = result.scalar_one_or_none()
        return self._to_entity(row) if row else None

    async def get_by_rt_group(self, rt_group_id: UUID, status=None) -> list[Resident]:
        q = select(ResidentModel).where(ResidentModel.rt_group_id == rt_group_id)
        if status:
            q = q.where(ResidentModel.status == status.value)
        result = await self.session.execute(q)
        return [self._to_entity(r) for r in result.scalars().all()]

    async def count_active_by_rt(self, rt_group_id: UUID) -> int:
        rows = await self.get_by_rt_group(rt_group_id, ResidentStatus.ACTIVE)
        return len(rows)

    async def save(self, entity: Resident) -> Resident:
        existing = await self.session.get(ResidentModel, entity.id)
        if existing:
            existing.status = entity.status.value
            existing.kk_file_url = entity.kk_file_url
            existing.ktp_file_url = entity.ktp_file_url
            existing.member_count = entity.member_count
            existing.phone = entity.phone
        else:
            self.session.add(ResidentModel(
                id=entity.id, rt_group_id=entity.rt_group_id,
                user_id=entity.user_id, full_name=entity.full_name,
                phone=entity.phone, nik=entity.nik,
                street=entity.street, rt_number=entity.rt_number,
                rw_number=entity.rw_number, kelurahan=entity.kelurahan,
                kecamatan=entity.kecamatan, kota=entity.kota,
                block=entity.block, unit_number=entity.unit_number,
                ownership_type=entity.ownership_type.value,
                status=entity.status.value, member_count=entity.member_count,
                created_at=entity.created_at, updated_at=entity.updated_at,
            ))
        await self.session.flush()
        return entity

    async def delete(self, entity_id: UUID) -> None:
        row = await self.session.get(ResidentModel, entity_id)
        if row:
            await self.session.delete(row)

    async def list_all(self) -> list[Resident]:
        result = await self.session.execute(select(ResidentModel))
        return [self._to_entity(r) for r in result.scalars().all()]

    def _to_entity(self, row: ResidentModel) -> Resident:
        return Resident(
            id=row.id, rt_group_id=row.rt_group_id, user_id=row.user_id,
            full_name=row.full_name, phone=row.phone, nik=row.nik,
            street=row.street, rt_number=row.rt_number, rw_number=row.rw_number,
            kelurahan=row.kelurahan, kecamatan=row.kecamatan, kota=row.kota,
            block=row.block, unit_number=row.unit_number,
            ownership_type=OwnershipType(row.ownership_type),
            status=ResidentStatus(row.status),
            member_count=row.member_count,
            kk_file_url=row.kk_file_url, ktp_file_url=row.ktp_file_url,
            created_at=row.created_at, updated_at=row.updated_at,
        )
