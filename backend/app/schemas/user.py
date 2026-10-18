from datetime import datetime

from pydantic import BaseModel, model_validator

from app.models import Role, User
from app.schemas.common import InputModel


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: Role
    is_active: bool
    created_at: datetime

    @classmethod
    def from_doc(cls, user: User) -> "UserOut":
        return cls(
            id=str(user.id),
            name=user.name,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
        )


class UserAdminUpdate(InputModel):
    role: Role | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def _not_empty(self) -> "UserAdminUpdate":
        if self.role is None and self.is_active is None:
            raise ValueError("Provide at least one of: role, is_active")
        return self
