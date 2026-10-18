from fastapi import APIRouter, Request, status

from app.api.deps import CurrentUser
from app.api.responses import errors
from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])

_AUTH_LIMIT = get_settings().auth_rate_limit


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account (student or teacher) and receive a token",
    responses=errors(409, 422, 429),
)
@limiter.limit(_AUTH_LIMIT)
async def register(request: Request, body: RegisterRequest) -> TokenResponse:
    user = await auth_service.register_user(body)
    return auth_service.issue_token(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Exchange email + password for a JWT access token",
    responses=errors(401, 403, 422, 429),
)
@limiter.limit(_AUTH_LIMIT)
async def login(request: Request, body: LoginRequest) -> TokenResponse:
    user = await auth_service.authenticate(body.email, body.password)
    return auth_service.issue_token(user)


@router.get(
    "/me",
    response_model=UserOut,
    summary="The currently authenticated user",
    responses=errors(401, 403),
)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.from_doc(user)
