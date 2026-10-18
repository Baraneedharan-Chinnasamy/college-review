from typing import Annotated

from beanie import PydanticObjectId
from fastapi import APIRouter, Query

from app.api.deps import AdminUser, PaginationDep
from app.api.responses import errors
from app.models import Role
from app.schemas.common import Page
from app.schemas.user import UserAdminUpdate, UserOut
from app.services import user_service

router = APIRouter(prefix="/users", tags=["Users (admin)"])


@router.get(
    "",
    response_model=Page[UserOut],
    summary="List users (admin)",
    responses=errors(401, 403, 422),
)
async def list_users(
    _: AdminUser,
    pagination: PaginationDep,
    search: Annotated[
        str | None, Query(min_length=1, max_length=100, description="Matches name or email")
    ] = None,
    role: Role | None = None,
) -> Page[UserOut]:
    return await user_service.list_users(
        page=pagination.page, limit=pagination.limit, search=search, role=role
    )


@router.get(
    "/{user_id}",
    response_model=UserOut,
    summary="Get a user (admin)",
    responses=errors(401, 403, 404, 422),
)
async def get_user(user_id: PydanticObjectId, _: AdminUser) -> UserOut:
    return UserOut.from_doc(await user_service.get_user_or_404(user_id))


@router.patch(
    "/{user_id}",
    response_model=UserOut,
    summary="Change a user's role or active status (admin)",
    responses=errors(400, 401, 403, 404, 422),
)
async def update_user(
    user_id: PydanticObjectId, body: UserAdminUpdate, admin: AdminUser
) -> UserOut:
    return await user_service.update_user(user_id, body, admin)
