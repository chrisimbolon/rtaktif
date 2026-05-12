"""
Integration tests — Komunikasi (announcements + laporan) flow.
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
from app.modules.iam.domain.entities import UserStatus, UserRole, RTGroup


# ── Helpers ────────────────────────────────────────────────────────
def _make_user(email, role=UserRole.WARGA):
    from app.modules.iam.domain.entities import User
    from app.core.security import hash_password
    u = User.register(email=email, phone="6281234560000",
                      hashed_password=hash_password("pass123"), full_name="Test")
    u.status = UserStatus.ACTIVE
    u.role   = role
    return u


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
async def komm_context(client, db_session):
    admin_email = f"admin_k_{uuid.uuid4().hex[:8]}@test.com"
    warga_email = f"warga_k_{uuid.uuid4().hex[:8]}@test.com"
    repo = PgUserRepository(db_session)

    # Admin
    await client.post("/api/v1/auth/register", json={
        "full_name": "Komm Admin", "email": admin_email,
        "phone": "6281234561000", "password": "pass123",
    })
    admin = await repo.get_by_email(admin_email)
    admin.status = UserStatus.ACTIVE
    admin.role   = UserRole.ADMIN_RT
    await repo.save(admin)

    # RT group
    rt = RTGroup.create(rt_number="11", rw_number="05",
                        kelurahan="Komm Kel", kecamatan="Komm Kec",
                        kota="Bengkulu", admin_user_id=admin.id)
    await PgRTGroupRepository(db_session).save(rt)
    admin.assign_to_rt(rt.id)
    await repo.save(admin)

    # Warga
    await client.post("/api/v1/auth/register", json={
        "full_name": "Komm Warga", "email": warga_email,
        "phone": "6281234561001", "password": "pass123",
    })
    warga = await repo.get_by_email(warga_email)
    warga.status = UserStatus.ACTIVE
    warga.assign_to_rt(rt.id)
    await repo.save(warga)
    await db_session.commit()

    admin_token = (await client.post("/api/v1/auth/login",
        json={"email": admin_email, "password": "pass123"})).json()["access_token"]
    warga_token = (await client.post("/api/v1/auth/login",
        json={"email": warga_email, "password": "pass123"})).json()["access_token"]

    return {
        "admin_headers": {"Authorization": f"Bearer {admin_token}"},
        "warga_headers": {"Authorization": f"Bearer {warga_token}"},
        "rt_id":         str(rt.id),
        "warga_id":      str(warga.id),
    }


# ── Announcement tests ─────────────────────────────────────────────
@pytest.mark.asyncio
async def test_create_announcement(client: AsyncClient, komm_context):
    res = await client.post(
        "/api/v1/komunikasi/announcements",
        headers=komm_context["admin_headers"],
        json={
            "rt_group_id": komm_context["rt_id"],
            "title":       "Kerja Bakti Minggu Depan",
            "body":        "Mohon seluruh warga hadir pada hari Minggu pukul 07.00 WIB.",
            "ann_type":    "event",
            "channel":     "both",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Kerja Bakti Minggu Depan"
    assert "id" in data


@pytest.mark.asyncio
async def test_warga_cannot_create_announcement(client: AsyncClient, komm_context):
    res = await client.post(
        "/api/v1/komunikasi/announcements",
        headers=komm_context["warga_headers"],
        json={
            "rt_group_id": komm_context["rt_id"],
            "title":       "Unauthorized Announcement",
            "body":        "This should be blocked.",
            "ann_type":    "info",
            "channel":     "app",
        },
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_list_announcements(client: AsyncClient, komm_context):
    # Create one first
    await client.post("/api/v1/komunikasi/announcements",
        headers=komm_context["admin_headers"],
        json={"rt_group_id": komm_context["rt_id"], "title": "Test Announcement",
              "body": "Test body content here.", "ann_type": "info", "channel": "app"})

    res = await client.get(
        f"/api/v1/komunikasi/announcements/{komm_context['rt_id']}",
        headers=komm_context["warga_headers"],  # warga can READ
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1


# ── Laporan tests ──────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_submit_laporan(client: AsyncClient, komm_context):
    res = await client.post(
        "/api/v1/komunikasi/laporan",
        headers=komm_context["warga_headers"],
        json={
            "rt_group_id": komm_context["rt_id"],
            "title":       "Lampu jalan Blok B mati",
            "description": "Lampu jalan di depan rumah saya sudah mati selama 3 hari.",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "open"
    assert "id" in data


@pytest.mark.asyncio
async def test_resolve_laporan(client: AsyncClient, komm_context):
    # Submit laporan as warga
    submit = await client.post(
        "/api/v1/komunikasi/laporan",
        headers=komm_context["warga_headers"],
        json={"rt_group_id": komm_context["rt_id"],
              "title": "Sampah menumpuk",
              "description": "Ada tumpukan sampah di pojok Blok C yang tidak diangkut."},
    )
    laporan_id = submit.json()["id"]

    # Resolve as admin
    res = await client.patch(
        f"/api/v1/komunikasi/laporan/{laporan_id}/resolve",
        headers=komm_context["admin_headers"],
        json={"notes": "Sudah dikoordinasikan dengan petugas kebersihan. Akan diangkut besok."},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "resolved"


@pytest.mark.asyncio
async def test_resolve_nonexistent_laporan(client: AsyncClient, komm_context):
    res = await client.patch(
        f"/api/v1/komunikasi/laporan/{uuid.uuid4()}/resolve",
        headers=komm_context["admin_headers"],
        json={"notes": "Some notes"},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_list_laporan_admin_only(client: AsyncClient, komm_context):
    # Submit one laporan
    await client.post("/api/v1/komunikasi/laporan",
        headers=komm_context["warga_headers"],
        json={"rt_group_id": komm_context["rt_id"],
              "title": "Test laporan", "description": "Test description for laporan."})

    # Admin can list
    admin_res = await client.get(
        f"/api/v1/komunikasi/laporan/{komm_context['rt_id']}",
        headers=komm_context["admin_headers"],
    )
    assert admin_res.status_code == 200
    assert isinstance(admin_res.json(), list)
