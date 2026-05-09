from typing import Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.tagihan.domain.entities import Invoice, InvoiceStatus, PaymentMethod
from app.modules.tagihan.domain.repositories import InvoiceRepository
from app.modules.tagihan.infrastructure.models import InvoiceModel


class PgInvoiceRepository(InvoiceRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, entity_id: UUID) -> Optional[Invoice]:
        row = await self.session.get(InvoiceModel, entity_id)
        return self._to_entity(row) if row else None

    async def get_by_resident_and_period(self, resident_id: UUID, year: int, month: int):
        result = await self.session.execute(
            select(InvoiceModel).where(
                InvoiceModel.resident_id == resident_id,
                InvoiceModel.period_year == year,
                InvoiceModel.period_month == month,
            )
        )
        row = result.scalar_one_or_none()
        return self._to_entity(row) if row else None

    async def get_by_rt_and_period(self, rt_group_id: UUID, year: int, month: int):
        result = await self.session.execute(
            select(InvoiceModel).where(
                InvoiceModel.rt_group_id == rt_group_id,
                InvoiceModel.period_year == year,
                InvoiceModel.period_month == month,
            )
        )
        return [self._to_entity(r) for r in result.scalars().all()]

    async def get_unpaid_by_rt(self, rt_group_id: UUID):
        result = await self.session.execute(
            select(InvoiceModel).where(
                InvoiceModel.rt_group_id == rt_group_id,
                InvoiceModel.status.in_(["issued", "overdue"]),
            )
        )
        return [self._to_entity(r) for r in result.scalars().all()]

    async def save(self, entity: Invoice) -> Invoice:
        existing = await self.session.get(InvoiceModel, entity.id)
        if existing:
            existing.status         = entity.status.value
            existing.payment_method = entity.payment_method.value if entity.payment_method else None
            existing.bukti_url      = entity.bukti_url
            existing.confirmed_by   = entity.confirmed_by
        else:
            self.session.add(InvoiceModel(
                id=entity.id, resident_id=entity.resident_id,
                rt_group_id=entity.rt_group_id,
                period_year=entity.period_year, period_month=entity.period_month,
                amount_idr=entity.amount_idr, status=entity.status.value,
                notes=entity.notes, created_at=entity.created_at, updated_at=entity.updated_at,
            ))
        await self.session.flush()
        return entity

    async def save_bulk(self, invoices: list[Invoice]) -> list[Invoice]:
        return [await self.save(inv) for inv in invoices]

    async def delete(self, entity_id: UUID) -> None:
        row = await self.session.get(InvoiceModel, entity_id)
        if row:
            await self.session.delete(row)

    async def list_all(self) -> list[Invoice]:
        result = await self.session.execute(select(InvoiceModel))
        return [self._to_entity(r) for r in result.scalars().all()]

    def _to_entity(self, row: InvoiceModel) -> Invoice:
        return Invoice(
            id=row.id, resident_id=row.resident_id, rt_group_id=row.rt_group_id,
            period_year=row.period_year, period_month=row.period_month,
            amount_idr=row.amount_idr, status=InvoiceStatus(row.status),
            payment_method=PaymentMethod(row.payment_method) if row.payment_method else None,
            bukti_url=row.bukti_url, confirmed_by=row.confirmed_by,
            notes=row.notes, created_at=row.created_at, updated_at=row.updated_at,
        )
