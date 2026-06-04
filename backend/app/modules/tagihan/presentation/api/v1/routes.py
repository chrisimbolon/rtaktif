#  backend/app/modules/tagihan/presentation/api/v1/routes.py
#
#  New endpoints added for Method B (bukti bayar flow):
#    POST /tagihan/{invoice_id}/upload-bukti   ← warga uploads proof
#    GET  /tagihan/{invoice_id}/detail         ← treasurer sees invoice + bukti
#    PATCH /tagihan/{invoice_id}/confirm-payment  ← unchanged, bukti_url already supported
#
import os
import uuid as _uuid
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
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
from app.modules.warga.infrastructure.models import ResidentModel
from app.modules.warga.infrastructure.repository import PgResidentRepository
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

MONTHS_ID = ["","Januari","Februari","Maret","April","Mei","Juni",
             "Juli","Agustus","September","Oktober","November","Desember"]

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp/rtmudah_uploads")

router = APIRouter()


def _ensure_upload_dir() -> None:
    os.makedirs(UPLOAD_DIR, exist_ok=True)


async def _save_file(file: UploadFile, prefix: str) -> str:
    """
    Save uploaded file to UPLOAD_DIR and return its public URL path.
    Later: swap body to upload to DO Spaces, return CDN URL.
    """
    _ensure_upload_dir()
    ext      = os.path.splitext(file.filename or "file.jpg")[1] or ".jpg"
    filename = f"{prefix}_{_uuid.uuid4().hex}{ext}"
    dest     = os.path.join(UPLOAD_DIR, filename)
    content  = await file.read()
    with open(dest, "wb") as f:
        f.write(content)
    return f"/uploads/{filename}"


@router.post("/tagihan/generate-bulk", status_code=201, tags=["Tagihan"])
async def generate_bulk(
    body: GenerateBulkRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
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
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    invoices = await PgInvoiceRepository(db).get_by_rt_and_period(
        rt_group_id, year, month
    )
    if not invoices:
        return []

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
            "bukti_url":     inv.payment.bukti_url if inv.payment else None,
        }
        for inv in invoices
    ]


@router.get("/tagihan/unpaid/{rt_group_id}", tags=["Tagihan"])
async def get_unpaid(
    rt_group_id: UUID,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    invoices = await PgInvoiceRepository(db).get_unpaid_by_rt(rt_group_id)
    if not invoices:
        return []

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
            "bukti_url":     None,
        }
        for inv in invoices
    ]


