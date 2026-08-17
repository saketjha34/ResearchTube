import hashlib
import secrets

from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

# pyrefly: ignore [missing-import]
from pwdlib import PasswordHash

from app.core.config import settings
from app.db.database import get_db

from app.db.models import (
    User,
    UserAuth,
    RefreshToken,
)


# PASSWORD HASHER
password_hasher = PasswordHash.recommended()


# OAUTH2 SCHEME
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)


# PASSWORD FUNCTIONS
def hash_password(
    password: str
) -> str:

    return password_hasher.hash(
        password
    )


def verify_password(
    password: str,
    password_hash: str
) -> bool:

    return password_hasher.verify(
        password,
        password_hash
    )


# CREATE ACCESS TOKEN
def create_access_token(
    user_id: UUID
) -> str:

    expire = (
        datetime.now(timezone.utc)
        +
        timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
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


# CREATE REFRESH TOKEN
def create_refresh_token() -> str:
    return secrets.token_urlsafe(64)


# HASH REFRESH TOKEN
def hash_refresh_token(
    token: str
) -> str:

    return hashlib.sha256(
        token.encode()
    ).hexdigest()


# CREATE LOCAL USER
async def create_local_user(
    db: AsyncSession,
    email: str,
    password: str,
    username: str | None = None,
    full_name: str | None = None
) -> User:

    email = email.lower().strip()

    existing_user = await db.scalar(
        select(User).where(
            User.email == email
        )
    )

    if existing_user:

        raise ValueError(
            "A user with this email already exists."
        )

    user = User(
        email=email,
        username=username,
        full_name=full_name,
        is_active=True,
        is_verified=False
    )

    db.add(user)

    await db.flush()

    auth = UserAuth(
        user_id=user.id,
        password_hash=hash_password(password),
        last_password_change=datetime.now(timezone.utc)
    )

    db.add(auth)

    await db.commit()

    await db.refresh(user)

    return user


# AUTHENTICATE LOCAL USER
async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str
) -> User | None:

    email = email.lower().strip()

    user = await db.scalar(
        select(User)
        .options(selectinload(User.auth))
        .where(User.email == email)
    )

    if not user:

        return None

    if not user.is_active:

        return None

    if not user.auth:

        return None

    if not verify_password(
        password,
        user.auth.password_hash
    ):

        return None

    return user


# ============================================================
# CREATE REFRESH SESSION
async def create_refresh_session(
    db: AsyncSession,
    user: User
) -> str:

    raw_token = create_refresh_token()

    token_hash = hash_refresh_token(
        raw_token
    )

    expires_at = (
        datetime.now(timezone.utc)
        +
        timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
    )

    refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        revoked=False
    )

    db.add(refresh_token)

    await db.commit()

    return raw_token


# ============================================================
# CREATE TOKEN PAIR
# ============================================================

async def create_token_pair(
    db: AsyncSession,
    user: User
):

    access_token = create_access_token(
        user.id
    )

    refresh_token = await create_refresh_session(
        db,
        user
    )

    return (
        access_token,
        refresh_token
    )


# ============================================================
# GET REFRESH SESSION
# ============================================================

async def get_refresh_session(
    db: AsyncSession,
    raw_token: str
) -> RefreshToken | None:

    token_hash = hash_refresh_token(
        raw_token
    )

    refresh_token = await db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash
        )
    )

    if not refresh_token:

        return None

    if refresh_token.revoked:

        return None

    if refresh_token.expires_at < datetime.now(
        timezone.utc
    ):

        return None

    return refresh_token


# ============================================================
# ROTATE REFRESH TOKEN
# ============================================================

async def rotate_refresh_token(
    db: AsyncSession,
    raw_token: str
):

    session = await get_refresh_session(
        db,
        raw_token
    )

    if not session:

        raise ValueError(
            "Invalid or expired refresh token."
        )

    user = await db.scalar(
        select(User).where(
            User.id == session.user_id
        )
    )

    if not user or not user.is_active:

        raise ValueError(
            "User account is inactive."
        )

    session.revoked = True

    await db.commit()

    return await create_token_pair(
        db,
        user
    )


# ============================================================
# REVOKE REFRESH TOKEN
# ============================================================

async def revoke_refresh_token(
    db: AsyncSession,
    raw_token: str
):

    session = await get_refresh_session(
        db,
        raw_token
    )

    if session:

        session.revoked = True

        await db.commit()


# ============================================================
# GET USER BY ID
# ============================================================

async def get_user_by_id(
    db: AsyncSession,
    user_id: UUID
) -> User | None:

    return await db.scalar(
        select(User).where(
            User.id == user_id
        )
    )


async def update_user_profile(
    db: AsyncSession,
    user: User,
    full_name: str | None,
    username: str | None,
) -> User:

    if username is not None:

        normalized_username = username.strip() or None

        if normalized_username:

            existing_username_user = await db.scalar(
                select(User).where(
                    User.username == normalized_username,
                    User.id != user.id,
                )
            )

            if existing_username_user:

                raise ValueError(
                    "This username is already taken."
                )

        user.username = normalized_username

    if full_name is not None:

        user.full_name = full_name.strip() or None

    await db.commit()
    await db.refresh(user)

    return user


async def change_local_user_password(
    db: AsyncSession,
    user: User,
    current_password: str,
    new_password: str,
):

    auth = await db.scalar(
        select(UserAuth).where(
            UserAuth.user_id == user.id
        )
    )

    if not auth:

        raise ValueError(
            "Password change is not available for this account."
        )

    if not verify_password(
        current_password,
        auth.password_hash
    ):

        raise ValueError(
            "Current password is incorrect."
        )

    auth.password_hash = hash_password(
        new_password
    )

    auth.last_password_change = datetime.now(
        timezone.utc
    )

    await db.commit()


# ============================================================
# GET CURRENT USER FROM JWT
# ============================================================

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:

    # --------------------------------------------------------
    # Decode JWT
    # --------------------------------------------------------

    try:

        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[
                settings.JWT_ALGORITHM
            ]
        )

    except jwt.ExpiredSignatureError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={
                "WWW-Authenticate": "Bearer"
            }
        )

    except jwt.InvalidTokenError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={
                "WWW-Authenticate": "Bearer"
            }
        )

    # --------------------------------------------------------
    # Check token type
    # --------------------------------------------------------

    if payload.get("type") != "access":

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token.",
            headers={
                "WWW-Authenticate": "Bearer"
            }
        )

    # --------------------------------------------------------
    # Get user ID
    # --------------------------------------------------------

    user_id = payload.get("sub")

    if not user_id:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
            headers={
                "WWW-Authenticate": "Bearer"
            }
        )

    # --------------------------------------------------------
    # Convert UUID
    # --------------------------------------------------------

    try:

        user_uuid = UUID(user_id)

    except (ValueError, TypeError):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID.",
            headers={
                "WWW-Authenticate": "Bearer"
            }
        )

    # --------------------------------------------------------
    # Get user
    # --------------------------------------------------------

    user = await get_user_by_id(
        db,
        user_uuid
    )

    if not user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
            headers={
                "WWW-Authenticate": "Bearer"
            }
        )

    # --------------------------------------------------------
    # Check active
    # --------------------------------------------------------

    if not user.is_active:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive."
        )

    return user