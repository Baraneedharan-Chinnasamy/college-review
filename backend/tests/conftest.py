"""Test fixtures.

Integration tests run against a real MongoDB (the one from `docker compose up -d`) using a
throw-away database, so aggregation pipelines, text search and unique indexes are exercised
exactly as in production. Set TEST_MONGODB_URI to point somewhere else.
"""

import os
import uuid

# Must be set before the app (and its cached settings) is imported.
os.environ["ENVIRONMENT"] = "test"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["AUTH_RATE_LIMIT"] = "10/minute"
os.environ["BCRYPT_ROUNDS"] = "4"  # fast hashing in tests
os.environ["LOG_LEVEL"] = "WARNING"
if os.getenv("TEST_MONGODB_URI"):
    os.environ["MONGODB_URI"] = os.environ["TEST_MONGODB_URI"]

from collections.abc import AsyncIterator, Awaitable, Callable  # noqa: E402

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from pymongo import MongoClient  # noqa: E402
from pymongo.errors import PyMongoError  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.database import connect_db  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import DOCUMENT_MODELS, College, Review, Role, User  # noqa: E402

TEST_DB = f"{get_settings().mongodb_db}_test_{uuid.uuid4().hex[:8]}"
PASSWORD = "Password123"
API = get_settings().api_prefix

Headers = dict[str, str]
MakeUser = Callable[..., Awaitable[tuple[User, Headers]]]


@pytest.fixture(scope="session", autouse=True)
def _test_database():
    """Fail fast with a helpful message if MongoDB is down; drop the test DB afterwards."""
    sync_client: MongoClient = MongoClient(
        get_settings().mongodb_uri, serverSelectionTimeoutMS=3000
    )
    try:
        sync_client.admin.command("ping")
    except PyMongoError as exc:
        pytest.exit(
            f"MongoDB is not reachable at {get_settings().mongodb_uri} ({exc.__class__.__name__}). "
            "Start it with `docker compose up -d mongo` or set TEST_MONGODB_URI.",
            returncode=2,
        )
    yield
    sync_client.drop_database(TEST_DB)
    sync_client.close()


@pytest.fixture
async def db():
    client = await connect_db(get_settings(), db_name=TEST_DB)
    app.state.mongo_client = client
    yield client
    for model in DOCUMENT_MODELS:
        await model.get_pymongo_collection().delete_many({})
    await client.close()


@pytest.fixture
async def client(db) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http


def bearer(user: User) -> Headers:
    token, _ = create_access_token(str(user.id), user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def make_user(db) -> MakeUser:
    async def _make(
        role: Role = Role.STUDENT,
        *,
        email: str | None = None,
        name: str | None = None,
        password: str = PASSWORD,
        is_active: bool = True,
    ) -> tuple[User, Headers]:
        user = User(
            name=name or f"Test {role.value.title()}",
            email=email or f"{role.value}-{uuid.uuid4().hex[:8]}@example.com",
            password_hash=await hash_password(password),
            role=role,
            is_active=is_active,
        )
        await user.insert()
        return user, bearer(user)

    return _make


@pytest.fixture
async def admin(make_user: MakeUser) -> tuple[User, Headers]:
    return await make_user(Role.ADMIN, name="Ada Admin")


@pytest.fixture
async def teacher(make_user: MakeUser) -> tuple[User, Headers]:
    return await make_user(Role.TEACHER, name="Tara Teacher")


@pytest.fixture
async def student(make_user: MakeUser) -> tuple[User, Headers]:
    return await make_user(Role.STUDENT, name="Sam Student")


@pytest.fixture
def make_college(db) -> Callable[..., Awaitable[College]]:
    async def _make(name: str | None = None, **fields) -> College:
        college = College(
            name=name or f"College {uuid.uuid4().hex[:6]}",
            city=fields.pop("city", "Chennai"),
            state=fields.pop("state", "Tamil Nadu"),
            **fields,
        )
        await college.insert()
        return college

    return _make


@pytest.fixture
async def college(make_college) -> College:
    return await make_college("Test Institute of Technology", established_year=1990)


@pytest.fixture
def make_review(db) -> Callable[..., Awaitable[Review]]:
    async def _make(college: College, author: User, rating: int = 4, **fields) -> Review:
        review = Review(
            college_id=college.id,
            author_id=author.id,
            rating=rating,
            title=fields.pop("title", f"{rating} star experience"),
            comment=fields.pop("comment", "A detailed comment about the campus and faculty."),
            **fields,
        )
        await review.insert()
        return review

    return _make
