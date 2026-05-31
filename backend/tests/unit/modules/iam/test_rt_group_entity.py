"""Unit tests — RTGroup aggregate & RTIdentity value object.

These tests cover every state transition, guard, and validation rule.
No I/O — pure domain logic only.

Run with:
    pytest tests/unit/modules/iam/test_rt_group_entity.py -v
"""

from __future__ import annotations

import pytest
from datetime import date, timedelta
from uuid import uuid4

from app.modules.iam.domain.entities import (
    RTGroup,
    RTIdentity,
    RTVerificationStatus,
)
from app.core.exceptions import DomainException, InvalidStateTransitionError


# ═══════════════════════════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def valid_identity() -> RTIdentity:
    return RTIdentity(
        rt_number="05",
        rw_number="03",
        kelurahan="Menteng",
        kecamatan="Menteng",
        kota="Jakarta Pusat",
    )


@pytest.fixture
def pending_group(valid_identity) -> RTGroup:
    return RTGroup.create(
        identity=valid_identity,
        admin_user_id=uuid4(),
    )


@pytest.fixture
def group_with_sk(pending_group) -> RTGroup:
    pending_group.submit_sk(
        sk_document_url="https://storage.rtmudah.com/sk/abc123.pdf",
        sk_valid_until=date.today() + timedelta(days=365),
    )
    return pending_group


@pytest.fixture
def active_group(group_with_sk) -> RTGroup:
    group_with_sk.approve(verified_by=uuid4())
    return group_with_sk


# ═══════════════════════════════════════════════════════════════════════════════
# RTIdentity value object
# ═══════════════════════════════════════════════════════════════════════════════


class TestRTIdentity:

    def test_normalises_whitespace_and_casing(self):
        identity = RTIdentity(
            rt_number=" 5 ",
            rw_number=" 3 ",
            kelurahan=" menteng ",
            kecamatan="MENTENG",
            kota="jakarta pusat",
        )
        assert identity.rt_number == "5"
        assert identity.kelurahan == "Menteng"
        assert identity.kota == "Jakarta Pusat"

    def test_equality_is_structural(self):
        a = RTIdentity("05", "03", "Menteng", "Menteng", "Jakarta Pusat")
        b = RTIdentity("05", "03", "Menteng", "Menteng", "Jakarta Pusat")
        assert a == b

    def test_different_kecamatan_are_not_equal(self):
        """Two kelurahan with the same name in different kecamatan are distinct."""
        a = RTIdentity("05", "03", "Kebon Sirih", "Menteng",      "Jakarta Pusat")
        b = RTIdentity("05", "03", "Kebon Sirih", "Senen",        "Jakarta Pusat")
        assert a != b

    def test_blank_fields_raise_domain_error(self):
        with pytest.raises(DomainException, match="kelurahan cannot be blank"):
            RTIdentity("05", "03", "", "Menteng", "Jakarta Pusat")

    def test_invalid_rt_number_raises_domain_error(self):
        with pytest.raises(DomainException, match="rt_number must be 1-3 digits"):
            RTIdentity("RT05", "03", "Menteng", "Menteng", "Jakarta Pusat")

    def test_str_is_human_readable(self, valid_identity):
        assert str(valid_identity) == "RT 05/RW 03, Kel. Menteng, Kec. Menteng, Jakarta Pusat"


# ═══════════════════════════════════════════════════════════════════════════════
# RTGroup.create factory
# ═══════════════════════════════════════════════════════════════════════════════


class TestRTGroupCreate:

    def test_starts_in_pending_verification(self, pending_group):
        assert pending_group.verification_status == RTVerificationStatus.PENDING_VERIFICATION

    def test_is_not_verified_initially(self, pending_group):
        assert pending_group.is_verified is False

    def test_flat_fields_synced_from_identity(self, pending_group, valid_identity):
        assert pending_group.rt_number == valid_identity.rt_number
        assert pending_group.kecamatan == valid_identity.kecamatan

    def test_emits_rt_group_created_event(self, pending_group):
        from app.modules.iam.domain.entities import RTGroupCreated
        events = [e for e in pending_group.pull_events() if isinstance(e, RTGroupCreated)]
        assert len(events) == 1
        assert events[0].rt_group_id == pending_group.id


# ═══════════════════════════════════════════════════════════════════════════════
# SK submission
# ═══════════════════════════════════════════════════════════════════════════════


class TestSubmitSK:

    def test_sets_document_url(self, pending_group):
        url = "https://storage.rtmudah.com/sk/test.pdf"
        pending_group.submit_sk(sk_document_url=url)
        assert pending_group.sk_document_url == url

    def test_blank_url_raises(self, pending_group):
        with pytest.raises(DomainException, match="URL cannot be blank"):
            pending_group.submit_sk(sk_document_url="   ")

    def test_rejected_group_transitions_to_pending_on_resubmit(self, pending_group):
        pending_group.submit_sk("https://storage.rtmudah.com/sk/first.pdf")
        pending_group.reject(rejected_by=uuid4(), reason="Dokumen buram")
        assert pending_group.verification_status == RTVerificationStatus.REJECTED

        pending_group.submit_sk("https://storage.rtmudah.com/sk/clearer.pdf")
        assert pending_group.verification_status == RTVerificationStatus.PENDING_VERIFICATION
        assert pending_group.rejection_reason is None

    def test_expired_group_transitions_to_pending_on_renewal(self, active_group):
        active_group.sk_valid_until = date.today() - timedelta(days=1)
        active_group.expire()
        assert active_group.verification_status == RTVerificationStatus.EXPIRED

        active_group.submit_sk(
            "https://storage.rtmudah.com/sk/renewed.pdf",
            sk_valid_until=date.today() + timedelta(days=365),
        )
        assert active_group.verification_status == RTVerificationStatus.PENDING_VERIFICATION

    def test_renewal_emits_event(self, active_group):
        from app.modules.iam.domain.entities import RTGroupRenewalSubmitted
        active_group.sk_valid_until = date.today() - timedelta(days=1)
        active_group.expire()
        active_group.pull_events()

        active_group.submit_sk("https://storage.rtmudah.com/sk/new.pdf")
        events = [e for e in active_group.pull_events() if isinstance(e, RTGroupRenewalSubmitted)]
        assert len(events) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Approve
