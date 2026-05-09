"""Use case: Mark all unpaid invoices past due date as overdue."""
from uuid import UUID
from app.core.events import event_bus
from app.modules.tagihan.domain.policies import BillingPolicy
from app.modules.tagihan.domain.repositories import InvoiceRepository


class MarkOverdueInvoices:
    def __init__(self, repo: InvoiceRepository):
        self.repo = repo

    async def execute(self, rt_group_id: UUID) -> int:
        unpaid = await self.repo.get_unpaid_by_rt(rt_group_id)
        count = 0
        for invoice in unpaid:
            if BillingPolicy.is_overdue(invoice):
                invoice.mark_overdue()
                saved = await self.repo.save(invoice)
                for event in saved.pull_events():
                    await event_bus.publish(event)
                count += 1
        return count
