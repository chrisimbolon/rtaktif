"""Unit tests — IAM User entity."""
import pytest
from uuid import uuid4
from app.modules.iam.domain.entities import User, UserRole, UserStatus
from app.modules.iam.domain.events import UserRegistered, UserVerified
from app.modules.iam.domain.policies import AdminPolicy
from app.core.exceptions import InvalidStateTransitionError


def make_user(**overrides) -> User:
    defaults = dict(
        email="budi@example.com", phone="6281234567890",
        hashed_password="hashed_pw", full_name="Budi Prasetyo",
    )
    return User.register(**{**defaults, **overrides})


def test_register_sets_pending_status():
    user = make_user()
    assert user.status == UserStatus.PENDING
    assert user.role   == UserRole.WARGA


def test_register_emits_user_registered_event():
    user   = make_user()
    events = user.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], UserRegistered)
    assert events[0].email == "budi@example.com"


def test_verify_transitions_to_active():
    user = make_user()
    user.pull_events()
    user.verify(verified_by=uuid4())
    assert user.status == UserStatus.ACTIVE
    assert user.is_active is True


def test_verify_emits_user_verified_event():
    user = make_user()
    user.pull_events()
    user.verify(verified_by=uuid4())
    events = user.pull_events()
    assert isinstance(events[0], UserVerified)


def test_cannot_verify_already_active_user():
    user = make_user()
    user.verify(verified_by=uuid4())
    with pytest.raises(InvalidStateTransitionError):
        user.verify(verified_by=uuid4())


def test_warga_is_not_admin():
    user = make_user()
    assert user.is_admin is False


def test_admin_rt_is_admin():
    user = make_user()
    user.verify(verified_by=uuid4())
    user.assign_role(UserRole.ADMIN_RT, assigned_by=uuid4())
    assert user.is_admin is True


def test_admin_policy_can_verify_resident_when_active_admin():
    user = make_user()
    user.verify(verified_by=uuid4())
    user.assign_role(UserRole.ADMIN_RT, assigned_by=uuid4())
    assert AdminPolicy.can_verify_resident(user) is True


def test_admin_policy_blocks_pending_user():
    user = make_user()  # still pending
    assert AdminPolicy.can_verify_resident(user) is False


def test_events_cleared_after_pull():
    user = make_user()
    user.pull_events()
    assert user.pull_events() == []
