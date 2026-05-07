"""Abstract repository — domain depends on this, never on SQLAlchemy directly."""
from abc import ABC, abstractmethod
from typing import Generic, List, Optional, TypeVar
from uuid import UUID

T = TypeVar("T")


class BaseRepository(ABC, Generic[T]):
    @abstractmethod
    async def get_by_id(self, entity_id: UUID) -> Optional[T]: ...

    @abstractmethod
    async def save(self, entity: T) -> T: ...

    @abstractmethod
    async def delete(self, entity_id: UUID) -> None: ...

    @abstractmethod
    async def list_all(self) -> List[T]: ...
