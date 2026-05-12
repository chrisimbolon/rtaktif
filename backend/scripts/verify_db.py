#!/usr/bin/env python3
"""
RukunRT — Database Verification Script
=======================================
Run AFTER alembic upgrade head to confirm:
  1. All 8 tables exist with correct columns
  2. All foreign keys are in place
  3. All unique constraints exist
  4. All indexes (including composites) exist
  5. TIMESTAMPTZ on all datetime columns
  6. TEXT columns are TEXT not VARCHAR

Usage:
  python scripts/verify_db.py

Set DATABASE_URL env var first, e.g.:
  export DATABASE_URL="postgresql+asyncpg://rtaktif_user:rtaktif123@localhost:5432/rtaktif_db"
"""
import asyncio
import os
import sys

# Colour helpers
GREEN  = "\033[0;32m"
RED    = "\033[0;31m"
YELLOW = "\033[1;33m"
BOLD   = "\033[1m"
NC     = "\033[0m"

ok   = lambda msg: print(f"  {GREEN}✓{NC} {msg}")
fail = lambda msg: print(f"  {RED}✗{NC} {msg}")
warn = lambda msg: print(f"  {YELLOW}⚠{NC} {msg}")
section = lambda msg: print(f"\n{BOLD}{msg}{NC}\n{'─'*50}")

PASS = 0
FAIL = 0

def check(condition: bool, msg_ok: str, msg_fail: str) -> bool:
    global PASS, FAIL
    if condition:
        ok(msg_ok);     PASS += 1
    else:
        fail(msg_fail); FAIL += 1
    return condition


