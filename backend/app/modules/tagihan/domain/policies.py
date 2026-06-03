from datetime import date
from app.modules.tagihan.domain.entities import Invoice, InvoiceStatus
from app.shared.constants.indonesia import INVOICE_DUE_DAY


class BillingPolicy:
    @staticmethod
    def is_overdue(invoice: Invoice) -> bool:
        if invoice.status != InvoiceStatus.ISSUED:
            return False
        due = date(invoice.period_year, invoice.period_month, INVOICE_DUE_DAY)
        return date.today() > due

    @staticmethod
    def can_generate_for_month(existing_count: int) -> bool:
        """
        Allow bulk generation even if some invoices already exist.
        The use case skips residents that already have an invoice,
        so this guard is no longer needed here.
        Individual duplicate prevention is handled per-resident.
        """
        return True
