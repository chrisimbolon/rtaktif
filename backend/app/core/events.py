"""
In-process domain event bus.
MVP: synchronous, in-memory.
Later: swap to Celery/Redis without touching any domain code.
"""
from typing import Callable, Dict, List, Type


class DomainEvent:
    """Base class for all domain events."""
    pass


class EventBus:
    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = {}

    def subscribe(self, event_type: Type[DomainEvent], handler: Callable) -> None:
        key = event_type.__name__
        self._handlers.setdefault(key, []).append(handler)

    async def publish(self, event: DomainEvent) -> None:
        key = type(event).__name__
        for handler in self._handlers.get(key, []):
            await handler(event)


event_bus = EventBus()
