from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4
from app.core.events import DomainEvent


@dataclass
class UserRegistered(DomainEvent):
    user_id: UUID = None
    email: str = ""
    full_name: str = ""
    occurred_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class UserVerified(DomainEvent):
    user_id: UUID = None
    verified_by: UUID = None
    occurred_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RoleAssigned(DomainEvent):
    user_id: UUID = None
    role: str = ""
    assigned_by: UUID = None
    occurred_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RTGroupCreated(DomainEvent):
    rt_group_id: UUID = None
    rt_number: str = ""
    rw_number: str = ""
    admin_user_id: UUID = None
    occurred_at: datetime = field(default_factory=datetime.utcnow)
