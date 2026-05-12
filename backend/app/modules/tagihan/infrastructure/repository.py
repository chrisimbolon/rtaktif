"""
PostgreSQL implementations of InvoiceRepository and PaymentRepository.
Handles the Invoice + Payment dual-persist in confirm_payment.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tagihan.domain.entities import Invoice, Payment, InvoiceStatus, PaymentMethod
from app.modules.tagihan.domain.repositories import InvoiceRepository, PaymentRepository
from app.modules.tagihan.infrastructure.models import InvoiceModel, PaymentModel


class PgInvoiceRepository(InvoiceRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, entity_id: UUID) -> Optional[Invoice]:
        row = await self.session.get(InvoiceModel, entity_id)
        return self._to_entity(row) if row else None

    async def get_by_resident_and_period(
        self, resident_id: UUID, year: int, month: int
    ) -> Optional[Invoice]:
        result = await self.session.execute(
            select(InvoiceModel).where(
                InvoiceModel.resident_id  == resident_id,
                InvoiceModel.period_year  == year,
                InvoiceModel.period_month == month,
            )
        )
        row = result.scalar_one_or_none()
        return self._to_entity(row) if row else None

    async def get_by_rt_and_period(
        self, rt_group_id: UUID, year: int, month: int
    ) -> list[Invoice]:
        # Uses composite index: ix_invoices_rt_period
        result = await self.session.execute(
            select(InvoiceModel).where(
                InvoiceModel.rt_group_id  == rt_group_id,
                InvoiceModel.period_year  == year,
                InvoiceModel.period_month == month,
            ).order_by(InvoiceModel.created_at)
        )
        return [self._to_entity(r) for r in result.scalars().all()]

    async def get_unpaid_by_rt(self, rt_group_id: UUID) -> list[Invoice]:
        # Uses composite index: ix_invoices_rt_status
        result = await self.session.execute(
            select(InvoiceModel).where(
                InvoiceModel.rt_group_id == rt_group_id,
                InvoiceModel.status.in_(["issued", "overdue"]),
            ).order_by(InvoiceModel.period_year, InvoiceModel.period_month)
        )
        return [self._to_entity(r) for r in result.scalars().all()]

    async def save(self, entity: Invoice) -> Invoice:
        existing = await self.session.get(InvoiceModel, entity.id)
        if existing:
            existing.status  = entity.status.value
            existing.paid_at = entity.paid_at
            existing.notes   = entity.notes
        else:
            self.session.add(InvoiceModel(
                id=entity.id,
                resident_id=entity.resident_id,
                rt_group_id=entity.rt_group_id,
                period_year=entity.period_year,
                period_month=entity.period_month,
                amount_idr=entity.amount_idr,
                status=entity.status.value,
                paid_at=entity.paid_at,
                notes=entity.notes,
                created_at=entity.created_at,
                updated_at=entity.updated_at,
            ))

        # If payment was just confirmed, persist it to payments table too
        if entity.payment and entity.status == InvoiceStatus.PAID:
            await self._persist_payment(entity.payment)

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

    async def _persist_payment(self, payment: Payment) -> None:
        """Called internally when an invoice is confirmed paid."""
        existing = await self.session.get(PaymentModel, payment.id)
        if not existing:
            self.session.add(PaymentModel(
                id=payment.id,
                invoice_id=payment.invoice_id,
                resident_id=payment.resident_id,
                amount_idr=payment.amount_idr,
                method=payment.method.value,
                bukti_url=payment.bukti_url,
                confirmed_by=payment.confirmed_by,
                paid_at=payment.paid_at or datetime.now(timezone.utc),
                notes=payment.notes,
                created_at=payment.created_at,
            ))

    def _to_entity(self, row: InvoiceModel) -> Invoice:
        return Invoice(
            id=row.id,
            resident_id=row.resident_id,
            rt_group_id=row.rt_group_id,
            period_year=row.period_year,
            period_month=row.period_month,
            amount_idr=row.amount_idr,
            status=InvoiceStatus(row.status),
            paid_at=row.paid_at,
            notes=row.notes,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


class PgPaymentRepository(PaymentRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, entity_id: UUID) -> Optional[Payment]:
        row = await self.session.get(PaymentModel, entity_id)
        return self._to_entity(row) if row else None

    async def get_by_invoice(self, invoice_id: UUID) -> list[Payment]:
        result = await self.session.execute(
            select(PaymentModel)
            .where(PaymentModel.invoice_id == invoice_id)
            .order_by(PaymentModel.paid_at)
        )
        return [self._to_entity(r) for r in result.scalars().all()]

    async def get_by_resident(self, resident_id: UUID) -> list[Payment]:
        result = await self.session.execute(
            select(PaymentModel)
            .where(PaymentModel.resident_id == resident_id)
            .order_by(PaymentModel.paid_at.desc())
        )
        return [self._to_entity(r) for r in result.scalars().all()]

    async def save(self, entity: Payment) -> Payment:
        self.session.add(PaymentModel(
            id=entity.id,
            invoice_id=entity.invoice_id,
            resident_id=entity.resident_id,
            amount_idr=entity.amount_idr,
            method=entity.method.value,
            bukti_url=entity.bukti_url,
            confirmed_by=entity.confirmed_by,
            paid_at=entity.paid_at or datetime.now(timezone.utc),
            notes=entity.notes,
            created_at=entity.created_at,
        ))
        await self.session.flush()
        return entity

    async def delete(self, entity_id: UUID) -> None:
        row = await self.session.get(PaymentModel, entity_id)
        if row:
            await self.session.delete(row)

    async def list_all(self) -> list[Payment]:
        result = await self.session.execute(select(PaymentModel))
        return [self._to_entity(r) for r in result.scalars().all()]

    def _to_entity(self, row: PaymentModel) -> Payment:
        return Payment(
            id=row.id,
            invoice_id=row.invoice_id,
            resident_id=row.resident_id,
            amount_idr=row.amount_idr,
            method=PaymentMethod(row.method),
            bukti_url=row.bukti_url,
            confirmed_by=row.confirmed_by,
            paid_at=row.paid_at,
            notes=row.notes,
            created_at=row.created_at,
        )
