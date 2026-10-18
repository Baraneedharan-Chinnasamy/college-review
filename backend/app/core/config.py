"""Application settings, loaded from environment variables and `.env` files."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent

DEFAULT_JWT_SECRET = "dev-only-insecure-secret-change-me-0123456789"


class Settings(BaseSettings):
    # The project-root .env is shared with docker-compose; a backend/.env (if any) overrides it.
    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "College Review API"
    app_version: str = "1.0.0"
    environment: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "college_reviews"

    jwt_secret: str = Field(default=DEFAULT_JWT_SECRET, min_length=32)
    jwt_algorithm: Literal["HS256", "HS384", "HS512"] = "HS256"
    jwt_expires_minutes: int = Field(default=60, ge=1)

    bcrypt_rounds: int = Field(default=12, ge=4, le=16)

    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    rate_limit_enabled: bool = True
    auth_rate_limit: str = "10/minute"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def _guard_production(self) -> "Settings":
        if self.environment == "production" and self.jwt_secret == DEFAULT_JWT_SECRET:
            raise ValueError("JWT_SECRET must be set to a strong random value in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
