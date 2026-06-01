"""IAM PostgreSQL repository implementations.

Only this layer is allowed to import SQLAlchemy / ORM models.
All public methods speak domain types (entities + value objects).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from app.modules.iam.domain.entities import (RTGroup, RTIdentity,
                                             RTVerificationStatus, User,
                                             UserRole, UserStatus)
from app.modules.iam.domain.repositories import (RTGroupRepository,
                                                 UserRepository)
from app.modules.iam.infrastructure.models import RTGroupModel, UserModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class PgUserRepository(UserRepository):

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        result = await self._session.get(UserModel, user_id)
        return self._to_entity(result) if result else None

    async def get_by_email(self, email: str) -> Optional[User]:
        stmt = select(UserModel).where(UserModel.email == email.lower().strip())
        row = (await self._session.execute(stmt)).scalar_one_or_none()
        return self._to_entity(row) if row else None

    async def get_by_phone(self, phone: str) -> Optional[User]:
        stmt = select(UserModel).where(UserModel.phone == phone.strip())
        row = (await self._session.execute(stmt)).scalar_one_or_none()
        return self._to_entity(row) if row else None

    async def list_by_rt_group(self, rt_group_id: UUID) -> list[User]:
        stmt = select(UserModel).where(UserModel.rt_group_id == rt_group_id)
        rows = (await self._session.execute(stmt)).scalars().all()
        return [self._to_entity(r) for r in rows]

    async def save(self, user: User) -> User:
        existing = await self._session.get(UserModel, user.id)
        if existing:
            existing.email           = user.email
            existing.phone           = user.phone
            existing.hashed_password = user.hashed_password
            existing.full_name       = user.full_name
            existing.role            = user.role.value
            existing.status          = user.status.value
            existing.rt_group_id     = user.rt_group_id
            model = existing
        else:
            model = UserModel(
                id               = user.id,
                email            = user.email,
                phone            = user.phone,
                hashed_password  = user.hashed_password,
                full_name        = user.full_name,
                role             = user.role.value,
                status           = user.status.value,
                rt_group_id      = user.rt_group_id,
            )
            self._session.add(model)

        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    # ── Mapping ───────────────────────────────────────────────────────────

    @staticmethod
    def _to_entity(m: UserModel) -> User:
        return User(
            id               = m.id,
            email            = m.email,
            phone            = m.phone,
            hashed_password  = m.hashed_password,
            full_name        = m.full_name,
            role             = UserRole(m.role),
            status           = UserStatus(m.status),
            rt_group_id      = m.rt_group_id,
            created_at       = m.created_at,
            updated_at       = m.updated_at,
        )


class PgRTGroupRepository(RTGroupRepository):

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, rt_group_id: UUID) -> Optional[RTGroup]:
        result = await self._session.get(RTGroupModel, rt_group_id)
        return self._to_entity(result) if result else None

    async def find_by_identity(self, identity: RTIdentity) -> Optional[RTGroup]:
        stmt = select(RTGroupModel).where(
            RTGroupModel.rt_number == identity.rt_number,
            RTGroupModel.rw_number == identity.rw_number,
            RTGroupModel.kelurahan == identity.kelurahan,
            RTGroupModel.kecamatan == identity.kecamatan,
            RTGroupModel.kota      == identity.kota,
        )
        row = (await self._session.execute(stmt)).scalar_one_or_none()
        return self._to_entity(row) if row else None

    async def list_pending_verification(self) -> list[RTGroup]:
        stmt = (
            select(RTGroupModel)
            .where(
                RTGroupModel.verification_status
                == RTVerificationStatus.PENDING_VERIFICATION.value
            )
            .order_by(RTGroupModel.created_at.asc())  # oldest first → FIFO queue
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [self._to_entity(r) for r in rows]

    async def list_expiring_soon(self, within_days: int = 30) -> list[RTGroup]:
        cutoff = date.today() + timedelta(days=within_days)
        stmt = select(RTGroupModel).where(
            RTGroupModel.verification_status == RTVerificationStatus.ACTIVE.value,
            RTGroupModel.sk_valid_until != None,  # noqa: E711
            RTGroupModel.sk_valid_until <= cutoff,
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [self._to_entity(r) for r in rows]

    async def save(self, rt_group: RTGroup) -> RTGroup:
        existing = await self._session.get(RTGroupModel, rt_group.id)
        if existing:
            existing.rt_number           = rt_group.rt_number
            existing.rw_number           = rt_group.rw_number
            existing.kelurahan           = rt_group.kelurahan
            existing.kecamatan           = rt_group.kecamatan
            existing.kota                = rt_group.kota
            existing.provinsi            = rt_group.provinsi
            existing.admin_user_id       = rt_group.admin_user_id
            existing.monthly_fee_idr     = rt_group.monthly_fee_idr
            existing.is_active           = rt_group.is_active
            existing.verification_status = rt_group.verification_status.value
            existing.sk_document_url     = rt_group.sk_document_url
            existing.sk_valid_until      = rt_group.sk_valid_until
            existing.verified_at         = rt_group.verified_at
            existing.verified_by         = rt_group.verified_by
            existing.rejection_reason    = rt_group.rejection_reason
            model = existing
        else:
            model = RTGroupModel(
                id                  = rt_group.id,
                rt_number           = rt_group.rt_number,
                rw_number           = rt_group.rw_number,
                kelurahan           = rt_group.kelurahan,
                kecamatan           = rt_group.kecamatan,
                kota                = rt_group.kota,
                provinsi            = rt_group.provinsi,
                admin_user_id       = rt_group.admin_user_id,
                monthly_fee_idr     = rt_group.monthly_fee_idr,
                is_active           = rt_group.is_active,
                verification_status = rt_group.verification_status.value,
                sk_document_url     = rt_group.sk_document_url,
                sk_valid_until      = rt_group.sk_valid_until,
                verified_at         = rt_group.verified_at,
                verified_by         = rt_group.verified_by,
                rejection_reason    = rt_group.rejection_reason,
            )
            self._session.add(model)

        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    # ── Mapping ───────────────────────────────────────────────────────────

    @staticmethod
    def _to_entity(m: RTGroupModel) -> RTGroup:
        identity = RTIdentity(
            rt_number = m.rt_number,
            rw_number = m.rw_number,
            kelurahan = m.kelurahan,
            kecamatan = m.kecamatan,
            kota      = m.kota,
        )
        group = RTGroup(
            id                  = m.id,
            identity            = identity,
            admin_user_id       = m.admin_user_id,
            monthly_fee_idr     = m.monthly_fee_idr,
            is_active           = m.is_active,
            provinsi            = m.provinsi,
            verification_status = RTVerificationStatus(m.verification_status),
            sk_document_url     = m.sk_document_url,
            sk_valid_until      = m.sk_valid_until,
            verified_at         = m.verified_at,
            verified_by         = m.verified_by,
            rejection_reason    = m.rejection_reason,
            created_at          = m.created_at,
            updated_at          = m.updated_at,
        )
        return group

    async def get_all(self) -> list[RTGroup]:
        """Return all active RT groups — used by the warga registration dropdown."""
        from sqlalchemy import select
        stmt = (
            select(RTGroupModel)
            .where(RTGroupModel.is_active == True)
            .order_by(RTGroupModel.kota, RTGroupModel.kelurahan,
                      RTGroupModel.rw_number, RTGroupModel.rt_number)
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [self._to_entity(r) for r in rows]
