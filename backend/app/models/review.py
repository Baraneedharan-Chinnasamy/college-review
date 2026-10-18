from datetime import datetime

from beanie import Document, PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, DESCENDING, TEXT, IndexModel

from app.models.common import utc_now


class Review(Document):
    college_id: PydanticObjectId
    author_id: PydanticObjectId
    rating: int = Field(ge=1, le=5)
    title: str
    comment: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "reviews"
        indexes = [
            # One review per user per college.
            IndexModel(
                [("college_id", ASCENDING), ("author_id", ASCENDING)],
                unique=True,
                name="uniq_author_per_college",
            ),
            # Serves the per-college $lookup/$group used for average ratings, and recent-first listing.
            IndexModel(
                [("college_id", ASCENDING), ("created_at", DESCENDING)], name="college_recent"
            ),
            IndexModel(
                [("author_id", ASCENDING), ("created_at", DESCENDING)], name="author_recent"
            ),
            IndexModel(
                [("title", TEXT), ("comment", TEXT)],
                weights={"title": 3, "comment": 1},
                name="review_text",
            ),
        ]