# ═══════════════════════════════════════════════════════════════════════════════


class TestApprove:

    def test_pending_with_sk_becomes_active(self, group_with_sk):
        superadmin_id = uuid4()
        group_with_sk.approve(verified_by=superadmin_id)
        assert group_with_sk.verification_status == RTVerificationStatus.ACTIVE
        assert group_with_sk.verified_by == superadmin_id
        assert group_with_sk.verified_at is not None

    def test_is_verified_after_approve(self, group_with_sk):
        group_with_sk.approve(verified_by=uuid4())
        assert group_with_sk.is_verified is True

    def test_approve_without_sk_raises(self, pending_group):
        with pytest.raises(InvalidStateTransitionError, match="without an uploaded SK"):
            pending_group.approve(verified_by=uuid4())

    def test_approving_already_active_raises(self, active_group):
        with pytest.raises(InvalidStateTransitionError, match="Cannot approve RTGroup in status 'active'"):
            active_group.approve(verified_by=uuid4())

    def test_emits_rt_group_verified_event(self, group_with_sk):
        from app.modules.iam.domain.entities import RTGroupVerified
        group_with_sk.pull_events()
        group_with_sk.approve(verified_by=uuid4())
        events = [e for e in group_with_sk.pull_events() if isinstance(e, RTGroupVerified)]
        assert len(events) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Reject
# ═══════════════════════════════════════════════════════════════════════════════


class TestReject:

    def test_pending_becomes_rejected(self, group_with_sk):
        group_with_sk.reject(rejected_by=uuid4(), reason="SK tidak terbaca")
        assert group_with_sk.verification_status == RTVerificationStatus.REJECTED
        assert group_with_sk.rejection_reason == "SK tidak terbaca"

    def test_blank_reason_raises(self, group_with_sk):
        with pytest.raises(DomainException, match="Rejection reason cannot be blank"):
            group_with_sk.reject(rejected_by=uuid4(), reason="  ")

    def test_rejecting_active_group_raises(self, active_group):
        with pytest.raises(InvalidStateTransitionError, match="Cannot reject"):
            active_group.reject(rejected_by=uuid4(), reason="test")

    def test_emits_rt_group_rejected_event(self, group_with_sk):
        from app.modules.iam.domain.entities import RTGroupRejected
        group_with_sk.pull_events()
        group_with_sk.reject(rejected_by=uuid4(), reason="Dokumen palsu")
        events = [e for e in group_with_sk.pull_events() if isinstance(e, RTGroupRejected)]
        assert len(events) == 1
        assert events[0].reason == "Dokumen palsu"


# ═══════════════════════════════════════════════════════════════════════════════
# Expire
# ═══════════════════════════════════════════════════════════════════════════════


class TestExpire:

    def test_active_group_with_expiry_date_becomes_expired(self, active_group):
        active_group.sk_valid_until = date.today() - timedelta(days=1)
        active_group.expire()
        assert active_group.verification_status == RTVerificationStatus.EXPIRED

    def test_expiring_without_sk_valid_until_raises(self, active_group):
        active_group.sk_valid_until = None
        with pytest.raises(InvalidStateTransitionError, match="without a known sk_valid_until"):
            active_group.expire()

    def test_expiring_pending_group_raises(self, group_with_sk):
        group_with_sk.sk_valid_until = date.today() - timedelta(days=1)
        with pytest.raises(InvalidStateTransitionError, match="Only active RTGroups"):
            group_with_sk.expire()

    def test_emits_rt_group_expired_event(self, active_group):
        from app.modules.iam.domain.entities import RTGroupExpired
        active_group.sk_valid_until = date.today() - timedelta(days=1)
        active_group.pull_events()
        active_group.expire()
        events = [e for e in active_group.pull_events() if isinstance(e, RTGroupExpired)]
        assert len(events) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Guards
# ═══════════════════════════════════════════════════════════════════════════════


class TestGuards:

    def test_needs_renewal_when_within_30_days(self, active_group):
        active_group.sk_valid_until = date.today() + timedelta(days=15)
        assert active_group.needs_renewal is True

    def test_no_renewal_needed_when_more_than_30_days(self, active_group):
        active_group.sk_valid_until = date.today() + timedelta(days=60)
        assert active_group.needs_renewal is False

    def test_is_sk_overdue_when_past_expiry(self, active_group):
        active_group.sk_valid_until = date.today() - timedelta(days=1)
        assert active_group.is_sk_overdue is True

    def test_not_overdue_when_no_expiry_date(self, active_group):
        active_group.sk_valid_until = None
        assert active_group.is_sk_overdue is False
