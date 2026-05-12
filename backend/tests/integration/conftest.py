"""
Integration test configuration.
Sets up a clean test database state for each test session.
"""
import asyncio
import pytest
import os

# Override DB URL for testing if not already set
if "pytest" in os.environ.get("_", ""):
    os.environ.setdefault(
        "DATABASE_URL",
        "postgresql+asyncpg://rukunrt:rukunrt_secret@db:5432/rukunrt_db"
    )
    os.environ.setdefault("SECRET_KEY",     "test-secret-key")
    os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-key")
    os.environ.setdefault("REDIS_URL",      "redis://:redis_secret@redis:6379/1")


@pytest.fixture(scope="session")
def event_loop():
    """Use a single event loop for the entire test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    """
    Run migrations before integration tests start.
    Uses a separate Redis DB (index 1) to avoid polluting dev data.
    """
    from app.core.database import engine, Base

    # Import all models so Alembic/SQLAlchemy knows about them
    from app.modules.iam.infrastructure.models import UserModel, RTGroupModel
    from app.modules.warga.infrastructure.models import ResidentModel
    from app.modules.tagihan.infrastructure.models import InvoiceModel
    from app.modules.komunikasi.infrastructure.models import AnnouncementModel, LaporanModel

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    # Teardown: drop all test tables after session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()
