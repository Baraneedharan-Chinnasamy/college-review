"""FastAPI application factory."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import connect_db
from app.core.errors import register_exception_handlers
from app.core.middleware import RequestContextMiddleware, configure_logging
from app.core.rate_limit import limiter

logger = logging.getLogger("app")

DESCRIPTION = """
REST API for a **College Review System**.

* **Auth** – register / login with JWT bearer tokens (bcrypt-hashed passwords).
* **Roles** – `student` writes reviews, `teacher` also manages colleges, `admin` manages
  everything including users and moderation.
* **Colleges** – CRUD; listing includes the aggregated **average rating** and **review count**.
* **Reviews** – CRUD with pagination, filters and full-text search.

Click **Authorize** and paste the `access_token` from `/auth/login` to call protected endpoints.
Seeded accounts are listed in the README.
"""

TAGS = [
    {"name": "Auth", "description": "Registration, login and the current user"},
    {"name": "Colleges", "description": "Colleges with aggregated ratings"},
    {"name": "Reviews", "description": "Student/teacher reviews of colleges"},
    {"name": "Users (admin)", "description": "User administration"},
    {"name": "Health", "description": "Service health"},
]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    client = await connect_db(settings)
    app.state.mongo_client = client
    logger.info("Connected to MongoDB database '%s'", settings.mongodb_db)
    try:
        yield
    finally:
        await client.close()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=DESCRIPTION,
        openapi_tags=TAGS,
        lifespan=lifespan,
        swagger_ui_parameters={"persistAuthorization": True},
    )

    app.state.limiter = limiter
    limiter.enabled = settings.rate_limit_enabled

    register_exception_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    app.add_middleware(RequestContextMiddleware)
    app.include_router(api_router, prefix=settings.api_prefix)

    @app.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
            "openapi": "/openapi.json",
            "api": settings.api_prefix,
        }

    return app


app = create_app()
