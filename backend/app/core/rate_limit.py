"""Shared rate limiter (in-memory; swap `storage_uri` for Redis when running several replicas)."""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings

limiter = Limiter(key_func=get_remote_address, enabled=get_settings().rate_limit_enabled)
