from datetime import datetime

from beanie import Document, PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.models.common import utc_now

# Case-insensitive comparison/sorting for names and locations ("chennai" == "Chennai").
CASE_INSENSITIVE = {"locale": "en", "strength": 2}


class College(Document):
    name: str
    city: str
    state: str
    country: str = "India"
    description: str | None = None
    website: str | None = None
    established_year: int | None = None
    courses: list[str] = Field(default_factory=list)
    created_by: PydanticObjectId | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "colleges"
        indexes = [
            # Case-insensitive uniqueness: "IIT Madras" and "iit madras" are the same college.
            IndexModel(
                [("name", ASCENDING)], unique=True, collation=CASE_INSENSITIVE, name="uniq_name_ci"
            ),
            IndexModel(
                [("state", ASCENDING), ("city", ASCENDING)],
                collation=CASE_INSENSITIVE,
                name="location_ci",
            ),
            IndexModel([("created_at", DESCENDING)], name="created_at"),
        ]