@router.get("/tagihan/{invoice_id}/detail", tags=["Tagihan"])
async def get_invoice_detail(
    invoice_id: UUID,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns single invoice with bukti_url populated.
    Used by treasurer review modal to show payment proof image.
    """
    repo    = PgInvoiceRepository(db)
    invoice = await repo.get_by_id(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Tagihan tidak ditemukan")

    bukti_url = None
    if invoice.payment:
        bukti_url = invoice.payment.bukti_url

    if not bukti_url:
        bukti_url = await repo.get_bukti_url(invoice_id)

    return {
        "id":         str(invoice.id),
        "status":     invoice.status,
        "amount_idr": invoice.amount_idr,
        "period":     invoice.period_label,
        "bukti_url":  bukti_url,
        "paid_at":    invoice.paid_at.isoformat() if invoice.paid_at else None,
    }


@router.post("/tagihan/{invoice_id}/upload-bukti", tags=["Tagihan"])
async def upload_bukti_bayar(
    invoice_id: UUID,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Warga uploads bukti bayar (receipt image/PDF).
    Stores URL in pending_bukti_url on the invoice row.
    Treasurer will see this URL in the review modal before confirming.

    Allowed types: image/jpeg, image/png, image/webp, application/pdf
    Max size: 5 MB
    """
    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    MAX_SIZE_BYTES = 5 * 1024 * 1024

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Tipe file tidak didukung: {file.content_type}. "
                   "Gunakan JPG, PNG, WebP, atau PDF."
        )

    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=422,
            detail="Ukuran file maksimal 5 MB"
        )

    await file.seek(0)

    repo    = PgInvoiceRepository(db)
    invoice = await repo.get_by_id(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Tagihan tidak ditemukan")

    if invoice.status == "paid":
        raise HTTPException(status_code=409, detail="Tagihan sudah lunas")

    ext      = os.path.splitext(file.filename or "bukti.jpg")[1] or ".jpg"
    filename = f"bukti_{invoice_id.hex}_{_uuid.uuid4().hex[:8]}{ext}"
    dest     = os.path.join(UPLOAD_DIR, filename)
    _ensure_upload_dir()

    with open(dest, "wb") as f:
        f.write(content)

    bukti_url = f"/uploads/{filename}"
    await repo.set_pending_bukti(invoice_id, bukti_url)

    return {
        "invoice_id": str(invoice_id),
        "bukti_url":  bukti_url,
        "message":    "Bukti bayar berhasil diunggah. Menunggu konfirmasi Ketua RT.",
    }


@router.patch("/tagihan/{invoice_id}/confirm-payment", tags=["Tagihan"])
async def confirm_payment(
    invoice_id: UUID,
    body: ConfirmPaymentRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Treasurer confirms payment.
    bukti_url: if not provided in body, uses the pending_bukti_url
    already stored on the invoice (uploaded by warga).
    """
    repo = PgInvoiceRepository(db)

    bukti_url = body.bukti_url
    if not bukti_url:
        bukti_url = await repo.get_bukti_url(invoice_id)

    try:
        invoice = await ConfirmPayment(repo).execute(
            invoice_id=invoice_id,
            method=body.method,
            confirmed_by=UUID(current_user["user_id"]),
            bukti_url=bukti_url,
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

@router.get("/tagihan/keuangan/{rt_group_id}", tags=["Laporan Keuangan"])
async def get_laporan_keuangan(
    rt_group_id: UUID,
    year:        int,
    current_user: dict = Depends(require_admin),
    db:          AsyncSession = Depends(get_db),
):
    """
    Laporan keuangan tahunan — aggregated monthly financial report.

    Returns:
    - monthly_summary: pemasukan per bulan (from payments table)
    - invoices_summary: tagihan stats per bulan (issued/paid/overdue)
    - total_collected: total kas terkumpul for the year
    - total_outstanding: total tagihan belum bayar
    - payment_history: last 20 payments with resident names
    """
    from app.modules.iam.infrastructure.models import UserModel
    from app.modules.tagihan.infrastructure.models import (InvoiceModel,
                                                           PaymentModel)
    from app.modules.warga.infrastructure.models import ResidentModel
    from sqlalchemy import func, select

    MONTHS_ID = ["","Januari","Februari","Maret","April","Mei","Juni",
                 "Juli","Agustus","September","Oktober","November","Desember"]

    # ── 1. Monthly payment totals (kas masuk) ────────────────────────────────
    monthly_result = await db.execute(
        select(
            func.extract("month", PaymentModel.paid_at).label("month"),
            func.sum(PaymentModel.amount_idr).label("total"),
            func.count(PaymentModel.id).label("count"),
        )
        .join(InvoiceModel, InvoiceModel.id == PaymentModel.invoice_id)
        .where(
            InvoiceModel.rt_group_id == rt_group_id,
            func.extract("year", PaymentModel.paid_at) == year,
        )
        .group_by(func.extract("month", PaymentModel.paid_at))
        .order_by(func.extract("month", PaymentModel.paid_at))
    )
    monthly_payments = {int(r.month): {"total": r.total, "count": r.count}
                        for r in monthly_result.all()}

    # ── 2. Invoice stats per month ───────────────────────────────────────────
    invoice_result = await db.execute(
        select(
            InvoiceModel.period_month,
            InvoiceModel.status,
            func.count(InvoiceModel.id).label("count"),
            func.sum(InvoiceModel.amount_idr).label("total"),
        )
        .where(
            InvoiceModel.rt_group_id == rt_group_id,
            InvoiceModel.period_year == year,
        )
        .group_by(InvoiceModel.period_month, InvoiceModel.status)
        .order_by(InvoiceModel.period_month)
    )
    invoice_stats: dict = {}
    for r in invoice_result.all():
        m = r.period_month
        if m not in invoice_stats:
            invoice_stats[m] = {"paid": 0, "issued": 0, "overdue": 0,
                                 "paid_amount": 0, "unpaid_amount": 0}
        if r.status == "paid":
            invoice_stats[m]["paid"]        += r.count
            invoice_stats[m]["paid_amount"] += r.total
        elif r.status == "issued":
            invoice_stats[m]["issued"]        += r.count
            invoice_stats[m]["unpaid_amount"] += r.total
        elif r.status == "overdue":
            invoice_stats[m]["overdue"]       += r.count
            invoice_stats[m]["unpaid_amount"] += r.total

    # ── 3. Build monthly summary for chart ───────────────────────────────────
    monthly_summary = []
    for m in range(1, 13):
        pay   = monthly_payments.get(m, {"total": 0, "count": 0})
        stats = invoice_stats.get(m, {"paid": 0, "issued": 0, "overdue": 0,
                                       "paid_amount": 0, "unpaid_amount": 0})
        monthly_summary.append({
            "month":         m,
            "month_label":   MONTHS_ID[m],
            "month_short":   MONTHS_ID[m][:3],
            "kas_masuk":     int(pay["total"] or 0),
            "payment_count": int(pay["count"] or 0),
            "paid":          stats["paid"],
            "issued":        stats["issued"],
            "overdue":       stats["overdue"],
            "paid_amount":   int(stats["paid_amount"] or 0),
            "unpaid_amount": int(stats["unpaid_amount"] or 0),
        })

    # ── 4. Totals ─────────────────────────────────────────────────────────────
    total_collected   = sum(m["kas_masuk"]     for m in monthly_summary)
    total_outstanding = sum(m["unpaid_amount"] for m in monthly_summary)
    total_paid        = sum(m["paid"]          for m in monthly_summary)
    total_unpaid      = sum(m["issued"] + m["overdue"] for m in monthly_summary)

    # ── 5. Recent payment history (last 20) ──────────────────────────────────
    history_result = await db.execute(
        select(
            PaymentModel.id,
            PaymentModel.amount_idr,
            PaymentModel.method,
            PaymentModel.paid_at,
            PaymentModel.bukti_url,
            UserModel.full_name,
            InvoiceModel.period_month,
            InvoiceModel.period_year,
        )
        .join(InvoiceModel, InvoiceModel.id == PaymentModel.invoice_id)
        .join(ResidentModel, ResidentModel.id == PaymentModel.resident_id)
        .join(UserModel, UserModel.id == ResidentModel.user_id)
        .where(InvoiceModel.rt_group_id == rt_group_id)
        .order_by(PaymentModel.paid_at.desc())
        .limit(20)
    )
    payment_history = [
        {
            "id":           str(r.id),
            "resident_name": r.full_name,
            "amount_idr":   r.amount_idr,
            "method":       r.method,
            "paid_at":      r.paid_at.isoformat() if r.paid_at else None,
            "bukti_url":    r.bukti_url,
            "period":       f"{MONTHS_ID[r.period_month]} {r.period_year}",
        }
        for r in history_result.all()
    ]

    return {
        "year":             year,
        "rt_group_id":      str(rt_group_id),
        "monthly_summary":  monthly_summary,
        "total_collected":  total_collected,
        "total_outstanding": total_outstanding,
        "total_paid_invoices": total_paid,
        "total_unpaid_invoices": total_unpaid,
        "payment_history":  payment_history,
    }