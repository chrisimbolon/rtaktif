"""
Integration tests — Warga (resident) management flow.
Tests the full lifecycle: register RT → register resident → verify → list.
"""
import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../"))

from app.main import app
from app.core.database import AsyncSessionLocal
from app.modules.iam.infrastructure.repository import PgUserRepository, PgRTGroupRepository
from app.modules.iam.domain.entities import UserStatus, UserRole


# ── Helpers ────────────────────────────────────────────────────────
async def create_admin_and_token(client: AsyncClient, session: AsyncSession) -> tuple[str, str]:
    """Creates an admin user + RT group, returns (token, rt_group_id)."""
    # Register
    email = f"admin_{uuid.uuid4().hex[:8]}@test.com"
    await client.post("/api/v1/auth/register", json={
        "full_name": "Test Admin",
        "email":     email,
        "phone":     "6281234560001",
        "password":  "admin123",
    })

    # Activate + promote to admin directly in DB
    repo = PgUserRepository(session)
    user = await repo.get_by_email(email)
    user.status = UserStatus.ACTIVE
    user.role   = UserRole.ADMIN_RT
    await repo.save(user)

    # Create RT group
    from app.modules.iam.domain.entities import RTGroup
    rt = RTGroup.create(
        rt_number="05", rw_number="02",
        kelurahan="Padang Harapan", kecamatan="Gading Cempaka",
        kota="Bengkulu", admin_user_id=user.id,
    )
    rt_repo = PgRTGroupRepository(session)
    await rt_repo.save(rt)
    user.assign_to_rt(rt.id)
    await repo.save(user)
    await session.commit()

    # Login
    login = await client.post("/api/v1/auth/login", json={
        "email": email, "password": "admin123",
    })
    token = login.json()["access_token"]
    return token, str(rt.id)


# ── Fixtures ──────────────────────────────────────────────────────
@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as c:
        yield c


@pytest.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def admin_context(client, db_session):
    token, rt_id = await create_admin_and_token(client, db_session)
    return {"token": token, "rt_id": rt_id, "headers": {"Authorization": f"Bearer {token}"}}


# ── Tests ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_register_resident_success(client: AsyncClient, db_session, admin_context):
    """Warga can register themselves."""
    # First create a warga user
    email = f"warga_{uuid.uuid4().hex[:8]}@test.com"
    await client.post("/api/v1/auth/register", json={
        "full_name": "Siti Warga",
        "email":     email,
        "phone":     "6281234560002",
        "password":  "warga123",
    })

    # Activate warga in DB
    repo = PgUserRepository(db_session)
    user = await repo.get_by_email(email)
    user.status = UserStatus.ACTIVE
    await repo.save(user)
    await db_session.commit()

    # Login as warga
    login = await client.post("/api/v1/auth/login", json={
        "email": email, "password": "warga123"
    })
    warga_token = login.json()["access_token"]

    # Register as resident
    res = await client.post(
        "/api/v1/warga",
        headers={"Authorization": f"Bearer {warga_token}"},
        json={
            "rt_group_id":  admin_context["rt_id"],
            "full_name":    "Siti Warga",
            "phone":        "6281234560002",
            "street":       "Jl. Merdeka No. 5",
            "rt_number":    "05",
            "rw_number":    "02",
            "kelurahan":    "Padang Harapan",
            "kecamatan":    "Gading Cempaka",
            "kota":         "Bengkulu",
            "block":        "A",
            "unit_number":  "5",
            "member_count": 2,
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "pending"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_residents_requires_admin(client: AsyncClient, db_session):
    """Warga cannot list residents."""
    # Create plain warga user
    email = f"plain_{uuid.uuid4().hex[:8]}@test.com"
    await client.post("/api/v1/auth/register", json={
        "full_name": "Plain Warga", "email": email,
        "phone": "6281234560003", "password": "pass123",
    })
    repo = PgUserRepository(db_session)
    user = await repo.get_by_email(email)
    user.status = UserStatus.ACTIVE
    await repo.save(user)
    await db_session.commit()

    login = await client.post("/api/v1/auth/login", json={
        "email": email, "password": "pass123"
    })
    warga_token = login.json()["access_token"]

    res = await client.get(
        f"/api/v1/warga/rt/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {warga_token}"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_list_residents(client: AsyncClient, admin_context):
    """Admin can list residents of their RT."""
    res = await client.get(
        f"/api/v1/warga/rt/{admin_context['rt_id']}",
        headers=admin_context["headers"],
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_verify_nonexistent_resident(client: AsyncClient, admin_context):
    """Verifying a non-existent resident returns 404."""
    res = await client.patch(
        f"/api/v1/warga/{uuid.uuid4()}/verify",
        headers=admin_context["headers"],
    )
    assert res.status_code == 404
