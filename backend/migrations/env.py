"""
Alembic env.py — async PostgreSQL setup.

Critical: ALL model classes must be imported here so Alembic's
autogenerate can detect schema changes. If a model is missing,
autogenerate will emit DROP TABLE for it on the next --autogenerate run.
"""
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# ── Import ALL models — this is what makes autogenerate work ───────
from app.core.database import Base                               # shared Base

from app.modules.iam.infrastructure.models import (             # IAM
    UserModel, RTGroupModel,
)
from app.modules.warga.infrastructure.models import (           # Warga
    ResidentModel,
)
from app.modules.tagihan.infrastructure.models import (         # Tagihan
    InvoiceModel, PaymentModel,
)
from app.modules.komunikasi.infrastructure.models import (      # Komunikasi
    AnnouncementModel, LaporanModel, NotificationLogModel,
)

# ── Alembic config ─────────────────────────────────────────────────
from app.core.config import settings

config = context.config

# Override sqlalchemy.url with value from our pydantic settings
# (never hardcode credentials in alembic.ini)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ── Offline migrations (generates SQL without a live DB) ───────────
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Render TIMESTAMPTZ correctly in generated SQL
        render_as_batch=False,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online migrations (runs against live DB) ───────────────────────
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # Compare types so autogenerate detects VARCHAR → TEXT changes etc
        compare_type=True,
        # Compare server defaults
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
