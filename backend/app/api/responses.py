"""Error responses for the OpenAPI docs (the body shape is produced by app.core.errors)."""

from typing import Any

from app.schemas.common import ErrorResponse


def errors(*status_codes: int) -> dict[int | str, dict[str, Any]]:
    descriptions = {
        400: "Bad request",
        401: "Missing, invalid or expired token",
        403: "Authenticated but not allowed",
        404: "Resource not found",
        409: "Conflicts with an existing resource",
        422: "Validation error",
        429: "Rate limit exceeded",
    }
    return {
        code: {"model": ErrorResponse, "description": descriptions[code]} for code in status_codes
    }
