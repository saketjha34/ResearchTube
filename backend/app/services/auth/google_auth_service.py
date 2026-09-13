"""
GoogleAuthService — Singleton service for Google OAuth2 authentication.

Responsibilities:
  - OAuth2 authorization redirect
  - Google callback handling (user creation/linking)
  - Token pair generation after Google sign-in
"""

from __future__ import annotations

import json
from urllib.parse import quote

from fastapi import Request, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from authlib.integrations.starlette_client import OAuth

from app.core.config import settings
from app.db.models import User, OAuthAccount, AuthProvider
from app.services.auth.local_auth_service import local_auth_service


class GoogleAuthService:
    """
    Singleton service for Google OAuth2 flows.

    Usage:
        from app.services.auth.google_auth_service import google_auth_service
        return await google_auth_service.get_authorization_redirect(request, prompt)
    """

    _instance: "GoogleAuthService | None" = None

    def __new__(cls) -> "GoogleAuthService":
        if cls._instance is None:
            instance = super().__new__(cls)
            instance._oauth = OAuth()
            instance._oauth.register(
                name="google",
                client_id=settings.GOOGLE_CLIENT_ID,
                client_secret=settings.GOOGLE_CLIENT_SECRET,
                server_metadata_url=(
                    "https://accounts.google.com/.well-known/openid-configuration"
                ),
                client_kwargs={
                    "scope": "openid email profile"
                },
            )
            cls._instance = instance
        return cls._instance

    # ============================================================
    # AUTHORIZATION REDIRECT
    # ============================================================

    async def get_authorization_redirect(
        self,
        request: Request,
        prompt: str | None = None,
    ):
        if (
            settings.ENVIRONMENT == "prod"
            or request.headers.get("x-forwarded-proto") == "https"
        ):
            request.scope["scheme"] = "https"

        redirect_uri = request.url_for("google_callback")
        selected_prompt = prompt or "select_account"

        return await self._oauth.google.authorize_redirect(
            request,
            redirect_uri,
            prompt=selected_prompt,
            access_type="offline",
            include_granted_scopes="true",
        )

    # ============================================================
    # CALLBACK HANDLER
    # ============================================================

    async def handle_google_callback(
        self,
        request: Request,
        db: AsyncSession,
    ) -> RedirectResponse:
        """
        Handle Google OAuth callback, create or link user account, and
        redirect to frontend with JWT tokens as URL fragment parameters.
        """
        from app.schema.auth import UserResponse

        if (
            settings.ENVIRONMENT == "prod"
            or request.headers.get("x-forwarded-proto") == "https"
        ):
            request.scope["scheme"] = "https"

        # --------------------------------------------------------
        # Exchange authorization code for tokens
        # --------------------------------------------------------

        try:
            token = await self._oauth.google.authorize_access_token(request)
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=401,
                detail=f"Google authentication failed: {str(e)}",
            )

        user_info = token.get("userinfo")

        if not user_info:
            raise HTTPException(
                status_code=401,
                detail="Could not retrieve Google user information.",
            )

        google_id = user_info.get("sub")
        email = user_info.get("email")
        name = user_info.get("name")
        picture = user_info.get("picture")
        email_verified = user_info.get("email_verified", False)

        if not google_id or not email:
            raise HTTPException(
                status_code=400,
                detail="Google account did not provide required information.",
            )

        # --------------------------------------------------------
        # Find existing Google OAuth account
        # --------------------------------------------------------

        oauth_account = await db.scalar(
            select(OAuthAccount).where(
                OAuthAccount.provider == AuthProvider.GOOGLE,
                OAuthAccount.provider_user_id == google_id,
            )
        )

        # --------------------------------------------------------
        # Existing Google account — find linked user
        # --------------------------------------------------------

        if oauth_account:

            user = await db.scalar(
                select(User).where(User.id == oauth_account.user_id)
            )

        # --------------------------------------------------------
        # New Google account — create or link user
        # --------------------------------------------------------

        else:

            user = await db.scalar(
                select(User).where(User.email == email.lower())
            )

            if not user:

                user = User(
                    email=email.lower(),
                    full_name=name,
                    profile_picture_url=picture,
                    is_active=True,
                    is_verified=email_verified,
                )

                db.add(user)
                await db.flush()

            else:

                if not user.profile_picture_url:
                    user.profile_picture_url = picture

                if not user.full_name:
                    user.full_name = name

                if email_verified:
                    user.is_verified = True

            oauth_account = OAuthAccount(
                user_id=user.id,
                provider=AuthProvider.GOOGLE,
                provider_user_id=google_id,
                provider_email=email,
                access_token=token.get("access_token"),
                refresh_token=token.get("refresh_token"),
            )

            db.add(oauth_account)
            await db.commit()
            await db.refresh(user)

        # --------------------------------------------------------
        # Issue JWT pair and redirect to frontend
        # --------------------------------------------------------

        access_token, refresh_token = await local_auth_service.create_token_pair(db, user)

        user_payload = UserResponse.model_validate(user)
        user_json = json.dumps(user_payload.model_dump(mode="json"))

        frontend_callback = (
            f"{settings.runtime_frontend_url.rstrip('/')}"
            "/auth/callback"
        )

        fragment = (
            f"access_token={quote(access_token)}"
            f"&refresh_token={quote(refresh_token)}"
            "&token_type=bearer"
            f"&user={quote(user_json)}"
        )

        return RedirectResponse(
            url=f"{frontend_callback}#{fragment}",
            status_code=302,
        )


# ============================================================
# SINGLETON INSTANCE
# ============================================================

google_auth_service = GoogleAuthService()
