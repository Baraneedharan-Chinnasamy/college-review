from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.models import Role, User
from tests.conftest import API, PASSWORD

REGISTER = f"{API}/auth/register"
LOGIN = f"{API}/auth/login"
ME = f"{API}/auth/me"


def _payload(**overrides):
    return {
        "name": "Priya Kumar",
        "email": "priya@example.com",
        "password": "Secret123",
    } | overrides


# --- register -------------------------------------------------------------------------------


async def test_register_creates_student_and_returns_token(client):
    res = await client.post(REGISTER, json=_payload(email="  Priya@Example.COM "))

    assert res.status_code == 201
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == get_settings().jwt_expires_minutes * 60
    assert body["user"]["email"] == "priya@example.com"  # normalised
    assert body["user"]["role"] == "student"
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]

    stored = await User.find_one(User.email == "priya@example.com")
    assert stored is not None
    assert stored.password_hash != "Secret123"
    assert stored.password_hash.startswith("$2b$")

    me = await client.get(ME, headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["id"] == body["user"]["id"]


async def test_register_as_teacher(client):
    res = await client.post(REGISTER, json=_payload(role="teacher"))
    assert res.status_code == 201
    assert res.json()["user"]["role"] == "teacher"


async def test_register_cannot_self_assign_admin(client):
    res = await client.post(REGISTER, json=_payload(role="admin"))
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"
    assert await User.find_one(User.email == "priya@example.com") is None


async def test_register_duplicate_email_is_case_insensitive(client):
    assert (await client.post(REGISTER, json=_payload())).status_code == 201
    res = await client.post(REGISTER, json=_payload(email="PRIYA@example.com"))
    assert res.status_code == 409
    assert res.json()["error"] == {
        "code": "CONFLICT",
        "message": "An account with this email already exists",
        "details": None,
    }


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"email": "not-an-email"}, "email"),
        ({"password": "short1"}, "password"),
        ({"password": "onlyletters"}, "password"),
        ({"password": "12345678"}, "password"),
        ({"password": "é" * 37 + "1"}, "password"),  # > 72 bytes
        ({"name": "A"}, "name"),
        ({"role": "superuser"}, "role"),
    ],
)
async def test_register_validation_errors(client, overrides, field):
    res = await client.post(REGISTER, json=_payload(**overrides))
    assert res.status_code == 422
    error = res.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert any(detail["field"] == field for detail in error["details"])


async def test_register_rejects_unknown_fields(client):
    res = await client.post(REGISTER, json=_payload(is_active=False))
    assert res.status_code == 422


async def test_register_requires_body(client):
    res = await client.post(REGISTER)
    assert res.status_code == 422


# --- login ----------------------------------------------------------------------------------


async def test_login_returns_working_token(client, make_user):
    user, _ = await make_user(Role.TEACHER, email="tara@example.com")

    res = await client.post(LOGIN, json={"email": "TARA@example.com", "password": PASSWORD})

    assert res.status_code == 200
    body = res.json()
    claims = jwt.decode(body["access_token"], options={"verify_signature": False})
    assert claims["sub"] == str(user.id)
    assert claims["role"] == "teacher"
    me = await client.get(ME, headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.json()["email"] == "tara@example.com"


async def test_login_wrong_password_and_unknown_email_look_identical(client, make_user):
    await make_user(email="sam@example.com")

    wrong_pw = await client.post(LOGIN, json={"email": "sam@example.com", "password": "Nope12345"})
    no_user = await client.post(LOGIN, json={"email": "ghost@example.com", "password": PASSWORD})

    assert wrong_pw.status_code == no_user.status_code == 401
    assert wrong_pw.json() == no_user.json()
    assert wrong_pw.json()["error"]["message"] == "Invalid email or password"
    assert wrong_pw.headers["WWW-Authenticate"] == "Bearer"


async def test_login_deactivated_account_is_forbidden(client, make_user):
    await make_user(email="old@example.com", is_active=False)
    res = await client.post(LOGIN, json={"email": "old@example.com", "password": PASSWORD})
    assert res.status_code == 403


async def test_login_validation(client):
    res = await client.post(LOGIN, json={"email": "x@example.com"})
    assert res.status_code == 422
    assert res.json()["error"]["details"][0]["field"] == "password"


# --- token handling -------------------------------------------------------------------------


async def test_me_requires_token(client):
    res = await client.get(ME)
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.parametrize(
    "token",
    [
        "garbage",
        jwt.encode(
            {"sub": "x", "exp": 9999999999, "iat": 0, "type": "access"}, "wrong-secret-" * 4
        ),
    ],
)
async def test_me_rejects_invalid_tokens(client, token):
    res = await client.get(ME, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert res.json()["error"]["message"] == "Invalid authentication token"


def _signed(claims: dict) -> str:
    settings = get_settings()
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def test_me_rejects_expired_token(client, student):
    user, _ = student
    past = datetime.now(UTC) - timedelta(hours=2)
    token = _signed(
        {"sub": str(user.id), "type": "access", "iat": past, "exp": past + timedelta(minutes=5)}
    )
    res = await client.get(ME, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert res.json()["error"]["message"] == "Token has expired"


async def test_me_rejects_token_with_malformed_subject(client):
    now = datetime.now(UTC)
    token = _signed(
        {"sub": "not-an-id", "type": "access", "iat": now, "exp": now + timedelta(minutes=5)}
    )
    res = await client.get(ME, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


async def test_token_of_deleted_user_is_rejected(client, student):
    user, headers = student
    await user.delete()
    res = await client.get(ME, headers=headers)
    assert res.status_code == 401
    assert res.json()["error"]["message"] == "User no longer exists"


async def test_login_is_rate_limited(client):
    limiter.reset()
    limiter.enabled = True
    try:
        creds = {"email": "brute@example.com", "password": "Guess12345"}
        statuses = [(await client.post(LOGIN, json=creds)).status_code for _ in range(11)]
    finally:
        limiter.enabled = False
        limiter.reset()

    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429
