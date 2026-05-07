from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from app.modules.tagihan.domain.entities import PaymentMethod


class GenerateBulkRequest(BaseModel):
    rt_group_id: UUID
    year: int
    month: int
    amount_idr: int


class ConfirmPaymentRequest(BaseModel):
    method: PaymentMethod
    bukti_url: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: UUID
    resident_id: UUID
    period_label: str
    amount_idr: int
    status: str
    bukti_url: Optional[str]
