#  backend/app/modules/tagihan/presentation/api/v1/routes.py 
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import require_admin
from app.core.exceptions import EntityNotFoundError
from app.modules.iam.infrastructure.models import UserModel
from app.modules.tagihan.application.schemas import (ConfirmPaymentRequest,
                                                     GenerateBulkRequest)
from app.modules.tagihan.application.use_cases.confirm_payment import \
    ConfirmPayment
from app.modules.tagihan.application.use_cases.generate_bulk_invoices import \
    GenerateBulkInvoices
from app.modules.tagihan.application.use_cases.mark_overdue import \
    MarkOverdueInvoices
from app.modules.tagihan.infrastructure.repository import PgInvoiceRepository
from app.modules.warga.infrastructure.models import ResidentModel  # ← ADD
from app.modules.warga.infrastructure.repository import PgResidentRepository
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

MONTHS_ID = ["","Januari","Februari","Maret","April","Mei","Juni",
             "Juli","Agustus","September","Oktober","November","Desember"]

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
    rt_group_id: UUID,
    year:  int,
    month: int,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List invoices for a period — enriched with resident full_name."""
    invoices = await PgInvoiceRepository(db).get_by_rt_and_period(
        rt_group_id, year, month
    )
    if not invoices:
        return []

    # Batch-fetch resident → user name mapping
    resident_ids = [inv.resident_id for inv in invoices]
    result = await db.execute(
        select(ResidentModel.id, ResidentModel.user_id)
        .where(ResidentModel.id.in_(resident_ids))
    )
    resident_user_map = {row.id: row.user_id for row in result.all()}

    user_ids = list(resident_user_map.values())

    user_result = await db.execute(
        select(UserModel.id, UserModel.full_name)
        .where(UserModel.id.in_(user_ids))
    )
    user_name_map = {row.id: row.full_name for row in user_result.all()}

    # Build enriched response
    return [
        {
            "id":            str(inv.id),
            "resident_id":   str(inv.resident_id),
            "resident_name": user_name_map.get(
                resident_user_map.get(inv.resident_id), ""
            ) or "",
            "period": f"{MONTHS_ID[inv.period_month]} {inv.period_year}",
            "amount_idr":    inv.amount_idr,
            "status":        inv.status,
        }
        for inv in invoices
    ]

@router.get("/tagihan/unpaid/{rt_group_id}", tags=["Tagihan"])
async def get_unpaid(
    rt_group_id: UUID,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List unpaid invoices — enriched with resident full_name."""
    invoices = await PgInvoiceRepository(db).get_unpaid_by_rt(rt_group_id)
    if not invoices:
        return []

    # Batch-fetch resident → user name mapping (same pattern as get_invoices_by_period)
    resident_ids = [inv.resident_id for inv in invoices]
    result = await db.execute(
        select(ResidentModel.id, ResidentModel.user_id)
        .where(ResidentModel.id.in_(resident_ids))
    )
    resident_user_map = {row.id: row.user_id for row in result.all()}

    user_ids = list(resident_user_map.values())
    user_result = await db.execute(
        select(UserModel.id, UserModel.full_name)
        .where(UserModel.id.in_(user_ids))
    )
    user_name_map = {row.id: row.full_name for row in user_result.all()}

    return [
        {
            "id":            str(inv.id),
            "resident_id":   str(inv.resident_id),
            "resident_name": user_name_map.get(
                resident_user_map.get(inv.resident_id), ""
            ) or "",
            "period":        f"{MONTHS_ID[inv.period_month]} {inv.period_year}",
            "amount_idr":    inv.amount_idr,
            "status":        inv.status,
        }
        for inv in invoices
    ]

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
