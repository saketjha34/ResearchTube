"""
LocalAuthService — Singleton service for local (email/password) authentication.

Responsibilities:
  - User registration
  - User authentication
  - Refresh token creation, rotation, and revocation
  - Token pair generation
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.models import User, UserAuth, RefreshToken
from app.utils.security_utils import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    hash_refresh_token,
)


class LocalAuthService:
    """
    Singleton service for local email/password authentication flows.

    Usage:
        from app.services.auth.local_auth_service import local_auth_service
        user = await local_auth_service.authenticate_user(db, email, password)
    """

    _instance: "LocalAuthService | None" = None

    def __new__(cls) -> "LocalAuthService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    # ============================================================
    # CREATE LOCAL USER
    # ============================================================

    async def create_local_user(
        self,
        db: AsyncSession,
        email: str,
        password: str,
        username: str | None = None,
        full_name: str | None = None,
    ) -> User:

        clean_email = email.lower().strip()
        clean_username = username.strip() if username else None
        clean_full_name = full_name.strip() if full_name else None

        # 1. Pre-check email uniqueness
        existing_email_user = await db.scalar(
            select(User).where(func.lower(User.email) == clean_email)
        )
        if existing_email_user:
            raise ValueError("A user with this email already exists.")

        # 2. Pre-check username uniqueness
        if clean_username:
            existing_username_user = await db.scalar(
                select(User).where(func.lower(User.username) == clean_username.lower())
            )
            if existing_username_user:
                raise ValueError("A user with this username already exists.")

        user = User(
            email=clean_email,
            username=clean_username,
            full_name=clean_full_name,
            is_active=True,
            is_verified=False,
        )

        try:
            db.add(user)
            await db.flush()

            auth = UserAuth(
                user_id=user.id,
                password_hash=hash_password(password),
                last_password_change=datetime.now(timezone.utc),
            )

            db.add(auth)
            await db.commit()
            await db.refresh(user)
            return user
        except IntegrityError as exc:
            await db.rollback()
            err_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
            if "users_username_key" in err_msg or "username" in err_msg:
                raise ValueError("A user with this username already exists.")
            if "users_email_key" in err_msg or "email" in err_msg:
                raise ValueError("A user with this email already exists.")
            raise ValueError("Registration failed due to conflicting account details.")

    # ============================================================
    # AUTHENTICATE USER
    # ============================================================

    async def authenticate_user(
        self,
        db: AsyncSession,
        email: str,
        password: str,
    ) -> User | None:

        identifier = email.lower().strip()

        user = await db.scalar(
            select(User)
            .options(selectinload(User.auth))
            .where(
                or_(
                    func.lower(User.email) == identifier,
                    func.lower(User.username) == identifier,
                )
            )
        )

        if not user or not user.is_active or not user.auth:
            return None

        if not verify_password(password, user.auth.password_hash):
            return None

        return user

    # ============================================================
    # REFRESH SESSION
    # ============================================================

    async def create_refresh_session(
        self,
        db: AsyncSession,
        user: User,
    ) -> str:

        raw_token = create_refresh_token()
        token_hash = hash_refresh_token(raw_token)

        expires_at = (
            datetime.now(timezone.utc)
            + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )

        refresh_token = RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            revoked=False,
            revoked_at=None,
            replaced_by_hash=None,
        )

        db.add(refresh_token)
        await db.commit()

        return raw_token

    async def get_refresh_session(
        self,
        db: AsyncSession,
        raw_token: str,
    ) -> RefreshToken | None:

        token_hash = hash_refresh_token(raw_token)

        refresh_token = await db.scalar(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash
            )
        )

        if not refresh_token:
            return None

        now = datetime.now(timezone.utc)

        if refresh_token.revoked:
            grace_sec = getattr(settings, "REFRESH_TOKEN_ROTATION_GRACE_PERIOD_SEC", 30)
            if (
                refresh_token.revoked_at
                and (now - refresh_token.revoked_at).total_seconds() <= grace_sec
            ):
                return refresh_token
            return None

        if refresh_token.expires_at < now:
            return None

        return refresh_token

    # ============================================================
    # TOKEN PAIR
    # ============================================================

    async def create_token_pair(
        self,
        db: AsyncSession,
        user: User,
    ) -> tuple[str, str]:

        access_token = create_access_token(user.id)
        refresh_token = await self.create_refresh_session(db, user)
        return access_token, refresh_token

    # ============================================================
    # ROTATE / REVOKE
    # ============================================================

    async def rotate_refresh_token(
        self,
        db: AsyncSession,
        raw_token: str,
    ) -> tuple[str, str]:

        token_hash = hash_refresh_token(raw_token)
        session = await db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )

        if not session:
            raise ValueError("Invalid refresh token.")

        now = datetime.now(timezone.utc)

        if session.expires_at < now:
            raise ValueError("Session expired due to inactivity. Please sign in again.")

        user = await db.scalar(
            select(User).where(User.id == session.user_id)
        )

        if not user or not user.is_active:
            raise ValueError("User account is inactive.")

        # Concurrency / Multi-tab Grace Window:
        # If this token was already rotated within the grace window, don't crash
        if session.revoked:
            grace_sec = getattr(settings, "REFRESH_TOKEN_ROTATION_GRACE_PERIOD_SEC", 30)
            if (
                session.revoked_at
                and (now - session.revoked_at).total_seconds() <= grace_sec
                and session.replaced_by_hash
            ):
                new_access_token = create_access_token(user.id)
                return new_access_token, raw_token

            raise ValueError("Invalid or expired refresh token.")

        # Standard rotation: Generate fresh pair and roll the 7-day inactivity clock forward
        new_access_token = create_access_token(user.id)
        new_raw_refresh_token = create_refresh_token()
        new_token_hash = hash_refresh_token(new_raw_refresh_token)
        new_expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        # Mark old session as revoked with timestamp & replacement link
        session.revoked = True
        session.revoked_at = now
        session.replaced_by_hash = new_token_hash

        new_refresh_token = RefreshToken(
            user_id=user.id,
            token_hash=new_token_hash,
            expires_at=new_expires_at,
            revoked=False,
            revoked_at=None,
            replaced_by_hash=None,
        )

        db.add(new_refresh_token)
        await db.commit()

        return new_access_token, new_raw_refresh_token

    async def revoke_refresh_token(
        self,
        db: AsyncSession,
        raw_token: str,
    ) -> None:

        token_hash = hash_refresh_token(raw_token)
        session = await db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )

        if session:
            session.revoked = True
            session.revoked_at = datetime.now(timezone.utc)
            await db.commit()


# ============================================================
# SINGLETON INSTANCE
# ============================================================

local_auth_service = LocalAuthService()
