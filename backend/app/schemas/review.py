from datetime import datetime
from typing import Any, Literal

from beanie import PydanticObjectId
from pydantic import BaseModel, Field, model_validator

from app.models import Role
from app.schemas.common import InputModel

ReviewSort = Literal["newest", "oldest", "rating", "-rating", "relevance"]


class ReviewCreate(InputModel):
    college_id: PydanticObjectId
    rating: int = Field(ge=1, le=5)
    title: str = Field(min_length=3, max_length=120)
    comment: str = Field(min_length=10, max_length=2000)


class ReviewUpdate(InputModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    title: str | None = Field(default=None, min_length=3, max_length=120)
    comment: str | None = Field(default=None, min_length=10, max_length=2000)

    @model_validator(mode="after")
    def _not_empty(self) -> "ReviewUpdate":
        provided = {k for k in self.model_fields_set if getattr(self, k) is not None}
        if not provided:
            raise ValueError("Provide at least one of: rating, title, comment")
        return self


class ReviewAuthor(BaseModel):
    id: str
    name: str
    role: Role


class ReviewCollege(BaseModel):
    id: str
    name: str


class ReviewOut(BaseModel):
    id: str
    college_id: str
    author_id: str
    rating: int
    title: str
    comment: str
    author: ReviewAuthor | None = None
    college: ReviewCollege | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "ReviewOut":
        author = row.get("author")
        college = row.get("college")
        return cls(
            id=str(row["_id"]),
            college_id=str(row["college_id"]),
            author_id=str(row["author_id"]),
            rating=row["rating"],
            title=row["title"],
            comment=row["comment"],
            author=ReviewAuthor(id=str(author["_id"]), name=author["name"], role=author["role"])
            if author
            else None,
            college=ReviewCollege(id=str(college["_id"]), name=college["name"])
            if college
            else None,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
