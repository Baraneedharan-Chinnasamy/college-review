"""Review CRUD, listing with pagination / full-text search, and ownership rules."""

from typing import Any

from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.models import College, Review, Role, User
from app.models.common import utc_now
from app.schemas.common import Page, PageMeta
from app.schemas.review import ReviewCreate, ReviewOut, ReviewSort, ReviewUpdate

_SORTS: dict[str, dict[str, int]] = {
    "newest": {"created_at": -1, "_id": -1},
    "oldest": {"created_at": 1, "_id": 1},
    "-rating": {"rating": -1, "created_at": -1, "_id": -1},
    "rating": {"rating": 1, "created_at": -1, "_id": -1},
    "relevance": {"_score": -1, "created_at": -1, "_id": -1},
}


def _populate_stages() -> list[dict[str, Any]]:
    """Join the author's public profile and the college name onto each review."""
    return [
        {
            "$lookup": {
                "from": User.get_collection_name(),
                "localField": "author_id",
                "foreignField": "_id",
                "pipeline": [{"$project": {"name": 1, "role": 1}}],
                "as": "author",
            }
        },
        {
            "$lookup": {
                "from": College.get_collection_name(),
                "localField": "college_id",
                "foreignField": "_id",
                "pipeline": [{"$project": {"name": 1}}],
                "as": "college",
            }
        },
        {"$set": {"author": {"$first": "$author"}, "college": {"$first": "$college"}}},
    ]


async def list_reviews(
    *,
    page: int,
    limit: int,
    search: str | None = None,
    college_id: PydanticObjectId | None = None,
    author_id: PydanticObjectId | None = None,
    rating: int | None = None,
    min_rating: int | None = None,
    sort: ReviewSort | None = None,
) -> Page[ReviewOut]:
    match: dict[str, Any] = {}
    if search:
        match["$text"] = {"$search": search}  # uses the weighted title/comment text index
    if college_id:
        match["college_id"] = college_id
    if author_id:
        match["author_id"] = author_id
    if rating is not None:
        match["rating"] = rating
    elif min_rating is not None:
        match["rating"] = {"$gte": min_rating}

    if sort is None or (sort == "relevance" and not search):
        sort = "relevance" if search else "newest"

    pipeline: list[dict[str, Any]] = [{"$match": match}]
    if search:
        pipeline.append({"$set": {"_score": {"$meta": "textScore"}}})
    pipeline.append(
        {
            "$facet": {
                "data": [
                    {"$sort": _SORTS[sort]},
                    {"$skip": (page - 1) * limit},
                    {"$limit": limit},
                    *_populate_stages(),
                ],
                "total": [{"$count": "n"}],
            }
        }
    )

    [result] = await Review.aggregate(pipeline).to_list()
    total = result["total"][0]["n"] if result["total"] else 0
    return Page[ReviewOut](
        data=[ReviewOut.from_row(row) for row in result["data"]],
        meta=PageMeta.build(page, limit, total),
    )


async def get_review(review_id: PydanticObjectId) -> ReviewOut:
    rows = await Review.aggregate([{"$match": {"_id": review_id}}, *_populate_stages()]).to_list()
    if not rows:
        raise NotFoundError("Review not found")
    return ReviewOut.from_row(rows[0])


async def _get_review_doc(review_id: PydanticObjectId) -> Review:
    review = await Review.get(review_id)
    if review is None:
        raise NotFoundError("Review not found")
    return review


async def create_review(data: ReviewCreate, author: User) -> ReviewOut:
    if await College.get(data.college_id) is None:
        raise NotFoundError("College not found")
    review = Review(
        college_id=data.college_id,
        author_id=author.id,
        rating=data.rating,
        title=data.title,
        comment=data.comment,
    )
    try:
        await review.insert()
    except DuplicateKeyError as exc:
        raise ConflictError(
            "You have already reviewed this college. Edit your existing review instead."
        ) from exc
    return await get_review(review.id)


async def update_review(review_id: PydanticObjectId, data: ReviewUpdate, user: User) -> ReviewOut:
    review = await _get_review_doc(review_id)
    # Reviews are personal opinions: only the author may change the wording, not even admins.
    if review.author_id != user.id:
        raise ForbiddenError("You can only edit your own reviews")
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(review, field, value)
    review.updated_at = utc_now()
    await review.save()
    return await get_review(review.id)


async def delete_review(review_id: PydanticObjectId, user: User) -> None:
    review = await _get_review_doc(review_id)
    if review.author_id != user.id and user.role != Role.ADMIN:
        raise ForbiddenError("You can only delete your own reviews")
    await review.delete()
