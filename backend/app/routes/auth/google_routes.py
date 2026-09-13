"""
Google OAuth routes — initiate redirect and handle callback.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.db.database import get_db
from app.services.auth.google_auth_service import google_auth_service


router = APIRouter()


# ============================================================
# GOOGLE LOGIN — initiates OAuth redirect
# ============================================================

@router.get("/google")
@limiter.limit("10/minute")        # prevent OAuth initiation spam
async def google_login(
    request: Request,
    prompt: str | None = None,
):
    return await google_auth_service.get_authorization_redirect(request, prompt)


# ============================================================
# GOOGLE CALLBACK — handles OAuth code exchange
# ============================================================

@router.get(
    "/google/callback",
    name="google_callback",
)
async def google_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await google_auth_service.handle_google_callback(request, db)
