"""Domain exceptions and the handlers that turn every error into one JSON shape:

{"error": {"code": "NOT_FOUND", "message": "College not found", "details": null}}
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pymongo.errors import DuplicateKeyError
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app.errors")


class AppError(Exception):
    status_code = 400
    code = "BAD_REQUEST"
    message = "Bad request"

    def __init__(self, message: str | None = None, details: Any = None) -> None:
        self.message = message or self.message
        self.details = details
        super().__init__(self.message)


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"
    message = "Authentication required"


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"
    message = "You do not have permission to perform this action"


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"
    message = "Resource not found"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"
    message = "Resource already exists"


_HTTP_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    429: "RATE_LIMITED",
}


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: Any = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details}},
        headers=headers,
    )


async def _app_error(_: Request, exc: AppError) -> JSONResponse:
    headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
    return error_response(exc.status_code, exc.code, exc.message, exc.details, headers)


async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = []
    for err in exc.errors():
        loc = [str(part) for part in err.get("loc", ())]
        details.append(
            {
                "location": loc[0] if loc else None,
                "field": ".".join(loc[1:]) or None,
                "message": err.get("msg", "Invalid value"),
            }
        )
    return error_response(422, "VALIDATION_ERROR", "Request validation failed", details)


async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = _HTTP_CODES.get(exc.status_code, "HTTP_ERROR")
    message = exc.detail if isinstance(exc.detail, str) else code.replace("_", " ").capitalize()
    return error_response(exc.status_code, code, message, headers=getattr(exc, "headers", None))


async def _rate_limited(_: Request, exc: RateLimitExceeded) -> JSONResponse:
    return error_response(
        429,
        "RATE_LIMITED",
        f"Too many requests: limit is {exc.detail}",
        headers={"Retry-After": "60"},
    )


async def _duplicate_key(_: Request, exc: DuplicateKeyError) -> JSONResponse:
    # Safety net: services translate known duplicates into friendlier ConflictErrors.
    return error_response(409, "CONFLICT", "Resource already exists")


async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return error_response(500, "INTERNAL_ERROR", "An unexpected error occurred")


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(RateLimitExceeded, _rate_limited)
    app.add_exception_handler(DuplicateKeyError, _duplicate_key)
    app.add_exception_handler(Exception, _unhandled)
