"""Use case: Generate monthly iuran invoices for all active residents."""
from uuid import UUID
from app.core.events import event_bus
from app.modules.tagihan.domain.entities import Invoice, JenisIuran
from app.modules.tagihan.domain.policies import BillingPolicy
from app.modules.tagihan.domain.repositories import InvoiceRepository
from app.modules.warga.domain.entities import ResidentStatus
from app.modules.warga.domain.repositories import ResidentRepository


class GenerateBulkInvoices:
    def __init__(self, invoice_repo: InvoiceRepository, resident_repo: ResidentRepository):
        self.invoice_repo   = invoice_repo
        self.resident_repo  = resident_repo

    async def execute(
        self, rt_group_id: UUID, year: int, month: int,
        amount_idr: int, generated_by: UUID,
        jenis_iuran: str = "IURAN KAS RT",
        label_iuran: str | None = None,
    ) -> list[Invoice]:
        # Guard: don't double-generate
        existing = await self.invoice_repo.get_by_rt_and_period(rt_group_id, year, month)
        if not BillingPolicy.can_generate_for_month(len(existing)):
            return existing

        active_residents = [
            r for r in await self.resident_repo.get_by_rt_group(
                rt_group_id, status=ResidentStatus.ACTIVE
            )
            if not r.is_anggota_kk  # only Kepala KK pays iuran
        ]

        invoices = []
        for resident in active_residents:
            already = await self.invoice_repo.get_by_resident_and_period(
                resident.id, year, month
            )
            if already:
                continue
            invoices.append(Invoice.generate(
                resident_id=resident.id, rt_group_id=rt_group_id,
                year=year, month=month, amount_idr=amount_idr,
                jenis_iuran=JenisIuran(jenis_iuran),
                label_iuran=label_iuran,
            ))

        saved = await self.invoice_repo.save_bulk(invoices)
        for inv in saved:
            for event in inv.pull_events():
                await event_bus.publish(event)
        return saved
