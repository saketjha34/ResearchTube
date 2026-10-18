"""
ForgetPasswordService — Manages self-service password reset flows.

Responsibilities:
  - Generate cryptographically secure one-time password reset tokens.
  - Store token hashes with strict expiration and single-use enforcement.
  - Dispatch password reset emails using app.external_services.email_service.
  - Verify tokens on reset page arrival.
  - Validate user identity confirmation, update hashed password, and revoke active sessions.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

# pyrefly: ignore [missing-import]
import structlog
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.models import PasswordResetToken, RefreshToken, User, UserAuth
from app.external_services.email_service import email_service
from app.utils.security_utils import hash_password

logger = structlog.get_logger("forget_password_service")


class ForgetPasswordService:
    """
    Singleton service handling password reset requests, token validation,
    and credential updates.
    """

    _instance: "ForgetPasswordService | None" = None

    def __new__(cls) -> "ForgetPasswordService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @staticmethod
    def _hash_token(raw_token: str) -> str:
        """Derive a SHA-256 digest of the raw token for secure database storage."""
        return hashlib.sha256(raw_token.strip().encode()).hexdigest()

    @staticmethod
    def _mask_email(email: str) -> str:
        """Mask email for privacy during token pre-validation (e.g. s***@gmail.com)."""
        if "@" not in email:
            return email
        local, domain = email.split("@", 1)
        if len(local) <= 2:
            masked_local = local[0] + "***"
        else:
            masked_local = local[0] + "***" + local[-1]
        return f"{masked_local}@{domain}"

    # ============================================================
    # 1. REQUEST PASSWORD RESET
    # ============================================================

    async def request_password_reset(
        self,
        db: AsyncSession,
        identifier: str,
    ) -> None:
        """
        Lookup user by username or email. If found, generate a single-use token
        and dispatch an email. Always returns cleanly to prevent user enumeration.
        """
        clean_identifier = identifier.strip().lower()
        if not clean_identifier:
            return

        # Lookup user by case-insensitive email or username
        stmt = (
            select(User)
            .options(selectinload(User.auth))
            .where(
                or_(
                    func.lower(User.email) == clean_identifier,
                    func.lower(User.username) == clean_identifier,
                )
            )
        )
        user = await db.scalar(stmt)

        if not user or not user.is_active:
            logger.info(
                "auth.forget_password.user_not_found_or_inactive",
                identifier=clean_identifier,
            )
            return

        # Invalidate any existing unused reset tokens for this user
        await db.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used.is_(False),
            )
            .values(
                used=True,
                used_at=datetime.now(timezone.utc),
            )
        )

        # Generate a high-entropy URL-safe token (48 bytes = ~64 characters)
        raw_token = secrets.token_urlsafe(48)
        token_hash = self._hash_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
        )

        reset_token_record = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            used=False,
        )
        db.add(reset_token_record)
        await db.commit()

        # Build portal URL pointing to frontend reset page
        frontend_base = settings.runtime_frontend_url.rstrip("/")
        reset_url = f"{frontend_base}/reset-password?token={raw_token}"

        logger.info(
            "auth.forget_password.token_generated",
            user_id=str(user.id),
            email=user.email,
        )

        # Dispatch transactional email via external email service
        await email_service.send_password_reset_email(
            to_email=user.email,
            username=user.username or user.full_name,
            reset_url=reset_url,
            expire_minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
        )

    # ============================================================
    # 2. VERIFY RESET TOKEN
    # ============================================================

    async def verify_reset_token(
        self,
        db: AsyncSession,
        token: str,
    ) -> dict[str, Any]:
        """
        Verify whether a given token is valid, unexpired, and unused.
        """
        token_hash = self._hash_token(token)
        now = datetime.now(timezone.utc)

        stmt = (
            select(PasswordResetToken)
            .options(selectinload(PasswordResetToken.user))
            .where(PasswordResetToken.token_hash == token_hash)
        )
        token_record = await db.scalar(stmt)

        if not token_record:
            raise ValueError("This password reset link is invalid.")

        if token_record.used:
            raise ValueError("This password reset link has already been used.")

        if token_record.expires_at < now:
            raise ValueError("This password reset link has expired.")

        return {
            "valid": True,
            "email_masked": self._mask_email(token_record.user.email),
        }

    # ============================================================
    # 3. RESET PASSWORD
    # ============================================================

    async def reset_password(
        self,
        db: AsyncSession,
        token: str,
        identifier: str,
        new_password: str,
        confirm_password: str,
    ) -> None:
        """
        Validate token, verify user identity confirmation (matching username or email),
        update password hash, mark token as used, and revoke existing sessions.
        """
        if new_password != confirm_password:
            raise ValueError("Passwords do not match.")

        if len(new_password) < 8:
            raise ValueError("Password must be at least 8 characters long.")

        token_hash = self._hash_token(token)
        now = datetime.now(timezone.utc)

        stmt = (
            select(PasswordResetToken)
            .options(
                selectinload(PasswordResetToken.user).selectinload(User.auth)
            )
            .where(PasswordResetToken.token_hash == token_hash)
        )
        token_record = await db.scalar(stmt)

        if not token_record or token_record.used or token_record.expires_at < now:
            raise ValueError("This password reset link is invalid or has expired.")

        user = token_record.user
        if not user or not user.is_active:
            raise ValueError("User account is inactive or not found.")

        # Identity check: confirmed username or email must match user
        clean_id = identifier.strip().lower()
        user_email = user.email.lower()
        user_uname = (user.username or "").lower()

        if clean_id != user_email and (not user_uname or clean_id != user_uname):
            raise ValueError(
                "The entered username or email does not match the account for this reset link."
            )

        # Update or initialize UserAuth record
        if user.auth:
            user.auth.password_hash = hash_password(new_password)
            user.auth.last_password_change = now
        else:
            new_auth = UserAuth(
                user_id=user.id,
                password_hash=hash_password(new_password),
                last_password_change=now,
            )
            db.add(new_auth)

        # Mark token as consumed
        token_record.used = True
        token_record.used_at = now

        # Revoke all active refresh tokens for the user to force re-login
        await db.execute(
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user.id,
                RefreshToken.revoked.is_(False),
            )
            .values(
                revoked=True,
                revoked_at=now,
            )
        )

        await db.commit()
        logger.info(
            "auth.forget_password.password_updated_successfully",
            user_id=str(user.id),
        )


forget_password_service = ForgetPasswordService()
