"""
RukunRT — FastAPI entry point.
Thin orchestration only: register routers, middleware, lifespan.
Zero business logic here.
"""
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine
from app.core.logging import setup_logging
from app.core.middleware import log_requests

# Module routers
from app.modules.iam.presentation.api.v1.routes import router as iam_router
from app.modules.warga.presentation.api.v1.routes import router as warga_router
from app.modules.tagihan.presentation.api.v1.routes import router as tagihan_router
from app.modules.komunikasi.presentation.api.v1.routes import router as komunikasi_router
from app.modules.iam.presentation.api.v1.onboarding_routes import router as onboarding_router

# Event bus subscriptions (wire up cross-module event handlers here)
from app.core.events import event_bus
from app.modules.tagihan.domain.events import InvoiceGenerated
from app.modules.komunikasi.domain.events import AnnouncementPublished


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

    # Register all module routers under /api/v1
    prefix = settings.API_V1_PREFIX
    app.include_router(iam_router,         prefix=prefix)
    app.include_router(warga_router,       prefix=prefix)
    app.include_router(tagihan_router,     prefix=prefix)
    app.include_router(komunikasi_router,  prefix=prefix)
    app.include_router(onboarding_router,  prefix=prefix)

    @app.get("/health", tags=["Health"])
    async def health():
        return {"status": "healthy", "app": settings.APP_NAME, "env": settings.APP_ENV}

    return app


app = create_app()
