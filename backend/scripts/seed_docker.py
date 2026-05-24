# scripts/seed_docker.py
# Uses bcrypt directly — bypasses passlib incompatibility
import asyncio
import os
import sys
import bcrypt
from datetime import datetime, timezone
from uuid import uuid4

sys.path.insert(0, "/app")

DATABASE_URL   = os.environ["DATABASE_URL"]
ADMIN_EMAIL    = "admin@rtmudah.id"
ADMIN_PASSWORD = "admin123"
ADMIN_NAME     = "Budi Prasetyo (Admin)"
ADMIN_PHONE    = "6281234567890"

print(f"🔥 DATABASE_URL: {DATABASE_URL}")

def hash_password(password: str) -> str:
    """Hash using bcrypt directly — no passlib needed."""
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(rounds=12)
    ).decode("utf-8")

async def seed():
    import asyncpg

    dsn = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(dsn)

    try:
        now = datetime.now(timezone.utc)
        hashed = hash_password(ADMIN_PASSWORD)
        print(f"🔑 Password hashed successfully")

        # ── Admin user ─────────────────────────────────────────────
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1", ADMIN_EMAIL
        )
        if existing:
            admin_id = existing["id"]
            print(f"✅ Admin already exists: {ADMIN_EMAIL}")
        else:
            admin_id = uuid4()
            await conn.execute("""
                INSERT INTO users
                  (id, email, phone, hashed_password, full_name,
                   role, status, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            """, admin_id, ADMIN_EMAIL, ADMIN_PHONE,
                hashed, ADMIN_NAME, "admin_rt", "active", now, now)
            print(f"👤 Admin created: {ADMIN_EMAIL}")

        # ── RT Group ───────────────────────────────────────────────
        existing_rt = await conn.fetchrow(
            "SELECT id FROM rt_groups WHERE rt_number=$1 AND rw_number=$2",
            "05", "02"
        )
        if existing_rt:
            rt_id = existing_rt["id"]
            print(f"✅ RT Group already exists: RT 05/RW 02")
        else:
            rt_id = uuid4()
            await conn.execute("""
                INSERT INTO rt_groups
                  (id, rt_number, rw_number, kelurahan, kecamatan,
                   kota, provinsi, admin_user_id, monthly_fee_idr,
                   is_active, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            """, rt_id, "05", "02",
                "Padang Harapan", "Gading Cempaka",
                "Bengkulu", "Bengkulu",
                admin_id, 30000, True, now, now)
            print(f"🏘️  RT Group created: RT 05/RW 02")

        # ── Link admin → RT ────────────────────────────────────────
        await conn.execute(
            "UPDATE users SET rt_group_id=$1 WHERE id=$2",
            rt_id, admin_id
        )
        print(f"🔗 Admin linked to RT group")

    finally:
        await conn.close()

    print("\n✅ Seed complete!")
    print(f"\n📋 Login credentials:")
    print(f"   Email:    {ADMIN_EMAIL}")
    print(f"   Password: {ADMIN_PASSWORD}")
    print(f"\n🌐 Open: http://localhost:3000")

asyncio.run(seed())
