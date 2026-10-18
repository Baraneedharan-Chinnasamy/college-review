import re
from typing import Any

from beanie import PydanticObjectId

from app.core.errors import AppError, NotFoundError
from app.models import Role, User
from app.models.common import utc_now
from app.schemas.common import Page, PageMeta
from app.schemas.user import UserAdminUpdate, UserOut


async def list_users(
    *, page: int, limit: int, search: str | None = None, role: Role | None = None
) -> Page[UserOut]:
    query: dict[str, Any] = {}
    if search:
        pattern = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [{"name": pattern}, {"email": pattern}]
    if role:
        query["role"] = role.value

    total = await User.find(query).count()
    users = await (
        User.find(query).sort("-created_at", "+_id").skip((page - 1) * limit).limit(limit).to_list()
    )
    return Page[UserOut](
        data=[UserOut.from_doc(user) for user in users], meta=PageMeta.build(page, limit, total)
    )


async def get_user_or_404(user_id: PydanticObjectId) -> User:
    user = await User.get(user_id)
    if user is None:
        raise NotFoundError("User not found")
    return user


async def update_user(user_id: PydanticObjectId, data: UserAdminUpdate, acting: User) -> UserOut:
    user = await get_user_or_404(user_id)
    if user.id == acting.id and (
        (data.role is not None and data.role != Role.ADMIN) or data.is_active is False
    ):
        # Prevents an admin from locking themselves (and possibly everyone) out.
        raise AppError("You cannot demote or deactivate your own account")
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    user.updated_at = utc_now()
    await user.save()
    return UserOut.from_doc(user)
