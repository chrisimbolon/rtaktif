"""
Global domain exception hierarchy.
Domain layer raises these — API layer catches and converts to HTTP responses.
Never import HTTPException inside domain or application layers.
"""


class DomainException(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class EntityNotFoundError(DomainException):
    pass


class DuplicateEntityError(DomainException):
    pass


class InvalidStateTransitionError(DomainException):
    pass


class UnauthorizedError(DomainException):
    pass


class ValidationError(DomainException):
    pass


class InfrastructureError(Exception):
    """Infra-layer errors (DB timeouts, external API failures, etc.)."""
    pass
