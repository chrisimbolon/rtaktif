"""PostgreSQL implementations of IAM repositories — updated for production schema."""
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.iam.domain.entities import User, RTGroup, UserRole, UserStatus
from app.modules.iam.domain.repositories import UserRepository, RTGroupRepository
from app.modules.iam.infrastructure.models import UserModel, RTGroupModel


class PgUserRepository(UserRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, entity_id: UUID) -> Optional[User]:
        row = await self.session.get(UserModel, entity_id)
        return self._to_entity(row) if row else None

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(
            select(UserModel).where(UserModel.email == email)
        )
        row = result.scalar_one_or_none()
        return self._to_entity(row) if row else None

    async def exists_by_email(self, email: str) -> bool:
        return await self.get_by_email(email) is not None

    async def get_by_rt_group(self, rt_group_id: UUID) -> list[User]:
        result = await self.session.execute(
            select(UserModel).where(UserModel.rt_group_id == rt_group_id)
        )
        return [self._to_entity(r) for r in result.scalars().all()]

    async def save(self, entity: User) -> User:
        existing = await self.session.get(UserModel, entity.id)
        if existing:
            existing.email            = entity.email
            existing.phone            = entity.phone
            existing.hashed_password  = entity.hashed_password
            existing.full_name        = entity.full_name
            existing.role             = entity.role.value
            existing.status           = entity.status.value
            existing.rt_group_id      = entity.rt_group_id
        else:
            self.session.add(UserModel(
                id=entity.id,
                email=entity.email,
                phone=entity.phone,
                hashed_password=entity.hashed_password,
                full_name=entity.full_name,
                role=entity.role.value,
                status=entity.status.value,
                rt_group_id=entity.rt_group_id,
                created_at=entity.created_at,
                updated_at=entity.updated_at,
            ))
        await self.session.flush()
        return entity

    async def delete(self, entity_id: UUID) -> None:
        row = await self.session.get(UserModel, entity_id)
        if row:
            await self.session.delete(row)

    async def list_all(self) -> list[User]:
        result = await self.session.execute(select(UserModel))
        return [self._to_entity(r) for r in result.scalars().all()]

    def _to_entity(self, row: UserModel) -> User:
        return User(
            id=row.id,
            email=row.email,
            phone=row.phone,
            hashed_password=row.hashed_password,
            full_name=row.full_name,
            role=UserRole(row.role),
            status=UserStatus(row.status),
            rt_group_id=row.rt_group_id,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


class PgRTGroupRepository(RTGroupRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, entity_id: UUID) -> Optional[RTGroup]:
        row = await self.session.get(RTGroupModel, entity_id)
        return self._to_entity(row) if row else None

    async def get_by_admin(self, admin_user_id: UUID) -> Optional[RTGroup]:
        result = await self.session.execute(
            select(RTGroupModel).where(RTGroupModel.admin_user_id == admin_user_id)
        )
        row = result.scalar_one_or_none()
        return self._to_entity(row) if row else None

    async def save(self, entity: RTGroup) -> RTGroup:
        existing = await self.session.get(RTGroupModel, entity.id)
        if existing:
            existing.monthly_fee_idr = entity.monthly_fee_idr
            existing.is_active       = True
        else:
            self.session.add(RTGroupModel(
                id=entity.id,
                rt_number=entity.rt_number,
                rw_number=entity.rw_number,
                kelurahan=entity.kelurahan,
                kecamatan=entity.kecamatan,
                kota=entity.kota,
                provinsi=entity.provinsi,
                admin_user_id=entity.admin_user_id,
                monthly_fee_idr=entity.monthly_fee_idr,
                is_active=True,
                created_at=entity.created_at,
                updated_at=entity.updated_at,
            ))
        await self.session.flush()
        return entity

    async def delete(self, entity_id: UUID) -> None:
        row = await self.session.get(RTGroupModel, entity_id)
        if row:
            await self.session.delete(row)

    async def list_all(self) -> list[RTGroup]:
        result = await self.session.execute(select(RTGroupModel))
        return [self._to_entity(r) for r in result.scalars().all()]

    def _to_entity(self, row: RTGroupModel) -> RTGroup:
        return RTGroup(
            id=row.id,
            rt_number=row.rt_number,
            rw_number=row.rw_number,
            kelurahan=row.kelurahan,
            kecamatan=row.kecamatan,
            kota=row.kota,
            provinsi=row.provinsi,
            admin_user_id=row.admin_user_id,
            monthly_fee_idr=row.monthly_fee_idr,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
