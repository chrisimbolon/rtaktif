"""Use case: Admin confirms payment for an invoice."""
from uuid import UUID
from typing import Optional
from app.core.events import event_bus
from app.core.exceptions import EntityNotFoundError
from app.modules.tagihan.domain.entities import PaymentMethod
from app.modules.tagihan.domain.repositories import InvoiceRepository


class ConfirmPayment:
    def __init__(self, repo: InvoiceRepository):
        self.repo = repo

    async def execute(
        self, invoice_id: UUID, method: PaymentMethod,
        confirmed_by: UUID, bukti_url: Optional[str] = None,
    ):
        invoice = await self.repo.get_by_id(invoice_id)
        if not invoice:
            raise EntityNotFoundError(f"Tagihan {invoice_id} tidak ditemukan")
        invoice.confirm_payment(method=method, confirmed_by=confirmed_by, bukti_url=bukti_url)
        saved = await self.repo.save(invoice)
        for event in saved.pull_events():
            await event_bus.publish(event)
        return saved
