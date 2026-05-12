"""Unit tests — Warga Resident entity."""
import pytest
from uuid import uuid4
from app.modules.warga.domain.entities import Resident, ResidentStatus, OwnershipType
from app.modules.warga.domain.events import ResidentRegistered, ResidentVerified
from app.modules.warga.domain.policies import ResidentPolicy
from app.core.exceptions import InvalidStateTransitionError


def make_resident(**overrides) -> Resident:
    defaults = dict(
        rt_group_id=uuid4(), user_id=uuid4(),
        full_name="Siti Sundari", phone="6281234567890",
        street="Jl. Merdeka No. 1", rt_number="05", rw_number="02",
        kelurahan="Padang Harapan", kecamatan="Gading Cempaka",
        kota="Bengkulu", block="A", unit_number="3",
    )
    return Resident.register(**{**defaults, **overrides})


def test_register_sets_pending():
    r = make_resident()
    assert r.status == ResidentStatus.PENDING


def test_register_emits_event():
    r      = make_resident()
    events = r.pull_events()
    assert isinstance(events[0], ResidentRegistered)
    assert events[0].full_name == "Siti Sundari"


def test_verify_sets_active_and_timestamps():
    r = make_resident()
    r.pull_events()
    actor = uuid4()
    r.verify(verified_by=actor)
    assert r.status      == ResidentStatus.ACTIVE
    assert r.verified_by == actor
    assert r.verified_at is not None
    assert r.is_active is True


def test_verify_emits_event():
    r = make_resident()
    r.pull_events()
    r.verify(verified_by=uuid4())
    events = r.pull_events()
    assert isinstance(events[0], ResidentVerified)


def test_cannot_verify_twice():
    r = make_resident()
    r.verify(verified_by=uuid4())
    with pytest.raises(InvalidStateTransitionError):
        r.verify(verified_by=uuid4())


def test_move_out_sets_status():
    r = make_resident()
    r.verify(verified_by=uuid4())
    r.pull_events()
    r.move_out()
    assert r.status == ResidentStatus.MOVED_OUT


def test_cannot_move_out_twice():
    r = make_resident()
    r.move_out()
    with pytest.raises(InvalidStateTransitionError):
        r.move_out()


def test_block_unit_display():
    r = make_resident(block="B", unit_number="11")
    assert "B" in r.block_unit_display
    assert "11" in r.block_unit_display


def test_upload_kk_sets_url():
    r = make_resident()
    r.upload_kk("https://spaces.do/kk.pdf")
    assert r.kk_file_url == "https://spaces.do/kk.pdf"


def test_policy_active_can_receive_invoice():
    r = make_resident()
    r.verify(verified_by=uuid4())
    assert ResidentPolicy.can_receive_invoice(r) is True


def test_policy_pending_cannot_receive_invoice():
    r = make_resident()
    assert ResidentPolicy.can_receive_invoice(r) is False


def test_policy_moved_out_cannot_receive_invoice():
    r = make_resident()
    r.move_out()
    assert ResidentPolicy.can_receive_invoice(r) is False
