"""College CRUD plus the rating aggregations (average rating, review count, distribution)."""

import re
from typing import Any

from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from app.core.errors import ConflictError, NotFoundError
from app.models import College, Review, User
from app.models.college import CASE_INSENSITIVE
from app.models.common import utc_now
from app.schemas.college import CollegeCreate, CollegeDetail, CollegeOut, CollegeSort, CollegeUpdate
from app.schemas.common import Page, PageMeta

_NAME_TAKEN = "A college with this name already exists"

_SORTS: dict[str, dict[str, int]] = {
    "name": {"name": 1, "_id": 1},
    "-name": {"name": -1, "_id": 1},
    "rating": {"average_rating": 1, "review_count": 1, "_id": 1},
    "-rating": {"average_rating": -1, "review_count": -1, "_id": 1},
    "reviews": {"review_count": 1, "_id": 1},
    "-reviews": {"review_count": -1, "_id": 1},
    "newest": {"created_at": -1, "_id": -1},
    "oldest": {"created_at": 1, "_id": 1},
}
_STATS_SORTS = {"rating", "-rating", "reviews", "-reviews"}


def rating_stats_stages() -> list[dict[str, Any]]:
    """Attach `average_rating` (2dp, null if unrated) and `review_count` to each college.

    The `$lookup` sub-pipeline groups the college's reviews; it is served by the
    `college_id` index on `reviews`.
    """
    return [
        {
            "$lookup": {
                "from": Review.get_collection_name(),
                "localField": "_id",
                "foreignField": "college_id",
                "pipeline": [
                    {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
                ],
                "as": "_stats",
            }
        },
        {
            "$set": {
                "average_rating": {"$round": [{"$first": "$_stats.avg"}, 2]},
                "review_count": {"$ifNull": [{"$first": "$_stats.count"}, 0]},
            }
        },
        {"$unset": "_stats"},
    ]


async def list_colleges(
    *,
    page: int,
    limit: int,
    search: str | None = None,
    city: str | None = None,
    state: str | None = None,
    min_rating: float | None = None,
    sort: CollegeSort = "name",
) -> Page[CollegeOut]:
    match: dict[str, Any] = {}
    if search:
        pattern = {"$regex": re.escape(search), "$options": "i"}
        match["$or"] = [{"name": pattern}, {"city": pattern}, {"state": pattern}]
    if city:
        match["city"] = city  # case-insensitive via collation
    if state:
        match["state"] = state

    page_stages = [{"$sort": _SORTS[sort]}, {"$skip": (page - 1) * limit}, {"$limit": limit}]

    if sort in _STATS_SORTS or min_rating is not None:
        # Ratings are needed to filter/sort, so compute them for every matching college first.
        pipeline: list[dict[str, Any]] = [{"$match": match}, *rating_stats_stages()]
        if min_rating is not None:
            pipeline.append({"$match": {"average_rating": {"$gte": min_rating}}})
        pipeline.append({"$facet": {"data": page_stages, "total": [{"$count": "n"}]}})
    else:
        # Otherwise paginate first and only aggregate ratings for the page being returned.
        pipeline = [
            {"$match": match},
            {
                "$facet": {
                    "data": [*page_stages, *rating_stats_stages()],
                    "total": [{"$count": "n"}],
                }
            },
        ]

    [result] = await College.aggregate(pipeline, collation=CASE_INSENSITIVE).to_list()
    total = result["total"][0]["n"] if result["total"] else 0
    return Page[CollegeOut](
        data=[CollegeOut.from_row(row) for row in result["data"]],
        meta=PageMeta.build(page, limit, total),
    )


async def get_college_or_404(college_id: PydanticObjectId) -> College:
    college = await College.get(college_id)
    if college is None:
        raise NotFoundError("College not found")
    return college


async def get_college_detail(college_id: PydanticObjectId) -> CollegeDetail:
    college = await get_college_or_404(college_id)
    buckets = await Review.aggregate(
        [
            {"$match": {"college_id": college.id}},
            {"$group": {"_id": "$rating", "count": {"$sum": 1}}},
        ]
    ).to_list()

    distribution = {str(star): 0 for star in range(1, 6)}
    total = rating_sum = 0
    for bucket in buckets:
        distribution[str(bucket["_id"])] = bucket["count"]
        total += bucket["count"]
        rating_sum += bucket["_id"] * bucket["count"]

    return CollegeDetail(
        **college.model_dump(exclude={"id", "created_by"}),
        id=str(college.id),
        average_rating=round(rating_sum / total, 2) if total else None,
        review_count=total,
        rating_distribution=distribution,
    )


async def create_college(data: CollegeCreate, author: User) -> CollegeDetail:
    college = College(**data.model_dump(mode="json"), created_by=author.id)
    try:
        await college.insert()
    except DuplicateKeyError as exc:
        raise ConflictError(_NAME_TAKEN) from exc
    return await get_college_detail(college.id)


async def update_college(college_id: PydanticObjectId, data: CollegeUpdate) -> CollegeDetail:
    college = await get_college_or_404(college_id)
    for field, value in data.model_dump(mode="json", exclude_unset=True).items():
        setattr(college, field, value)
    college.updated_at = utc_now()
    try:
        await college.save()
    except DuplicateKeyError as exc:
        raise ConflictError(_NAME_TAKEN) from exc
    return await get_college_detail(college.id)


async def delete_college(college_id: PydanticObjectId) -> None:
    college = await get_college_or_404(college_id)
    # Cascade: reviews of a deleted college are meaningless. On a replica set this pair of
    # writes would be wrapped in a transaction.
    await Review.find(Review.college_id == college.id).delete()
    await college.delete()
