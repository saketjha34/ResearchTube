"""
Rate Limiter — centralised slowapi configuration.

All route files import `limiter` and `get_rate_limit_key`
from here to keep limit logic in one place.

Key strategy:
    - Authenticated endpoints  → keyed by user_id (JWT sub)
    - Public / auth endpoints  → keyed by client IP
"""

from __future__ import annotations

from fastapi import Request
# pyrefly: ignore [missing-import]
from slowapi import Limiter


def _rate_limit_key(request: Request) -> str:
    """
    Key function for slowapi.

    Priority:
        1. Authenticated user id extracted from the JWT
           (already decoded by FastAPI's dependency chain and
            stored in request.state by the JWTAuthMiddleware if
            present, otherwise we read the Authorization header
            directly as a last resort).
        2. Forwarded IP from reverse proxy (Cloud Run / Nginx).
        3. Direct client IP.
    """

    # 1. If the JWT sub was attached to request.state by a
    #    dependency, use it as the key (per-user limiting).
    user_id: str | None = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"

    # 2. Reverse-proxy forwarded IP (Cloud Run sets X-Forwarded-For)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return f"ip:{forwarded.split(',')[0].strip()}"

    # 3. Direct client IP
    client = request.client
    if client:
        return f"ip:{client.host}"

    return "ip:unknown"


# ============================================================
# LIMITER INSTANCE
# In-memory backend — sufficient for a single-instance API.
# For multi-instance / Cloud Run with many containers, swap
# storage_uri to a Redis URL:
#   Limiter(key_func=_rate_limit_key, storage_uri="redis://redis:6379")
# ============================================================

limiter = Limiter(key_func=_rate_limit_key)
