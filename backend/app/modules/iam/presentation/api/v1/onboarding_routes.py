"""Onboarding routes — Ketua RT verification endpoints.

Router prefix : /onboarding
Tags          : ["Onboarding"]

Endpoints
─────────────────────────────────────────────────────────────────────────────
POST   /onboarding/upload-document               No auth — KTP or SK file
POST   /onboarding/upload-ktp                    No auth — KTP image + auto OCR
POST   /onboarding/submit-verification           No auth — submits full package
GET    /onboarding/pending                       Superadmin — review queue
POST   /onboarding/rt-groups/{id}/verify         Superadmin — approve / reject
POST   /onboarding/rt-groups/{id}/retrigger-ocr  Superadmin — re-run KTP OCR

Architecture note on ktp_* fields:
  The RTGroup *domain entity* intentionally has no ktp_* fields — those are
  infrastructure-layer concerns (OCR pipeline, document storage). The domain
  only cares about SK verification status.

  CONSEQUENCE: any route that reads or writes ktp_* fields must query
  RTGroupModel (ORM) directly via SQLAlchemy, NOT go through
  PgRTGroupRepository. Using repo.save() on an RTGroup entity would silently
  wipe ktp_* columns back to NULL because _to_entity() / save() don't
  map them. This is by design — not a bug to fix.
"""

from __future__ import annotations

import mimetypes
import os
import uuid
from typing import Literal
from uuid import UUID

import httpx
from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import require_superadmin
from app.core.exceptions import (DomainException, EntityNotFoundError,
                                 InvalidStateTransitionError)
from app.modules.iam.application.schemas import (KTPOCRDataResponse,
                                                 KTPUploadOCRResponse,
                                                 PendingRTGroupItem,
                                                 RTGroupVerificationResponse,
                                                 SubmitVerificationRequest,
                                                 SubmitVerificationResponse,
                                                 UploadDocumentResponse,
                                                 VerifyRTGroupRequest)
from app.modules.iam.application.services.ktp_ocr_service import KTPOCRService
from app.modules.iam.application.use_cases.submit_verification import \
    SubmitVerificationUseCase
from app.modules.iam.application.use_cases.verify_rt_group import \
    VerifyRTGroupUseCase
from app.modules.iam.infrastructure.models import RTGroupModel, UserModel
from app.modules.iam.infrastructure.repository import (PgRTGroupRepository,
                                                       PgUserRepository)
from fastapi import (APIRouter, Depends, File, Form, HTTPException, UploadFile,
                     status)
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])

# ─── Constants ────────────────────────────────────────────────────────────────

_ALLOWED_MIME = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}
_ALLOWED_IMAGE_MIME = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _storage_url(filename: str) -> str:
    """
    Placeholder — returns a URL the superadmin can check manually.
    Replace with real DO Spaces upload when wiring storage.

    Production swap:
        from app.core.storage import spaces_client
        url = await spaces_client.upload(raw, filename, content_type)
    """
    base = os.getenv("STORAGE_BASE_URL", "https://storage.rtmudah.com/documents")
    return f"{base}/{filename}"


def _exception_to_http(exc: Exception) -> HTTPException:
    if isinstance(exc, EntityNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (InvalidStateTransitionError, DomainException)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Terjadi kesalahan internal. Coba lagi.",
    )


def _model_to_ocr_response(m: RTGroupModel) -> KTPOCRDataResponse | None:
    """Convert RTGroupModel.ktp_ocr_data JSONB dict → KTPOCRDataResponse."""
    if not m.ktp_ocr_data:
        return None
    return KTPOCRDataResponse(**{
        k: m.ktp_ocr_data.get(k)
        for k in KTPOCRDataResponse.model_fields
    })


