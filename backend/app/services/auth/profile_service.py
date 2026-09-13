"""
ProfileService — Singleton service for user profile management.

Responsibilities:
  - User lookups by ID
  - Profile updates (username, full_name)
  - Password change (local accounts)
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User, UserAuth
from app.utils.security_utils import hash_password, verify_password


class ProfileService:
    """
    Singleton service for user profile read/write operations.

    Usage:
        from app.services.auth.profile_service import profile_service
        user = await profile_service.get_user_by_id(db, user_id)
    """

    _instance: "ProfileService | None" = None

    def __new__(cls) -> "ProfileService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    # ============================================================
    # GET USER BY ID
    # ============================================================

    async def get_user_by_id(
        self,
        db: AsyncSession,
        user_id: UUID,
    ) -> User | None:

        return await db.scalar(
            select(User).where(User.id == user_id)
        )

    # ============================================================
    # UPDATE PROFILE
    # ============================================================

    async def update_user_profile(
        self,
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
                    raise ValueError("This username is already taken.")

            user.username = normalized_username

        if full_name is not None:
            user.full_name = full_name.strip() or None

        await db.commit()
        await db.refresh(user)

        return user

    # ============================================================
    # CHANGE PASSWORD
    # ============================================================

    async def change_password(
        self,
        db: AsyncSession,
        user: User,
        current_password: str,
        new_password: str,
    ) -> None:

        auth = await db.scalar(
            select(UserAuth).where(UserAuth.user_id == user.id)
        )

        if not auth:
            raise ValueError("Password change is not available for this account.")

        if not verify_password(current_password, auth.password_hash):
            raise ValueError("Current password is incorrect.")

        auth.password_hash = hash_password(new_password)
        auth.last_password_change = datetime.now(timezone.utc)

        await db.commit()


# ============================================================
# SINGLETON INSTANCE
# ============================================================

profile_service = ProfileService()
