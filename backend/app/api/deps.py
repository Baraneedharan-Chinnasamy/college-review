"""Shared FastAPI dependencies: authentication, role checks and pagination."""

from collections.abc import Awaitable, Callable
from typing import Annotated

import jwt
from beanie import PydanticObjectId
from bson.errors import InvalidId
from fastapi import Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.models import Role, User

bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token from /auth/login")


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    if credentials is None:
        raise UnauthorizedError()
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = PydanticObjectId(payload["sub"])
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("Token has expired") from exc
    except (jwt.PyJWTError, InvalidId, TypeError) as exc:
        raise UnauthorizedError("Invalid authentication token") from exc

    # The role is always read from the database, so promotions/deactivations apply immediately.
    user = await User.get(user_id)
    if user is None:
        raise UnauthorizedError("User no longer exists")
    if not user.is_active:
        raise ForbiddenError("This account has been deactivated")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: Role) -> Callable[[User], Awaitable[User]]:
    allowed = ", ".join(role.value for role in roles)

    async def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise ForbiddenError(f"This action requires one of the roles: {allowed}")
        return user

    return checker


AdminUser = Annotated[User, Depends(require_roles(Role.ADMIN))]
StaffUser = Annotated[User, Depends(require_roles(Role.ADMIN, Role.TEACHER))]


class Pagination:
    def __init__(
        self,
        page: Annotated[int, Query(ge=1, le=10_000, description="1-based page number")] = 1,
        limit: Annotated[int, Query(ge=1, le=100, description="Items per page (max 100)")] = 10,
    ) -> None:
        self.page = page
        self.limit = limit


PaginationDep = Annotated[Pagination, Depends()]
