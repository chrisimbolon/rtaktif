"""
Integration tests — Tagihan (billing) flow.
Tests: generate bulk → confirm payment → mark overdue lifecycle.
"""
import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../"))

from app.main import app
from app.core.database import AsyncSessionLocal
from app.modules.iam.infrastructure.repository import PgUserRepository, PgRTGroupRepository
from app.modules.warga.infrastructure.repository import PgResidentRepository
from app.modules.iam.domain.entities import UserStatus, UserRole, RTGroup
from app.modules.warga.domain.entities import Resident, ResidentStatus


# ── Helpers ────────────────────────────────────────────────────────
async def seed_rt_with_residents(session: AsyncSession) -> tuple[str, str, list[str]]:
    """
    Creates an RT group with 3 active residents.
    Returns (admin_user_id, rt_group_id, [resident_ids]).
    """
    # Admin user
    from app.core.security import hash_password
    admin = await PgUserRepository(session).save(
        _make_user("admin_tag@test.com", UserRole.ADMIN_RT)
    )
    await session.flush()

    # RT Group
    rt = RTGroup.create(
        rt_number="07", rw_number="03",
        kelurahan="Test Kelurahan", kecamatan="Test Kecamatan",
        kota="Bengkulu", admin_user_id=admin.id, monthly_fee_idr=30_000,
    )
    await PgRTGroupRepository(session).save(rt)
    admin.assign_to_rt(rt.id)
    await PgUserRepository(session).save(admin)

    # 3 active residents
    resident_ids = []
    repo = PgResidentRepository(session)
    for i in range(3):
        warga_user = await PgUserRepository(session).save(
            _make_user(f"warga_tag_{i}@test.com")
        )
        await session.flush()
        r = Resident.register(
            rt_group_id=rt.id, user_id=warga_user.id,
            full_name=f"Warga Tester {i}", phone=f"628111111{i:04d}",
            street=f"Jl. Test No. {i}", rt_number="07", rw_number="03",
            kelurahan="Test Kelurahan", kecamatan="Test Kecamatan",
            kota="Bengkulu", block="B", unit_number=str(i),
        )
        r.status = ResidentStatus.ACTIVE
        saved = await repo.save(r)
        resident_ids.append(str(saved.id))

    await session.commit()
    return str(admin.id), str(rt.id), resident_ids


def _make_user(email: str, role: UserRole = UserRole.WARGA):
    from app.modules.iam.domain.entities import User
    from app.core.security import hash_password
    u = User.register(
        email=email, phone="6281234560000",
        hashed_password=hash_password("pass123"), full_name="Test User",
    )
    u.status = UserStatus.ACTIVE
    u.role   = role
    return u


async def get_admin_token(client: AsyncClient, email: str) -> str:
    res = await client.post("/api/v1/auth/login", json={
        "email": email, "password": "pass123"
    })
    return res.json()["access_token"]


# ── Fixtures ──────────────────────────────────────────────────────
@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def billing_context(client, db_session):
    email = f"admin_billing_{uuid.uuid4().hex[:8]}@test.com"
    # Create admin user via API then promote
    await client.post("/api/v1/auth/register", json={
        "full_name": "Billing Admin", "email": email,
        "phone": "6281234560010", "password": "pass123",
    })
    repo = PgUserRepository(db_session)
    user = await repo.get_by_email(email)
    user.status = UserStatus.ACTIVE
    user.role   = UserRole.ADMIN_RT
    await repo.save(user)

    # RT group
    rt = RTGroup.create(
        rt_number="09", rw_number="04",
        kelurahan="Billing Kel", kecamatan="Billing Kec",
        kota="Bengkulu", admin_user_id=user.id, monthly_fee_idr=30_000,
    )
    await PgRTGroupRepository(db_session).save(rt)
    user.assign_to_rt(rt.id)
    await repo.save(user)

    # 2 active residents
    resident_ids = []
    r_repo = PgResidentRepository(db_session)
    for i in range(2):
        wu = await repo.save(_make_user(f"warga_bill_{uuid.uuid4().hex[:6]}@test.com"))
        await db_session.flush()
        r = Resident.register(
            rt_group_id=rt.id, user_id=wu.id, full_name=f"Warga Bill {i}",
            phone=f"628222222{i:04d}", street="Jl. Billing", rt_number="09",
            rw_number="04", kelurahan="Billing Kel", kecamatan="Billing Kec",
            kota="Bengkulu", block="C", unit_number=str(i),
        )
        r.status = ResidentStatus.ACTIVE
        saved = await r_repo.save(r)
        resident_ids.append(str(saved.id))

    await db_session.commit()
    token = await get_admin_token(client, email)
    return {
        "token":        token,
        "rt_id":        str(rt.id),
        "resident_ids": resident_ids,
        "headers":      {"Authorization": f"Bearer {token}"},
    }


