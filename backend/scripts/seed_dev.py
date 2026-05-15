"""
Dev seed script — creates admin user + RT group for local development.
Safe to run multiple times — detects existing data and updates if needed.

Run: python scripts/seed_dev.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password, verify_password
from app.modules.iam.domain.entities import User, RTGroup, UserRole, UserStatus
from app.modules.iam.infrastructure.repository import PgUserRepository, PgRTGroupRepository

ADMIN_EMAIL    = "admin@rukunrt.id"
ADMIN_PASSWORD = "admin123"
ADMIN_PHONE    = "6281234567890"


async def seed():
    async with AsyncSessionLocal() as session:
        user_repo = PgUserRepository(session)
        rt_repo   = PgRTGroupRepository(session)

        existing = await user_repo.get_by_email(ADMIN_EMAIL)

        if existing:
            # ── Already exists — verify password hash is valid ────────
            # Re-hash if bcrypt version changed (e.g. 5.0.0 → 4.0.1)
            try:
                is_valid = verify_password(ADMIN_PASSWORD, existing.hashed_password)
            except Exception:
                is_valid = False

            if not is_valid:
                print("⚠️  Admin exists but password hash is invalid (bcrypt version change).")
                print("   Re-hashing password...")
                existing.hashed_password = hash_password(ADMIN_PASSWORD)
                await user_repo.save(existing)
                await session.commit()
                print(f"✅ Password re-hashed for {ADMIN_EMAIL}")
            else:
                print(f"✅ Already seeded — admin@rukunrt.id is valid")
                print(f"\n📋 Login: POST /api/v1/auth/login")
                print(f"   email:    {ADMIN_EMAIL}")
                print(f"   password: {ADMIN_PASSWORD}")
            return

        # ── Fresh seed ─────────────────────────────────────────────
        # Create RT group first (no FK dependency yet)
        rt = RTGroup.create(
            rt_number="05", rw_number="02",
            kelurahan="Padang Harapan", kecamatan="Gading Cempaka",
            kota="Bengkulu", provinsi="Bengkulu",
            admin_user_id=None,            # set after admin is created
            monthly_fee_idr=30_000,
        )

        # Create admin user
        admin = User.register(
            email=ADMIN_EMAIL,
            phone=ADMIN_PHONE,
            hashed_password=hash_password(ADMIN_PASSWORD),
            full_name="Budi Prasetyo (Admin)",
        )
        admin.status = UserStatus.ACTIVE
        admin.role   = UserRole.ADMIN_RT

        # Fix circular: set admin_user_id on RT group
        rt.admin_user_id = admin.id

        await user_repo.save(admin)
        print(f"👤 Admin created: {admin.email}")

        await rt_repo.save(rt)
        print(f"🏘️  RT Group created: {rt.display_name}")

        # Link admin → RT
        admin.assign_to_rt(rt.id)
        await user_repo.save(admin)

        await session.commit()
        print("✅ Seed complete!")
        print(f"\n📋 Login: POST /api/v1/auth/login")
        print(f"   email:    {ADMIN_EMAIL}")
        print(f"   password: {ADMIN_PASSWORD}")
        print(f"\n🔗 API docs: http://localhost:8000/api/v1/docs")


if __name__ == "__main__":
    asyncio.run(seed())
