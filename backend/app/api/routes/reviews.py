from typing import Annotated

from beanie import PydanticObjectId
from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, PaginationDep
from app.api.responses import errors
from app.schemas.common import Page
from app.schemas.review import ReviewCreate, ReviewOut, ReviewSort, ReviewUpdate
from app.services import review_service

router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.get(
    "",
    response_model=Page[ReviewOut],
    summary="List reviews (paginated, full-text search, filters)",
    responses=errors(422),
)
async def list_reviews(
    pagination: PaginationDep,
    search: Annotated[
        str | None,
        Query(min_length=1, max_length=100, description="Full-text search on title and comment"),
    ] = None,
    college_id: PydanticObjectId | None = None,
    author_id: PydanticObjectId | None = None,
    rating: Annotated[int | None, Query(ge=1, le=5, description="Exact star rating")] = None,
    min_rating: Annotated[int | None, Query(ge=1, le=5)] = None,
    sort: Annotated[
        ReviewSort | None,
        Query(description="Defaults to `relevance` when searching, otherwise `newest`"),
    ] = None,
) -> Page[ReviewOut]:
    return await review_service.list_reviews(
        page=pagination.page,
        limit=pagination.limit,
        search=search,
        college_id=college_id,
        author_id=author_id,
        rating=rating,
        min_rating=min_rating,
        sort=sort,
    )


@router.post(
    "",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
    summary="Write a review (any signed-in user, one per college)",
    responses=errors(401, 403, 404, 409, 422),
)
async def create_review(body: ReviewCreate, user: CurrentUser) -> ReviewOut:
    return await review_service.create_review(body, user)


@router.get(
    "/{review_id}",
    response_model=ReviewOut,
    summary="Get one review",
    responses=errors(404, 422),
)
async def get_review(review_id: PydanticObjectId) -> ReviewOut:
    return await review_service.get_review(review_id)


@router.patch(
    "/{review_id}",
    response_model=ReviewOut,
    summary="Edit your own review",
    responses=errors(401, 403, 404, 422),
)
async def update_review(
    review_id: PydanticObjectId, body: ReviewUpdate, user: CurrentUser
) -> ReviewOut:
    return await review_service.update_review(review_id, body, user)


@router.delete(
    "/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete your own review (admins may delete any)",
    responses=errors(401, 403, 404, 422),
)
async def delete_review(review_id: PydanticObjectId, user: CurrentUser) -> Response:
    await review_service.delete_review(review_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
