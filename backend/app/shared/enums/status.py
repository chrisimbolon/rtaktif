"""Shared status enums reused across multiple modules."""
from enum import Enum


class ActiveStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class VerificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
