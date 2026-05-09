from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.core.exceptions import EntityNotFoundError
from app.modules.tagihan.application.schemas import GenerateBulkRequest, ConfirmPaymentRequest
from app.modules.tagihan.application.use_cases.generate_bulk_invoices import GenerateBulkInvoices
from app.modules.tagihan.application.use_cases.confirm_payment import ConfirmPayment
from app.modules.tagihan.application.use_cases.mark_overdue import MarkOverdueInvoices
from app.modules.tagihan.infrastructure.repository import PgInvoiceRepository
from app.modules.warga.infrastructure.repository import PgResidentRepository

router = APIRouter()


@router.post("/tagihan/generate-bulk", status_code=201, tags=["Tagihan"])
async def generate_bulk(
    body: GenerateBulkRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID
    invoices = await GenerateBulkInvoices(
        PgInvoiceRepository(db), PgResidentRepository(db)
    ).execute(
        rt_group_id=body.rt_group_id, year=body.year, month=body.month,
        amount_idr=body.amount_idr, generated_by=UUID(current_user["user_id"]),
    )
    return {"invoices_created": len(invoices)}


@router.get("/tagihan/rt/{rt_group_id}", tags=["Tagihan"])
async def get_invoices_by_period(
    rt_group_id: UUID, year: int, month: int,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    invoices = await PgInvoiceRepository(db).get_by_rt_and_period(rt_group_id, year, month)
    return [{"id": str(i.id), "resident_id": str(i.resident_id),
             "period": i.period_label, "amount_idr": i.amount_idr,
             "status": i.status} for i in invoices]


@router.get("/tagihan/unpaid/{rt_group_id}", tags=["Tagihan"])
async def get_unpaid(
    rt_group_id: UUID,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    invoices = await PgInvoiceRepository(db).get_unpaid_by_rt(rt_group_id)
    return [{"id": str(i.id), "resident_id": str(i.resident_id),
             "period": i.period_label, "amount_idr": i.amount_idr,
             "status": i.status} for i in invoices]


@router.patch("/tagihan/{invoice_id}/confirm-payment", tags=["Tagihan"])
async def confirm_payment(
    invoice_id: UUID, body: ConfirmPaymentRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        invoice = await ConfirmPayment(PgInvoiceRepository(db)).execute(
            invoice_id=invoice_id, method=body.method,
            confirmed_by=UUID(current_user["user_id"]), bukti_url=body.bukti_url,
        )
        return {"id": str(invoice.id), "status": invoice.status}
    except EntityNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.post("/tagihan/mark-overdue/{rt_group_id}", tags=["Tagihan"])
async def mark_overdue(
    rt_group_id: UUID,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    count = await MarkOverdueInvoices(PgInvoiceRepository(db)).execute(rt_group_id)
    return {"marked_overdue": count}
