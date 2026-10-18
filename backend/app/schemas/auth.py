import re
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import InputModel
from app.schemas.user import UserOut


class RegisterRequest(InputModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    # Admins cannot be self-registered; they are created by the seed script or promoted by an admin.
    role: Literal["student", "teacher"] = "student"

    @field_validator("email")
    @classmethod
    def _lower_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("password")
    @classmethod
    def _strong_password(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:  # bcrypt only uses the first 72 bytes
            raise ValueError("Password must be at most 72 bytes")
        if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
            raise ValueError("Password must contain at least one letter and one number")
        return value


class LoginRequest(InputModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, value: str) -> str:
        return value.lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserOut
