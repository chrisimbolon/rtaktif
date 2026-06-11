"""
rtmudah.com — FastAPI entry point.
Thin orchestration only: register routers, middleware, lifespan.
Zero business logic here.
"""
import logging
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine
# Event bus subscriptions (wire up cross-module event handlers here)
from app.core.events import event_bus
from app.core.logging import setup_logging
from app.core.middleware import log_requests
from app.modules.iam.presentation.api.v1.onboarding_routes import \
    router as onboarding_router
# Module routers
from app.modules.iam.presentation.api.v1.routes import router as iam_router
from app.modules.komunikasi.domain.events import AnnouncementPublished
from app.modules.komunikasi.presentation.api.v1.routes import \
    router as komunikasi_router
from app.modules.subscription.infrastructure.models import (
    RTSubscriptionModel, SubscriptionPaymentModel)
from app.modules.subscription.presentation.api.v1.routes import \
    router as subscription_router
from app.modules.tagihan.domain.events import InvoiceGenerated
from app.modules.tagihan.presentation.api.v1.routes import \
    router as tagihan_router
from app.modules.warga.presentation.api.v1.routes import router as warga_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger("rukunrt")

async def _on_invoice_generated(event: InvoiceGenerated):
    """
    Cross-module event handler:
    When Tagihan generates invoices → Komunikasi can react (e.g. queue WA reminders).
    Decoupled: Tagihan domain never imports Komunikasi.
    """
    logger.info(f"[EVENT] InvoiceGenerated: invoice={event.invoice_id} resident={event.resident_id}")
    # TODO: enqueue WA reminder job


async def _on_announcement_published(event: AnnouncementPublished):
    logger.info(f"[EVENT] AnnouncementPublished: id={event.announcement_id} channel={event.channel}")
    # TODO: trigger push notification / WA blast if channel includes whatsapp


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging(debug=settings.DEBUG)
    logger.info(f"Starting {settings.APP_NAME} [{settings.APP_ENV}]")

    # Register cross-module event handlers
    event_bus.subscribe(InvoiceGenerated, _on_invoice_generated)
    event_bus.subscribe(AnnouncementPublished, _on_announcement_published)

    # ── ADD: WA notification after payment confirmed ──────────────────
    from app.modules.tagihan.application.use_cases.notify_payment_confirmed import \
        NotifyPaymentConfirmed
    from app.modules.tagihan.domain.events import PaymentConfirmed
    notifier = NotifyPaymentConfirmed()
    event_bus.subscribe(PaymentConfirmed, notifier.handle)
    logger.info("WA payment confirmed handler registered")
    # ─────────────────────────────────────────────────────────────────

    yield

    # Shutdown
    await engine.dispose()
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description="RT/RW Neighbourhood Management — DDD Modular Monolith",
        version="1.0.0",
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        docs_url=f"{settings.API_V1_PREFIX}/docs",
        redoc_url=f"{settings.API_V1_PREFIX}/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.middleware("http")(log_requests)

    # ── ADD: serve uploaded bukti bayar files ─────────────────────────
    import os

    from fastapi.staticfiles import StaticFiles
    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp/rtmudah_uploads")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
    # ─────────────────────────────────────────────────────────────────

    # Register all module routers under /api/v1
    prefix = settings.API_V1_PREFIX
    app.include_router(iam_router,         prefix=prefix)
    app.include_router(warga_router,       prefix=prefix)
    app.include_router(tagihan_router,     prefix=prefix)
    app.include_router(komunikasi_router,  prefix=prefix)
    app.include_router(onboarding_router,  prefix=prefix)
    app.include_router(subscription_router, prefix=prefix)

    @app.get("/health", tags=["Health"])
    async def health():
        return {"status": "healthy", "app": settings.APP_NAME, "env": settings.APP_ENV}

    return app


app = create_app()