async def verify(conn):
    global PASS, FAIL
    # ── 1. Tables ────────────────────────────────────────────────
    section("1. Tables")

    EXPECTED_TABLES = [
        "rt_groups", "users", "residents",
        "invoices", "payments",
        "announcements", "laporan_warga", "notification_logs",
        "alembic_version",
    ]

    result = await conn.fetch("""
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    """)
    existing = {r["tablename"] for r in result}

    for t in EXPECTED_TABLES:
        check(t in existing, f"Table '{t}' exists", f"Table '{t}' MISSING")

    extra = existing - set(EXPECTED_TABLES)
    if extra:
        warn(f"Extra tables (unexpected): {extra}")

    # ── 2. Column types — TIMESTAMPTZ ───────────────────────────
    section("2. Timestamp columns (must be TIMESTAMPTZ)")

    tz_result = await conn.fetch("""
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type NOT IN ('timestamp with time zone', 'text', 'character varying',
                                'integer', 'boolean', 'uuid')
          AND column_name IN ('created_at','updated_at','paid_at','verified_at',
                              'resolved_at','sent_at')
        ORDER BY table_name, column_name
    """)

    if tz_result:
        for r in tz_result:
            fail(f"{r['table_name']}.{r['column_name']} is {r['data_type']} — should be TIMESTAMPTZ")
            FAIL += 1
    else:
        ok("All timestamp columns are TIMESTAMPTZ ✓")
        PASS += 1

    # Check they're all timestamptz
    ts_cols = await conn.fetch("""
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name IN ('created_at','updated_at','paid_at','verified_at',
                              'resolved_at','sent_at')
        ORDER BY table_name, column_name
    """)
    for r in ts_cols:
        check(
            r["data_type"] == "timestamp with time zone",
            f"{r['table_name']}.{r['column_name']} → timestamptz ✓",
            f"{r['table_name']}.{r['column_name']} → {r['data_type']} ✗ (expected timestamptz)",
        )

    # ── 3. TEXT columns ──────────────────────────────────────────
    section("3. TEXT columns (no artificial VARCHAR limits)")

    TEXT_EXPECTED = [
        ("invoices",          "notes"),
        ("payments",          "notes"),
        ("announcements",     "body"),
        ("laporan_warga",     "description"),
        ("laporan_warga",     "resolution_notes"),
        ("notification_logs", "error_detail"),
    ]

    for table, col in TEXT_EXPECTED:
        result = await conn.fetchrow("""
            SELECT data_type FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1 AND column_name = $2
        """, table, col)
        if result:
            check(
                result["data_type"] == "text",
                f"{table}.{col} is TEXT ✓",
                f"{table}.{col} is {result['data_type']} — should be TEXT",
            )
        else:
            fail(f"{table}.{col} column NOT FOUND")
            FAIL += 1

    # ── 4. Foreign Keys ──────────────────────────────────────────
    section("4. Foreign Key Constraints")

    FK_EXPECTED = [
        # (from_table,          from_col,      to_table,     delete_rule)
        ("users",              "rt_group_id",  "rt_groups",  "SET NULL"),
        ("residents",          "rt_group_id",  "rt_groups",  "RESTRICT"),
        ("residents",          "user_id",      "users",      "CASCADE"),
        ("invoices",           "resident_id",  "residents",  "RESTRICT"),
        ("invoices",           "rt_group_id",  "rt_groups",  "RESTRICT"),
        ("payments",           "invoice_id",   "invoices",   "RESTRICT"),
        ("payments",           "resident_id",  "residents",  "RESTRICT"),
        ("announcements",      "rt_group_id",  "rt_groups",  "CASCADE"),
        ("announcements",      "created_by",   "users",      "SET NULL"),
        ("laporan_warga",      "rt_group_id",  "rt_groups",  "CASCADE"),
        ("laporan_warga",      "resident_id",  "residents",  "CASCADE"),
        ("notification_logs",  "rt_group_id",  "rt_groups",  "CASCADE"),
    ]

    fk_result = await conn.fetch("""
        SELECT
            tc.table_name             AS from_table,
            kcu.column_name           AS from_col,
            ccu.table_name            AS to_table,
            rc.delete_rule            AS delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY from_table, from_col
    """)

    existing_fks = {
        (r["from_table"], r["from_col"]): (r["to_table"], r["delete_rule"])
        for r in fk_result
    }

    for from_table, from_col, to_table, delete_rule in FK_EXPECTED:
        key = (from_table, from_col)
        if key in existing_fks:
            actual_to, actual_del = existing_fks[key]
            if actual_to == to_table and actual_del == delete_rule:
                ok(f"FK {from_table}.{from_col} → {to_table} ({delete_rule}) ✓")
                PASS += 1
            else:
                fail(f"FK {from_table}.{from_col} → got ({actual_to}, {actual_del}), expected ({to_table}, {delete_rule})")
                FAIL += 1
        else:
            fail(f"FK {from_table}.{from_col} → {to_table} MISSING")
            FAIL += 1

    # ── 5. Unique Constraints ────────────────────────────────────
    section("5. Unique Constraints")

    UQ_EXPECTED = [
        ("users",     "uq_users_email"),
        ("users",     "uq_users_phone"),
        ("residents", "uq_residents_rt_user"),
        ("invoices",  "uq_invoices_resident_period"),
        ("rt_groups", "uq_rt_groups_location"),
    ]

    uq_result = await conn.fetch("""
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.constraint_type = 'UNIQUE'
          AND tc.table_schema = 'public'
    """)
    existing_uq = {(r["table_name"], r["constraint_name"]) for r in uq_result}

    for table, constraint in UQ_EXPECTED:
        check(
            (table, constraint) in existing_uq,
            f"UNIQUE {constraint} on {table} ✓",
            f"UNIQUE {constraint} on {table} MISSING",
        )

    # ── 6. Indexes (including composites) ────────────────────────
    section("6. Indexes (including composite)")

    IDX_EXPECTED = [
        # Single column
        "ix_users_email",
        "ix_users_rt_group_id",
        "ix_residents_rt_group_id",
        "ix_residents_user_id",
        "ix_residents_status",
        "ix_invoices_resident_id",
        "ix_invoices_status",
        "ix_payments_invoice_id",
        "ix_payments_resident_id",
        "ix_payments_paid_at",
        "ix_laporan_resident",
        "ix_laporan_status",
        # Composite
        "ix_users_role_status",
        "ix_residents_rt_status",
        "ix_invoices_rt_period",
        "ix_invoices_rt_status",
        "ix_announcements_rt_created",
        "ix_laporan_rt_status",
        "ix_notif_rt_sent_at",
        "ix_notif_type_status",
    ]

    idx_result = await conn.fetch("""
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY indexname
    """)
    existing_idx = {r["indexname"] for r in idx_result}

    for idx in IDX_EXPECTED:
        check(
            idx in existing_idx,
            f"Index {idx} ✓",
            f"Index {idx} MISSING",
        )

    # ── 7. Alembic version ───────────────────────────────────────
    section("7. Alembic Migration State")

    ver = await conn.fetchrow("SELECT version_num FROM alembic_version")
    if ver:
        check(
            ver["version_num"] == "a1b2c3d4e5f6",
            f"Alembic at revision a1b2c3d4e5f6 ✓",
            f"Alembic at wrong revision: {ver['version_num']}",
        )
    else:
        fail("alembic_version table empty — migrations never ran!")
        FAIL += 1

    # ── 8. PostgreSQL extensions ─────────────────────────────────
    section("8. PostgreSQL Extensions")

    ext_result = await conn.fetch("""
        SELECT extname FROM pg_extension ORDER BY extname
    """)
    extensions = {r["extname"] for r in ext_result}
    check("uuid-ossp" in extensions, "uuid-ossp extension installed ✓",
          "uuid-ossp extension MISSING — run: CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")

    # ── 9. Quick row counts (sanity check) ───────────────────────
    section("9. Table Row Counts (sanity check)")

    for table in ["rt_groups", "users", "residents", "invoices",
                  "payments", "announcements", "laporan_warga", "notification_logs"]:
        count = await conn.fetchval(f'SELECT COUNT(*) FROM "{table}"')
        print(f"  {'📊'} {table:<25} {count} rows")


async def main():
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        print(f"{RED}ERROR: DATABASE_URL not set{NC}")
        print(f"Export it first:\n  export DATABASE_URL='postgresql://rtaktif_user:rtaktif123@localhost:5432/rtaktif_db'")
        sys.exit(1)

    # Convert asyncpg URL to plain psycopg URL for asyncpg direct
    url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    try:
        import asyncpg
        conn = await asyncpg.connect(url)
    except Exception as e:
        print(f"{RED}ERROR: Cannot connect to DB: {e}{NC}")
        sys.exit(1)

    print(f"\n{BOLD}RukunRT Database Verification{NC}")
    print(f"DB: {url.split('@')[-1]}")  # don't print password
    print("=" * 50)

    try:
        await verify(conn)
    finally:
        await conn.close()

    # ── Summary ──────────────────────────────────────────────────
    print(f"\n{'='*50}")
    print(f"{BOLD}Results: {GREEN}{PASS} passed{NC} / {RED}{FAIL} failed{NC}")
    if FAIL == 0:
        print(f"{GREEN}{BOLD}✅ Database perfectly matches codebase!{NC}")
    else:
        print(f"{RED}{BOLD}❌ {FAIL} issues found — fix before running the app{NC}")
    print()

    sys.exit(0 if FAIL == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())
