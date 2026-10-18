from pymongo.errors import DuplicateKeyError

from app.core.errors import ConflictError, ForbiddenError, UnauthorizedError
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Role, User
from app.schemas.auth import RegisterRequest, TokenResponse
from app.schemas.user import UserOut

_EMAIL_TAKEN = "An account with this email already exists"


async def register_user(data: RegisterRequest) -> User:
    if await User.find_one(User.email == data.email):
        raise ConflictError(_EMAIL_TAKEN)
    user = User(
        name=data.name,
        email=data.email,
        password_hash=await hash_password(data.password),
        role=Role(data.role),
    )
    try:
        await user.insert()
    except DuplicateKeyError as exc:  # lost a race with a concurrent registration
        raise ConflictError(_EMAIL_TAKEN) from exc
    return user


async def authenticate(email: str, password: str) -> User:
    user = await User.find_one(User.email == email)
    # Always run bcrypt so response time does not reveal whether the email exists.
    password_ok = await verify_password(password, user.password_hash if user else None)
    if user is None or not password_ok:
        raise UnauthorizedError("Invalid email or password")
    if not user.is_active:
        raise ForbiddenError("This account has been deactivated")
    return user


def issue_token(user: User) -> TokenResponse:
    token, expires_in = create_access_token(str(user.id), user.role.value)
    return TokenResponse(access_token=token, expires_in=expires_in, user=UserOut.from_doc(user))
