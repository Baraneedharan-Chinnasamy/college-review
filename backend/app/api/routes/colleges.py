from typing import Annotated

from beanie import PydanticObjectId
from fastapi import APIRouter, Query, Response, status

from app.api.deps import AdminUser, PaginationDep, StaffUser
from app.api.responses import errors
from app.schemas.college import CollegeCreate, CollegeDetail, CollegeOut, CollegeSort, CollegeUpdate
from app.schemas.common import Page
from app.schemas.review import ReviewOut, ReviewSort
from app.services import college_service, review_service

router = APIRouter(prefix="/colleges", tags=["Colleges"])

SearchQuery = Annotated[str | None, Query(min_length=1, max_length=100)]


@router.get(
    "",
    response_model=Page[CollegeOut],
    summary="List colleges with average rating and review count",
    responses=errors(422),
)
async def list_colleges(
    pagination: PaginationDep,
    search: Annotated[
        str | None, Query(min_length=1, max_length=100, description="Matches name, city or state")
    ] = None,
    city: Annotated[str | None, Query(max_length=80)] = None,
    state: Annotated[str | None, Query(max_length=80)] = None,
    min_rating: Annotated[float | None, Query(ge=1, le=5)] = None,
    sort: CollegeSort = "name",
) -> Page[CollegeOut]:
    return await college_service.list_colleges(
        page=pagination.page,
        limit=pagination.limit,
        search=search,
        city=city,
        state=state,
        min_rating=min_rating,
        sort=sort,
    )


@router.post(
    "",
    response_model=CollegeDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a college (teacher, admin)",
    responses=errors(401, 403, 409, 422),
)
async def create_college(body: CollegeCreate, user: StaffUser) -> CollegeDetail:
    return await college_service.create_college(body, user)


@router.get(
    "/{college_id}",
    response_model=CollegeDetail,
    summary="College details with rating distribution",
    responses=errors(404, 422),
)
async def get_college(college_id: PydanticObjectId) -> CollegeDetail:
    return await college_service.get_college_detail(college_id)


@router.patch(
    "/{college_id}",
    response_model=CollegeDetail,
    summary="Update a college (teacher, admin)",
    responses=errors(401, 403, 404, 409, 422),
)
async def update_college(
    college_id: PydanticObjectId, body: CollegeUpdate, _: StaffUser
) -> CollegeDetail:
    return await college_service.update_college(college_id, body)


@router.delete(
    "/{college_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a college and its reviews (admin)",
    responses=errors(401, 403, 404, 422),
)
async def delete_college(college_id: PydanticObjectId, _: AdminUser) -> Response:
    await college_service.delete_college(college_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{college_id}/reviews",
    response_model=Page[ReviewOut],
    summary="Reviews for one college (paginated, searchable)",
    responses=errors(404, 422),
)
async def list_college_reviews(
    college_id: PydanticObjectId,
    pagination: PaginationDep,
    search: SearchQuery = None,
    min_rating: Annotated[int | None, Query(ge=1, le=5)] = None,
    sort: ReviewSort | None = None,
) -> Page[ReviewOut]:
    await college_service.get_college_or_404(college_id)
    return await review_service.list_reviews(
        page=pagination.page,
        limit=pagination.limit,
        search=search,
        college_id=college_id,
        min_rating=min_rating,
        sort=sort,
    )
