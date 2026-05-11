"""Base Pydantic response schemas — mirrors hr-app/shared/schemas/base.py."""
from pydantic import BaseModel
from typing import Generic, List, Optional, TypeVar
from datetime import datetime

T = TypeVar("T")


class BaseResponse(BaseModel):
    success: bool = True
    message: str = "OK"


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    per_page: int
    total_pages: int


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    detail: Optional[str] = None
