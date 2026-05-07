"""
IAM domain policies — pure business rules, zero external deps.
Mirrors hr-app's domain/policies.py pattern.
"""
from app.modules.iam.domain.entities import User, UserRole


class AdminPolicy:
    @staticmethod
    def can_verify_resident(actor: User) -> bool:
        return actor.is_admin and actor.is_active

    @staticmethod
    def can_assign_roles(actor: User) -> bool:
        return actor.role in (UserRole.ADMIN_RT, UserRole.SUPER_ADMIN)

    @staticmethod
    def can_generate_invoices(actor: User) -> bool:
        return actor.is_admin and actor.is_active
