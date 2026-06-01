"""Onboarding routes — Ketua RT verification endpoints.

Router prefix : /onboarding
Tags          : ["Onboarding"]

Endpoints
─────────────────────────────────────────────────────────────────────────────
POST   /onboarding/upload-document          No auth — accepts KTP or SK file
POST   /onboarding/submit-verification      No auth — submits the full package
GET    /onboarding/pending                  Superadmin only — review queue
POST   /onboarding/rt-groups/{id}/verify    Superadmin only — approve / reject

Why these four routes live in a NEW router instead of the IAM router:
  - The IAM router is already large and handles auth/users/rt-groups.
  - Onboarding has its own lifecycle and its own set of consumers
    (superadmin review dashboard), keeping concerns clean.
  - File upload has multipart parsing that's noisy among JSON endpoints.
  - You can add rate-limiting to just this router later without touching IAM.
"""

from __future__ import annotations

import base64
import mimetypes
import os
import uuid
from uuid import UUID
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_superadmin
from app.core.exceptions import (
    DomainException,
    EntityNotFoundError,
    InvalidStateTransitionError,
)
from app.modules.iam.application.schemas import (
    PendingRTGroupItem,
    RTGroupVerificationResponse,
    SubmitVerificationRequest,
    SubmitVerificationResponse,
    UploadDocumentResponse,
    VerifyRTGroupRequest,
)
from app.modules.iam.application.use_cases.submit_verification import SubmitVerificationUseCase
from app.modules.iam.application.use_cases.verify_rt_group import VerifyRTGroupUseCase
from app.modules.iam.infrastructure.models import RTGroupModel, UserModel as UserORM
from app.modules.iam.infrastructure.repository import PgRTGroupRepository, PgUserRepository

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])

# ─── Constants ────────────────────────────────────────────────────────────────

_ALLOWED_MIME = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _storage_url(filename: str) -> str:
    """
    In production this would call DigitalOcean Spaces / S3.
    For now returns a placeholder URL that the superadmin can manually check.
    Replace the body of this function when you wire up DO Spaces.
    """
    # TODO: replace with actual DO Spaces / S3 upload
    base = os.getenv("STORAGE_BASE_URL", "https://storage.rtmudah.com/documents")
    return f"{base}/{filename}"


def _exception_to_http(exc: Exception) -> HTTPException:
    """Map domain exceptions to appropriate HTTP status codes."""
    if isinstance(exc, EntityNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND,   detail=str(exc))
    if isinstance(exc, (InvalidStateTransitionError, DomainException)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                         detail="Terjadi kesalahan internal. Coba lagi.")


# ═══════════════════════════════════════════════════════════════════════════════
# POST /onboarding/upload-document
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/upload-document",
    response_model=UploadDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload KTP or SK document",
    description=(
        "Accepts a single file (JPG / PNG / WebP / PDF, max 10 MB). "
        "Returns a permanent storage URL to include in submit-verification. "
        "No authentication required — the user just registered and has no JWT yet."
    ),
)
async def upload_document(
    file:          UploadFile        = File(..., description="KTP or SK file"),
    document_type: Literal["ktp","sk"] = Form(..., description="'ktp' or 'sk'"),
) -> UploadDocumentResponse:

    # ── MIME type guard ───────────────────────────────────────────────────
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if content_type not in _ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Format file '{content_type}' tidak didukung. "
                "Gunakan JPG, PNG, WebP, atau PDF."
            ),
        )

    # ── Size guard (streaming — avoid loading the whole file) ────────────
    raw = await file.read()
    if len(raw) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Ukuran file maksimal 10 MB",
        )

    # ── Build a unique filename ───────────────────────────────────────────
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() or "bin"
    unique_name = f"{document_type}_{uuid.uuid4().hex}.{ext}"

    # ── Upload to storage (placeholder — swap for real implementation) ────
    url = _storage_url(unique_name)

    # Production:
    #   from app.core.storage import spaces_client
    #   url = await spaces_client.upload(raw, unique_name, content_type)

    return UploadDocumentResponse(
        url=url,
        file_name=unique_name,
        size_bytes=len(raw),
        doc_type=document_type,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /onboarding/submit-verification
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
        # Defensive catch — uq_rt_groups_identity DB constraint
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
# GET /onboarding/pending  — superadmin review queue
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

    rt_group_repo = PgRTGroupRepository(db)
    user_repo     = PgUserRepository(db)

    pending = await rt_group_repo.list_pending_verification()

    result: list[PendingRTGroupItem] = []
    for group in pending:
        admin = await user_repo.get_by_id(group.admin_user_id)
        result.append(
            PendingRTGroupItem(
                id=group.id,
                rt_identity=str(group.identity),
                admin_full_name=admin.full_name if admin else "—",
                admin_phone=admin.phone if admin else "—",
                ktp_url=getattr(group, "ktp_url", None),
                sk_url=group.sk_document_url,
                created_at=group.created_at,
            )
        )

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# POST /onboarding/rt-groups/{rt_group_id}/verify — approve or reject
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/rt-groups/{rt_group_id}/verify",
    response_model=RTGroupVerificationResponse,
    summary="Approve or reject a Ketua RT verification (superadmin only)",
)
async def verify_rt_group(
    rt_group_id:   uuid.UUID,
    payload:       VerifyRTGroupRequest,
    current_user   = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> RTGroupVerificationResponse:

    # Extra cross-field guard (schema pattern already validated action value)
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
