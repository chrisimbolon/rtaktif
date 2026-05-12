"""
Async SQLAlchemy engine + session factory + custom types.

Key additions vs original:
  - TZDateTime: timezone-aware timestamp type (TIMESTAMPTZ in PostgreSQL)
    All datetime columns use this instead of naive DateTime.
    Values are stored as UTC, displayed as WIB (UTC+7) in the app layer.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import TypeDecorator

from app.core.config import settings

print("🔥 DATABASE_URL USED BY ENGINE:", settings.DATABASE_URL)
# ── Timezone-aware DateTime type ──────────────────────────────────
class TZDateTime(TypeDecorator):
    """
    Stores datetime as TIMESTAMPTZ (UTC) in PostgreSQL.
    Returns timezone-aware datetime objects in Python.

    Why:
      - Naive datetime (no tz) causes silent bugs when Indonesia
        switches DST or when comparing timestamps from different sources.
      - TIMESTAMPTZ in Postgres stores UTC internally, displays correctly
        regardless of server timezone setting.
    """
    impl         = DateTime(timezone=True)
    cache_ok     = True

    def process_bind_param(self, value: Optional[datetime], dialect) -> Optional[datetime]:
        if value is None:
            return None
        # If naive datetime passed in, assume UTC
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value: Optional[datetime], dialect) -> Optional[datetime]:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


# ── Engine ─────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """
    Shared declarative base — imported by ALL infrastructure/models.py files.
    Never import individual model classes across module boundaries —
    always import via the module's own infrastructure layer.
    """
    pass


async def get_db():
    """FastAPI dependency — yields a transactional async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