# ── Tests ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_generate_bulk_invoices(client: AsyncClient, billing_context):
    now = datetime.utcnow()
    res = await client.post(
        "/api/v1/tagihan/generate-bulk",
        headers=billing_context["headers"],
        json={
            "rt_group_id": billing_context["rt_id"],
            "year":        now.year,
            "month":       now.month,
            "amount_idr":  30_000,
        },
    )
    assert res.status_code == 201
    data = res.json()
    # Should create one invoice per active resident
    assert data["invoices_created"] == 2


@pytest.mark.asyncio
async def test_generate_bulk_idempotent(client: AsyncClient, billing_context):
    """Calling generate twice for same period must not duplicate invoices."""
    now = datetime.utcnow()
    payload = {
        "rt_group_id": billing_context["rt_id"],
        "year":        now.year,
        "month":       now.month,
        "amount_idr":  30_000,
    }
    r1 = await client.post("/api/v1/tagihan/generate-bulk",
                           headers=billing_context["headers"], json=payload)
    r2 = await client.post("/api/v1/tagihan/generate-bulk",
                           headers=billing_context["headers"], json=payload)

    assert r1.status_code == 201
    assert r2.status_code == 201
    # Second call should return 0 new invoices (idempotent)
    assert r2.json()["invoices_created"] == 0


@pytest.mark.asyncio
async def test_get_unpaid_invoices(client: AsyncClient, billing_context):
    """After generating, all invoices should be unpaid."""
    now = datetime.utcnow()
    await client.post("/api/v1/tagihan/generate-bulk",
                      headers=billing_context["headers"],
                      json={"rt_group_id": billing_context["rt_id"],
                            "year": now.year, "month": now.month, "amount_idr": 30_000})

    res = await client.get(
        f"/api/v1/tagihan/unpaid/{billing_context['rt_id']}",
        headers=billing_context["headers"],
    )
    assert res.status_code == 200
    unpaid = res.json()
    assert len(unpaid) == 2
    assert all(i["status"] in ("issued", "overdue") for i in unpaid)


@pytest.mark.asyncio
async def test_confirm_payment(client: AsyncClient, billing_context):
    """Admin can confirm a payment, invoice becomes paid."""
    now = datetime.utcnow()
    await client.post("/api/v1/tagihan/generate-bulk",
                      headers=billing_context["headers"],
                      json={"rt_group_id": billing_context["rt_id"],
                            "year": now.year, "month": now.month, "amount_idr": 30_000})

    # Get an invoice ID
    unpaid = await client.get(
        f"/api/v1/tagihan/unpaid/{billing_context['rt_id']}",
        headers=billing_context["headers"],
    )
    invoice_id = unpaid.json()[0]["id"]

    # Confirm payment
    res = await client.patch(
        f"/api/v1/tagihan/{invoice_id}/confirm-payment",
        headers=billing_context["headers"],
        json={"method": "bank_transfer"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "paid"


@pytest.mark.asyncio
async def test_confirm_payment_nonexistent(client: AsyncClient, billing_context):
    res = await client.patch(
        f"/api/v1/tagihan/{uuid.uuid4()}/confirm-payment",
        headers=billing_context["headers"],
        json={"method": "cash"},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_warga_cannot_generate_invoices(client: AsyncClient, db_session):
    """Warga role must be blocked from generating invoices."""
    email = f"plain2_{uuid.uuid4().hex[:8]}@test.com"
    await client.post("/api/v1/auth/register", json={
        "full_name": "Plain Warga2", "email": email,
        "phone": "6281234560099", "password": "pass123",
    })
    repo = PgUserRepository(db_session)
    user = await repo.get_by_email(email)
    user.status = UserStatus.ACTIVE
    await repo.save(user)
    await db_session.commit()

    login = await client.post("/api/v1/auth/login",
                              json={"email": email, "password": "pass123"})
    token = login.json()["access_token"]

    res = await client.post(
        "/api/v1/tagihan/generate-bulk",
        headers={"Authorization": f"Bearer {token}"},
        json={"rt_group_id": str(uuid.uuid4()),
              "year": 2026, "month": 5, "amount_idr": 30_000},
    )
    assert res.status_code == 403
