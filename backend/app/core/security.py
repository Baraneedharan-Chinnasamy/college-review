"""Password hashing (bcrypt) and JWT access tokens."""

from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any

import bcrypt
import jwt
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings


@lru_cache
def _dummy_hash(rounds: int) -> str:
    """Hash checked when the email does not exist, with the same cost as real hashes so that
    response time does not reveal which emails are registered."""
    return _hash_sync("timing-attack-mitigation", rounds)


def _hash_sync(password: str, rounds: int) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=rounds)).decode("utf-8")


def _verify_sync(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


async def hash_password(password: str) -> str:
    # bcrypt is CPU-bound; keep it off the event loop.
    return await run_in_threadpool(_hash_sync, password, get_settings().bcrypt_rounds)


async def verify_password(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        dummy = _dummy_hash(get_settings().bcrypt_rounds)
        await run_in_threadpool(_verify_sync, password, dummy)
        return False
    return await run_in_threadpool(_verify_sync, password, password_hash)


def create_access_token(subject: str, role: str) -> tuple[str, int]:
    """Return a signed JWT and its lifetime in seconds."""
    settings = get_settings()
    now = datetime.now(UTC)
    expires_in = settings.jwt_expires_minutes * 60
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_in


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT. Raises `jwt.PyJWTError` on any problem."""
    settings = get_settings()
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["sub", "exp", "iat"]},
    )
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Unexpected token type")
    return payload
