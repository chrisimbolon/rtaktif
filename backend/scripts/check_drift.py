#!/usr/bin/env python3
"""
RukunRT — Schema Drift Checker
===============================
Compares SQLAlchemy ORM models against the LIVE database and reports
any differences. Run this BEFORE deploying new code to catch drift
between what the code expects and what the DB actually has.

Usage:
  python scripts/check_drift.py

Returns exit code 0 if no drift, 1 if drift detected.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

GREEN = "\033[0;32m"; RED = "\033[0;31m"; YELLOW = "\033[1;33m"
BOLD  = "\033[1m";    NC  = "\033[0m"


async def main():
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        print(f"{RED}ERROR: DATABASE_URL not set{NC}")
        sys.exit(1)

    # Import all models to register them with Base.metadata
    from app.core.database import Base, engine
    from app.modules.iam.infrastructure.models import UserModel, RTGroupModel
    from app.modules.warga.infrastructure.models import ResidentModel
    from app.modules.tagihan.infrastructure.models import InvoiceModel, PaymentModel
    from app.modules.komunikasi.infrastructure.models import (
        AnnouncementModel, LaporanModel, NotificationLogModel
    )

    from alembic.config import Config
    from alembic.runtime.migration import MigrationContext
    from alembic.autogenerate import compare_metadata
    from sqlalchemy.ext.asyncio import create_async_engine

    eng = create_async_engine(db_url, echo=False)

    print(f"\n{BOLD}RukunRT Schema Drift Check{NC}")
    print("=" * 50)

    async with eng.connect() as conn:
        def run_check(sync_conn):
            ctx = MigrationContext.configure(sync_conn)
            diffs = compare_metadata(ctx, Base.metadata)
            return diffs

        diffs = await conn.run_sync(run_check)

    await eng.dispose()

    if not diffs:
        print(f"{GREEN}{BOLD}✅ No schema drift — DB perfectly matches ORM models{NC}\n")
        sys.exit(0)
    else:
        print(f"{RED}{BOLD}❌ Schema drift detected — {len(diffs)} difference(s):{NC}\n")
        for diff in diffs:
            print(f"  {RED}•{NC} {diff}")
        print(f"\n{YELLOW}Fix: run 'alembic revision --autogenerate -m \"fix_drift\"' then review the generated migration{NC}\n")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
