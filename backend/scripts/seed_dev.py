"""
Dev seed script — mirrors hr-app/scripts/seed_dev.py convention.
Creates a default RT group + admin user for local development.
Run: python scripts/seed_dev.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.modules.iam.domain.entities import User, RTGroup, UserRole, UserStatus
from app.modules.iam.infrastructure.repository import PgUserRepository, PgRTGroupRepository


async def seed():
    async with AsyncSessionLocal() as session:
        user_repo = PgUserRepository(session)
        rt_repo   = PgRTGroupRepository(session)

        # Check if already seeded
        existing = await user_repo.get_by_email("admin@rukunrt.id")
        if existing:
            print("✅ Already seeded — skipping")
            return

        # Create admin user
        admin = User.register(
            email="admin@rukunrt.id",
            phone="6281234567890",
            hashed_password=hash_password("admin123"),
            full_name="Budi Prasetyo (Admin)",
        )
        admin.status = UserStatus.ACTIVE
        admin.role   = UserRole.ADMIN_RT
        await user_repo.save(admin)
        print(f"👤 Admin created: {admin.email} / password: admin123")

        # Create RT group
        rt = RTGroup.create(
            rt_number="05", rw_number="02",
            kelurahan="Padang Harapan", kecamatan="Gading Cempaka",
            kota="Bengkulu", provinsi="Bengkulu",
            admin_user_id=admin.id, monthly_fee_idr=30_000,
        )
        await rt_repo.save(rt)
        print(f"🏘️  RT Group created: {rt.display_name}")

        # Assign admin to RT
        admin.assign_to_rt(rt.id)
        await user_repo.save(admin)

        await session.commit()
        print("✅ Seed complete!")
        print(f"\n📋 Login: POST /api/v1/auth/login")
        print(f"   email: admin@rukunrt.id")
        print(f"   password: admin123")


if __name__ == "__main__":
    asyncio.run(seed())
