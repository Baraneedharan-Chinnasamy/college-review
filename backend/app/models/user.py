from datetime import datetime
from enum import StrEnum

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.common import utc_now


class Role(StrEnum):
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"


class User(Document):
    name: str
    email: str  # stored lower-cased; uniqueness enforced by index below
    password_hash: str
    role: Role = Role.STUDENT
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "users"
        indexes = [
            IndexModel([("email", ASCENDING)], unique=True, name="uniq_email"),
            IndexModel([("role", ASCENDING)], name="role"),
        ]