# ═══════════════════════════════════════════════════════════════════════════════
# POST /onboarding/upload-document
# Existing endpoint — unchanged
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/upload-document",
    response_model=UploadDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload KTP or SK document",
    description=(
        "Accepts a single file (JPG / PNG / WebP / PDF, max 10 MB). "
        "Returns a storage URL to include in submit-verification. "
        "No authentication required."
    ),
)
async def upload_document(
    file:          UploadFile           = File(..., description="KTP or SK file"),
    document_type: Literal["ktp", "sk"] = Form(..., description="'ktp' or 'sk'"),
) -> UploadDocumentResponse:

    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if content_type not in _ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Format file '{content_type}' tidak didukung. "
                "Gunakan JPG, PNG, WebP, atau PDF."
            ),
        )

    raw = await file.read()
    if len(raw) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Ukuran file maksimal 10 MB",
        )

    ext         = (file.filename or "").rsplit(".", 1)[-1].lower() or "bin"
    unique_name = f"{document_type}_{uuid.uuid4().hex}.{ext}"
    url         = _storage_url(unique_name)

    return UploadDocumentResponse(
        url=url,
        file_name=unique_name,
        size_bytes=len(raw),
        doc_type=document_type,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /onboarding/upload-ktp
# NEW — upload KTP image + immediately run OCR + persist result
# No auth — called during onboarding before JWT exists
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/upload-ktp",
    response_model=KTPUploadOCRResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload KTP image and auto-run OCR",
    description=(
        "Accepts a KTP image (JPG/PNG/WebP, max 10 MB). "
        "Stores the image, runs Google Vision OCR, cross-checks against "
        "registration data, and persists the result on the RT group. "
        "No authentication required — called during onboarding flow."
    ),
)
async def upload_ktp_with_ocr(
    file:    UploadFile = File(..., description="KTP image — JPG/PNG/WebP only"),
    user_id: str        = Form(..., description="UUID of the registering Ketua RT"),
    db:      AsyncSession = Depends(get_db),
) -> KTPUploadOCRResponse:

    # ── Validate image type ───────────────────────────────────────────────
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if content_type not in _ALLOWED_IMAGE_MIME:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"KTP harus berupa gambar (JPEG/PNG/WebP). Diterima: {content_type}",
        )

    raw = await file.read()
    if len(raw) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Ukuran file maksimal 10 MB",
        )

    # ── Resolve user ──────────────────────────────────────────────────────
    try:
        parsed_user_id = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="user_id harus berupa UUID yang valid")

    user_row = await db.get(UserModel, parsed_user_id)
    if not user_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="User tidak ditemukan")

    # ── Resolve pending RT group for this user ────────────────────────────
    # Query RTGroupModel directly — RTGroup entity has no ktp_* fields
    rt_stmt = select(RTGroupModel).where(
        RTGroupModel.admin_user_id == parsed_user_id
    )
    rt_model = (await db.execute(rt_stmt)).scalar_one_or_none()

    # ── Store file (placeholder) ──────────────────────────────────────────
    ext         = (file.filename or "ktp").rsplit(".", 1)[-1].lower() or "jpg"
    unique_name = f"ktp_{uuid.uuid4().hex}.{ext}"
    ktp_url     = _storage_url(unique_name)

    # ── Run OCR ───────────────────────────────────────────────────────────
    ktp_service = KTPOCRService(google_vision_api_key=settings.GOOGLE_VISION_API_KEY)
    ocr_result  = await ktp_service.verify(
        image_bytes=raw,
        registered_name=user_row.full_name,
        registered_rt=rt_model.rt_number  if rt_model else "",
        registered_rw=rt_model.rw_number  if rt_model else "",
        registered_kelurahan=rt_model.kelurahan if rt_model else "",
    )

    ocr_dict = ocr_result.to_ocr_data_dict()

    # ── Persist KTP URL + OCR result directly on RTGroupModel ────────────
    # Must use direct update() — NOT repo.save() which would wipe ktp_* fields
    if rt_model:
        await db.execute(
            update(RTGroupModel)
            .where(RTGroupModel.id == rt_model.id)
            .values(
                ktp_document_url=ktp_url,
                ktp_ocr_data=ocr_dict,
                ktp_ocr_flags=[f.value for f in ocr_result.flags],
                ktp_ocr_confidence=ocr_result.confidence_score,
            )
        )
        await db.commit()

    extracted = KTPOCRDataResponse(**ocr_dict) if ocr_dict else None

    return KTPUploadOCRResponse(
        ktp_document_url=ktp_url,
        ocr_success=ocr_result.success,
        confidence_score=ocr_result.confidence_score,
        flags=[f.value for f in ocr_result.flags],
        suggested_action=ocr_result.suggested_action,
        extracted=extracted,
        error=ocr_result.error_message,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /onboarding/submit-verification
# Existing endpoint — unchanged
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/submit-verification",
    response_model=SubmitVerificationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit full Ketua RT verification package",
    description=(
        "Receives KTP URL, SK URL, base64 signature, and RT identity. "
        "Creates the RTGroup in pending_verification state and upgrades "
        "the user role to ketua_rt. Idempotent — re-submitting replaces "
        "a previous rejection."
    ),
)
async def submit_verification(
    payload: SubmitVerificationRequest,
    db:      AsyncSession = Depends(get_db),
) -> SubmitVerificationResponse:

    use_case = SubmitVerificationUseCase(
        user_repo=PgUserRepository(db),
        rt_group_repo=PgRTGroupRepository(db),
    )

    try:
        rt_group = await use_case.execute(
            user_id=payload.user_id,
            ktp_url=payload.ktp_url,
            sk_url=payload.sk_url,
            signature_data=payload.signature_data,
            rt_number=payload.rt_number,
            rw_number=payload.rw_number,
            kelurahan=payload.kelurahan,
            kecamatan=payload.kecamatan,
            kota=payload.kota,
            sk_valid_until=payload.sk_valid_until,
        )
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "RT ini sudah terdaftar oleh akun lain. "
                "Jika Anda adalah Ketua RT yang sah, hubungi support@rtmudah.com"
            ),
        )
    except (EntityNotFoundError, InvalidStateTransitionError, DomainException) as exc:
        raise _exception_to_http(exc)

    return SubmitVerificationResponse(
        status=rt_group.verification_status.value,
        rt_group_id=rt_group.id,
        rt_identity=str(rt_group.identity),
        message=(
            "Dokumen Anda telah diterima dan sedang ditinjau oleh tim RTMudah. "
            "Kami akan menghubungi Anda via WhatsApp dalam 1×24 jam."
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /onboarding/pending
# UPDATED — now joins UserModel + RTGroupModel directly to include OCR fields
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/pending",
    response_model=list[PendingRTGroupItem],
    summary="List RT groups pending verification (superadmin only)",
)
async def list_pending_verification(
    _current_user = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> list[PendingRTGroupItem]:
    """
    Query RTGroupModel directly (not via repository) so we can include
    ktp_ocr_* fields that the domain entity intentionally doesn't carry.
    Joined with UserModel for admin name + phone in one query.
    """
    stmt = (
        select(RTGroupModel, UserModel)
        .join(UserModel, RTGroupModel.admin_user_id == UserModel.id)
        .where(
            RTGroupModel.verification_status == "pending_verification"
        )
        .order_by(RTGroupModel.created_at.asc())   # FIFO — oldest first
    )
    rows = (await db.execute(stmt)).fetchall()

    return [
        PendingRTGroupItem(
            id=rt.id,
            rt_identity=str(f"RT {rt.rt_number}/RW {rt.rw_number}, "
                            f"Kel. {rt.kelurahan}, Kec. {rt.kecamatan}, {rt.kota}"),
            admin_full_name=user.full_name,
            admin_phone=user.phone,
            ktp_url=rt.ktp_document_url,
            sk_url=rt.sk_document_url,
            created_at=rt.created_at,
            ktp_ocr_confidence=rt.ktp_ocr_confidence,
            ktp_ocr_flags=rt.ktp_ocr_flags or [],
            ktp_verified=rt.ktp_verified,
            ktp_ocr_data=_model_to_ocr_response(rt),
        )
        for rt, user in rows
    ]

# ═══════════════════════════════════════════════════════════════════════════════
# GET /onboarding/platform-stats
# Superadmin only — platform-wide health numbers
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/platform-stats",
    summary="Platform-wide stats (superadmin only)",
)
async def get_platform_stats(
    _current_user = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Returns platform-wide counts for the superadmin dashboard.
    All queries are direct COUNT aggregates — fast, no ORM overhead.
    """
    from app.modules.warga.infrastructure.models import ResidentModel
    from sqlalchemy import func

    # RT group counts by verification_status
    rt_counts_result = await db.execute(
        select(RTGroupModel.verification_status, func.count().label("cnt"))
        .group_by(RTGroupModel.verification_status)
    )
    rt_counts = dict(rt_counts_result.fetchall())

    # Total users (all roles)
    total_users = await db.scalar(
        select(func.count()).select_from(UserModel)
    )

    # Total warga (residents across all RTs)
    total_warga = await db.scalar(
        select(func.count()).select_from(ResidentModel)
    )

    # Recent signups — last 5 RT groups regardless of status
    recent_result = await db.execute(
        select(RTGroupModel, UserModel)
        .join(UserModel, RTGroupModel.admin_user_id == UserModel.id)
        .order_by(RTGroupModel.created_at.desc())
        .limit(5)
    )
    recent_rows = recent_result.fetchall()

    recent_rts = [
        {
            "id":                  str(rt.id),
            "rt_identity":         (
                f"RT {rt.rt_number}/RW {rt.rw_number}, "
                f"Kel. {rt.kelurahan}, {rt.kota}"
            ),
            "admin_name":          user.full_name,
            "verification_status": rt.verification_status,
            "created_at":          rt.created_at.isoformat(),
        }
        for rt, user in recent_rows
    ]

    return {
        "rt_groups": {
            "total":    sum(rt_counts.values()),
            "active":   rt_counts.get("active", 0),
            "pending":  rt_counts.get("pending_verification", 0),
            "rejected": rt_counts.get("rejected", 0),
            "expired":  rt_counts.get("expired", 0),
        },
        "total_users":  total_users  or 0,
        "total_warga":  total_warga  or 0,
        "recent_rts":   recent_rts,
    }

# ═══════════════════════════════════════════════════════════════════════════════
# POST /onboarding/rt-groups/{rt_group_id}/verify
# Existing endpoint — unchanged
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/rt-groups/{rt_group_id}/verify",
    response_model=RTGroupVerificationResponse,
    summary="Approve or reject a Ketua RT verification (superadmin only)",
)
async def verify_rt_group(
    rt_group_id:  uuid.UUID,
    payload:      VerifyRTGroupRequest,
    current_user  = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> RTGroupVerificationResponse:

    if payload.action == "reject" and not payload.rejection_reason:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="rejection_reason wajib diisi saat action='reject'",
        )

    use_case = VerifyRTGroupUseCase(
        rt_group_repo=PgRTGroupRepository(db),
        user_repo=PgUserRepository(db),
    )

    try:
        rt_group = await use_case.execute(
            rt_group_id=rt_group_id,
            superadmin_id=UUID(current_user["user_id"]),
            action=payload.action,
            rejection_reason=payload.rejection_reason,
        )
    except (EntityNotFoundError, InvalidStateTransitionError, DomainException) as exc:
        raise _exception_to_http(exc)
    
    # ── Auto-create 7-day trial on approval ───────────────────────────────
    if payload.action == "approve":
        import uuid as _uuid
        from datetime import datetime, timedelta, timezone

        from app.modules.subscription.infrastructure.models import \
            RTSubscriptionModel
        from sqlalchemy import select as sa_select

        existing_sub = await db.execute(
            sa_select(RTSubscriptionModel).where(
                RTSubscriptionModel.rt_group_id == rt_group.id
            )
        )
        if not existing_sub.scalar_one_or_none():
            now = datetime.now(timezone.utc)
            trial = RTSubscriptionModel(
                id            = _uuid.uuid4(),
                rt_group_id   = rt_group.id,
                plan          = "trial",
                status        = "trial",
                trial_ends_at = now + timedelta(days=7),
            )
            db.add(trial)
            await db.commit()
    # ─────────────────────────────────────────────────────────────────────

    action_msg = {
        "approve": "Akun Ketua RT berhasil diaktifkan. Notifikasi WhatsApp akan dikirim.",
        "reject":  "Verifikasi ditolak. Notifikasi penolakan akan dikirim via WhatsApp.",
    }[payload.action]

    return RTGroupVerificationResponse(
        id=rt_group.id,
        rt_identity=str(rt_group.identity),
        verification_status=rt_group.verification_status.value,
        verified_at=rt_group.verified_at,
        verified_by=rt_group.verified_by,
        rejection_reason=rt_group.rejection_reason,
        sk_valid_until=rt_group.sk_valid_until,
        needs_renewal=rt_group.needs_renewal,
        message=action_msg,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /onboarding/rt-groups/{rt_group_id}/retrigger-ocr
# NEW — superadmin re-runs OCR on already-uploaded KTP image
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/rt-groups/{rt_group_id}/retrigger-ocr",
    summary="Re-run KTP OCR on existing image (superadmin only)",
    description=(
        "Fetches the stored KTP image and re-runs the OCR pipeline. "
        "Useful when the Ketua RT uploads a better photo after an initial "
        "low-confidence or unreadable result."
    ),
)
async def retrigger_ktp_ocr(
    rt_group_id:  uuid.UUID,
    current_user  = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> dict:

    # ── Fetch RTGroupModel + UserModel directly (need ktp_* + user name) ─
    stmt = (
        select(RTGroupModel, UserModel)
        .join(UserModel, RTGroupModel.admin_user_id == UserModel.id)
        .where(RTGroupModel.id == rt_group_id)
    )
    row = (await db.execute(stmt)).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="RT group tidak ditemukan")

    rt_model, user_model = row

    if not rt_model.ktp_document_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Belum ada foto KTP yang diupload untuk RT group ini",
        )

    # ── Fetch image from storage ──────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            img_resp = await client.get(rt_model.ktp_document_url)
            img_resp.raise_for_status()
            image_bytes = img_resp.content
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gagal mengambil gambar KTP dari storage: HTTP {exc.response.status_code}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gagal mengambil gambar KTP dari storage: {exc}",
        )

    # ── Re-run OCR ────────────────────────────────────────────────────────
    ktp_service = KTPOCRService(google_vision_api_key=settings.GOOGLE_VISION_API_KEY)
    ocr_result  = await ktp_service.verify(
        image_bytes=image_bytes,
        registered_name=user_model.full_name,
        registered_rt=rt_model.rt_number,
        registered_rw=rt_model.rw_number,
        registered_kelurahan=rt_model.kelurahan,
    )

    ocr_dict = ocr_result.to_ocr_data_dict()

    # ── Persist updated OCR result ────────────────────────────────────────
    # Direct update — NOT repo.save() which would wipe ktp_* fields
    await db.execute(
        update(RTGroupModel)
        .where(RTGroupModel.id == rt_group_id)
        .values(
            ktp_ocr_data=ocr_dict,
            ktp_ocr_flags=[f.value for f in ocr_result.flags],
            ktp_ocr_confidence=ocr_result.confidence_score,
        )
    )
    await db.commit()

    return {
        "ocr_success":      ocr_result.success,
        "confidence_score": ocr_result.confidence_score,
        "flags":            [f.value for f in ocr_result.flags],
        "suggested_action": ocr_result.suggested_action,
        "extracted":        ocr_dict,
        "error":            ocr_result.error_message,
    }
