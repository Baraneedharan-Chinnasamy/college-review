from math import ceil

from pydantic import BaseModel, ConfigDict


class InputModel(BaseModel):
    """Base for request bodies: trims strings and rejects unknown fields (no mass assignment)."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class PageMeta(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    has_next: bool
    has_prev: bool

    @classmethod
    def build(cls, page: int, limit: int, total: int) -> "PageMeta":
        total_pages = ceil(total / limit) if total else 0
        return cls(
            page=page,
            limit=limit,
            total=total,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
        )


class Page[T](BaseModel):
    data: list[T]
    meta: PageMeta


class ErrorBody(BaseModel):
    code: str
    message: str
    details: object | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody
