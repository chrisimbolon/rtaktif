from abc import abstractmethod
from typing import Optional
from uuid import UUID
from app.core.base_repository import BaseRepository
from app.modules.tagihan.domain.entities import Invoice, Payment


class InvoiceRepository(BaseRepository[Invoice]):
    @abstractmethod
    async def get_by_resident_and_period(
        self, resident_id: UUID, year: int, month: int
    ) -> Optional[Invoice]: ...

    @abstractmethod
    async def get_by_rt_and_period(
        self, rt_group_id: UUID, year: int, month: int
    ) -> list[Invoice]: ...

    @abstractmethod
    async def get_unpaid_by_rt(self, rt_group_id: UUID) -> list[Invoice]: ...

    @abstractmethod
    async def save_bulk(self, invoices: list[Invoice]) -> list[Invoice]: ...


class PaymentRepository(BaseRepository[Payment]):
    @abstractmethod
    async def get_by_invoice(self, invoice_id: UUID) -> list[Payment]: ...

    @abstractmethod
    async def get_by_resident(self, resident_id: UUID) -> list[Payment]: ...
