"""
Security utilities for password hashing, JWT token generation/decoding,
and refresh token operations.
"""

import hashlib
import secrets

from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt

# pyrefly: ignore [missing-import]
from pwdlib import PasswordHash

from app.core.config import settings


# ============================================================
# PASSWORD HASHER (module-level singleton)
# ============================================================

_password_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hasher.verify(password, password_hash)


# ============================================================
# ACCESS TOKEN
# ============================================================

def create_access_token(user_id: UUID) -> str:

    expire = (
        datetime.now(timezone.utc)
        + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": expire
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.
    Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError on failure.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM]
    )


# ============================================================
# REFRESH TOKEN
# ============================================================

def create_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
