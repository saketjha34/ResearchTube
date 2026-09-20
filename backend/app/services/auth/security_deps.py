"""
security_deps — FastAPI dependencies for JWT-based authentication.

Provides get_current_user dependency for route injection.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

import jwt

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import User
from app.utils.security_utils import decode_access_token


# ============================================================
# OAUTH2 SCHEME
# ============================================================

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ============================================================
# GET CURRENT USER DEPENDENCY
# ============================================================

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency that decodes the JWT Bearer token and returns
    the authenticated User. Raises HTTPException on any failure.
    """
    # --------------------------------------------------------
    # Decode JWT
    # --------------------------------------------------------

    try:
        payload = decode_access_token(token)

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # --------------------------------------------------------
    # Validate token type
    # --------------------------------------------------------

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # --------------------------------------------------------
    # Extract user ID
    # --------------------------------------------------------

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # --------------------------------------------------------
    # Fetch user from DB
    # --------------------------------------------------------

    from sqlalchemy import select
    user = await db.scalar(select(User).where(User.id == user_uuid))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )

    return user


# ============================================================
# OPTIONAL CURRENT USER DEPENDENCY
# ============================================================

oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_optional_user(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    Returns the authenticated user if a valid Bearer token is provided,
    otherwise returns None without raising an HTTPException.
    """
    if not token:
        return None

    try:
        payload = decode_access_token(token)
        if payload.get("type") != "access":
            return None

        user_id = payload.get("sub")
        if not user_id:
            return None

        user_uuid = UUID(user_id)
        from sqlalchemy import select
        user = await db.scalar(select(User).where(User.id == user_uuid))
        if user and user.is_active:
            return user
    except Exception:
        return None

    return None

