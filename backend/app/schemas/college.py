from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

from app.schemas.common import InputModel

CollegeSort = Literal[
    "name", "-name", "rating", "-rating", "reviews", "-reviews", "newest", "oldest"
]

_CURRENT_YEAR = datetime.now(UTC).year


class _CollegeFields(InputModel):
    @field_validator("courses", check_fields=False)
    @classmethod
    def _clean_courses(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return value
        cleaned = [course.strip() for course in value if course and course.strip()]
        return list(dict.fromkeys(cleaned))  # de-duplicate, keep order


class CollegeCreate(_CollegeFields):
    name: str = Field(min_length=2, max_length=150)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=80)
    country: str = Field(default="India", min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=2000)
    website: HttpUrl | None = None
    established_year: int | None = Field(default=None, ge=1800, le=_CURRENT_YEAR)
    courses: list[str] = Field(default_factory=list, max_length=50)


class CollegeUpdate(_CollegeFields):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    city: str | None = Field(default=None, min_length=2, max_length=80)
    state: str | None = Field(default=None, min_length=2, max_length=80)
    country: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=2000)
    website: HttpUrl | None = None
    established_year: int | None = Field(default=None, ge=1800, le=_CURRENT_YEAR)
    courses: list[str] | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def _not_empty(self) -> "CollegeUpdate":
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update")
        for required in ("name", "city", "state", "country"):
            if required in self.model_fields_set and getattr(self, required) is None:
                raise ValueError(f"{required} cannot be null")
        return self


class CollegeOut(BaseModel):
    id: str
    name: str
    city: str
    state: str
    country: str
    description: str | None = None
    website: str | None = None
    established_year: int | None = None
    courses: list[str] = []
    average_rating: float | None = Field(
        default=None, description="Mean review rating (1-5), null when there are no reviews"
    )
    review_count: int = 0
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "CollegeOut":
        return cls(id=str(row["_id"]), **{k: v for k, v in row.items() if k != "_id"})


class CollegeDetail(CollegeOut):
    rating_distribution: dict[str, int] = Field(
        description="Number of reviews per star value, keys '1'..'5'"
    )
