"""
Integration tests — Auth flow end-to-end.
Requires live PostgreSQL + the full app running.
Uses httpx AsyncClient against the real FastAPI app.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

# We import the real FastAPI app
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../"))

from app.main import app
from app.core.database import AsyncSessionLocal
from app.modules.iam.infrastructure.repository import PgUserRepository
from app.modules.iam.infrastructure.models import UserModel


# ── Fixtures ──────────────────────────────────────────────────────
@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def registered_user(client: AsyncClient):
    """Creates a user via the register endpoint and returns credentials."""
    payload = {
        "full_name": "Integration Tester",
        "email":     "integration@test.com",
        "phone":     "6281234567999",
        "password":  "testpass123",
    }
    res = await client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201
    return payload


@pytest.fixture
async def active_user(registered_user, db_session: AsyncSession):
    """Activates the registered user directly in DB (bypasses admin verify)."""
    from app.modules.iam.domain.entities import UserStatus
    repo = PgUserRepository(db_session)
    user = await repo.get_by_email(registered_user["email"])
    assert user is not None
    user.status = UserStatus.ACTIVE
    await repo.save(user)
    await db_session.commit()
    return registered_user


# ── Health ─────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    res = await client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["app"] == "RukunRT"


# ── Register ───────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    payload = {
        "full_name": "Budi Tester",
        "email":     "budi_test@example.com",
        "phone":     "6281111111111",
        "password":  "password123",
    }
    res = await client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == payload["email"]
    assert data["status"] == "pending"
    assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, registered_user):
    """Second registration with same email must return 409."""
    res = await client.post("/api/v1/auth/register", json={
        **registered_user, "full_name": "Duplicate User"
    })
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_register_invalid_email(client: AsyncClient):
    res = await client.post("/api/v1/auth/register", json={
        "full_name": "Bad Email",
        "email":     "not-an-email",
        "phone":     "6281234567890",
        "password":  "password123",
    })
    assert res.status_code == 422


# ── Login ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_login_pending_user_blocked(client: AsyncClient, registered_user):
    """Pending users must NOT be able to login."""
    res = await client.post("/api/v1/auth/login", json={
        "email":    registered_user["email"],
        "password": registered_user["password"],
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, active_user):
    res = await client.post("/api/v1/auth/login", json={
        "email":    active_user["email"],
        "password": active_user["password"],
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert len(data["access_token"]) > 20


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, active_user):
    res = await client.post("/api/v1/auth/login", json={
        "email":    active_user["email"],
        "password": "wrongpassword",
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    res = await client.post("/api/v1/auth/login", json={
        "email":    "ghost@example.com",
        "password": "password123",
    })
    assert res.status_code == 401


# ── Protected routes ───────────────────────────────────────────────
@pytest.mark.asyncio
async def test_me_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/users/me")
    assert res.status_code == 403  # no token = forbidden


@pytest.mark.asyncio
async def test_me_returns_user(client: AsyncClient, active_user):
    # Login first
    login = await client.post("/api/v1/auth/login", json={
        "email":    active_user["email"],
        "password": active_user["password"],
    })
    token = login.json()["access_token"]

    # Use token
    res = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == active_user["email"]
    assert data["role"]  == "warga"


@pytest.mark.asyncio
async def test_admin_endpoint_blocked_for_warga(client: AsyncClient, active_user):
    """Warga must NOT be able to access admin endpoints."""
    login = await client.post("/api/v1/auth/login", json={
        "email":    active_user["email"],
        "password": active_user["password"],
    })
    token = login.json()["access_token"]

    # Try to list all warga (admin only)
    import uuid
    res = await client.get(
        f"/api/v1/warga/rt/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403
