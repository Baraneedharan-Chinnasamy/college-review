"""Cross-cutting behaviour: health, error envelope, headers, settings and security helpers."""

import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from pymongo import AsyncMongoClient

from app.core.config import DEFAULT_JWT_SECRET, Settings, get_settings
from app.core.database import ping
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.main import app
from tests.conftest import API, TEST_DB


async def test_health_reports_database_up(client):
    res = await client.get(f"{API}/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "up"}


async def test_health_reports_database_down(client):
    original = app.state.mongo_client
    unreachable = AsyncMongoClient("mongodb://127.0.0.1:1", serverSelectionTimeoutMS=100)
    app.state.mongo_client = unreachable
    try:
        res = await client.get(f"{API}/health")
    finally:
        app.state.mongo_client = original
        await unreachable.close()
    assert res.status_code == 503
    assert res.json()["database"] == "down"


async def test_lifespan_connects_and_disconnects(monkeypatch):
    # Point the app's own startup hook at the throw-away test database, never the dev one.
    monkeypatch.setattr(get_settings(), "mongodb_db", TEST_DB)
    async with app.router.lifespan_context(app):
        assert await ping(app.state.mongo_client)
    assert not await ping(app.state.mongo_client)


async def test_root_points_to_docs(client):
    res = await client.get("/")
    assert res.json()["docs"] == "/docs"


async def test_openapi_documents_all_resources(client):
    paths = (await client.get("/openapi.json")).json()["paths"]
    for path in ("/auth/login", "/colleges", "/reviews/{review_id}", "/users/{user_id}"):
        assert f"{API}{path}" in paths


async def test_unknown_route_uses_error_envelope(client):
    res = await client.get(f"{API}/nope")
    assert res.status_code == 404
    assert res.json() == {"error": {"code": "NOT_FOUND", "message": "Not Found", "details": None}}


async def test_method_not_allowed(client):
    res = await client.put(f"{API}/reviews")
    assert res.status_code == 405
    assert res.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


async def test_malformed_json_body(client):
    res = await client.post(
        f"{API}/auth/login", content="{not json", headers={"Content-Type": "application/json"}
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_security_and_request_id_headers(client):
    res = await client.get(f"{API}/health", headers={"X-Request-ID": "trace-123"})
    assert res.headers["X-Request-ID"] == "trace-123"
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
    generated = await client.get(f"{API}/health")
    assert len(generated.headers["X-Request-ID"]) == 32


async def test_cors_allows_configured_origin_only(client):
    ok = await client.options(
        f"{API}/colleges",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert ok.headers["access-control-allow-origin"] == "http://localhost:3000"
    evil = await client.get(f"{API}/colleges", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in evil.headers


async def test_unhandled_errors_return_generic_500(db, monkeypatch):
    from app.services import college_service

    async def boom(**_):
        raise RuntimeError("database exploded with secrets")

    monkeypatch.setattr(college_service, "list_colleges", boom)
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        res = await http.get(f"{API}/colleges")
    assert res.status_code == 500
    assert res.json()["error"] == {
        "code": "INTERNAL_ERROR",
        "message": "An unexpected error occurred",
        "details": None,
    }


# --- unit: security helpers -----------------------------------------------------------------


async def test_password_hashing_round_trip():
    hashed = await hash_password("Secret123")
    assert hashed != "Secret123"
    assert await verify_password("Secret123", hashed)
    assert not await verify_password("secret123", hashed)
    assert not await verify_password("Secret123", None)
    assert not await verify_password("Secret123", "not-a-bcrypt-hash")


def test_access_token_round_trip_and_type_check():
    token, expires_in = create_access_token("abc", "student")
    claims = decode_access_token(token)
    assert claims["sub"] == "abc"
    assert claims["role"] == "student"
    assert expires_in > 0

    settings = Settings()
    refresh = jwt.encode(
        {"sub": "abc", "type": "refresh", "iat": 0, "exp": 9999999999}, settings.jwt_secret
    )
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(refresh)


# --- unit: settings -------------------------------------------------------------------------


def test_cors_origins_accept_comma_separated_env(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://a.test, http://b.test")
    assert Settings().cors_origins == ["http://a.test", "http://b.test"]


def test_production_requires_real_jwt_secret(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET", DEFAULT_JWT_SECRET)
    with pytest.raises(ValueError, match="JWT_SECRET"):
        Settings()
    monkeypatch.setenv("JWT_SECRET", "x" * 48)
    assert Settings().environment == "production"
