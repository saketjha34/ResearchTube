"""
Local auth routes — registration, login, token refresh, logout.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.db.database import get_db
from app.db.models import User
from app.schema.auth import (
    RegisterRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
)
from app.services.auth.local_auth_service import local_auth_service
from app.services.auth.profile_service import profile_service


router = APIRouter()


# ============================================================
# REGISTER
# ============================================================

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/hour")          # prevent account-creation spam
async def register(
    request: Request,
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await local_auth_service.create_local_user(
            db=db,
            email=data.email,
            password=data.password,
            username=data.username,
            full_name=data.full_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    access_token, refresh_token = await local_auth_service.create_token_pair(db, user)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


# ============================================================
# LOGIN
# ============================================================

@router.post(
    "/login",
    response_model=TokenResponse,
)
@limiter.limit("10/minute")        # brute-force protection
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    user = await local_auth_service.authenticate_user(
        db=db,
        email=form_data.username,
        password=form_data.password,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    access_token, refresh_token = await local_auth_service.create_token_pair(db, user)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


# ============================================================
# REFRESH
# ============================================================

@router.post(
    "/refresh",
    response_model=TokenResponse,
)
@limiter.limit("30/minute")        # token refresh abuse
async def refresh(
    request: Request,
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        access_token, refresh_token = await local_auth_service.rotate_refresh_token(
            db,
            data.refresh_token,
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    session = await local_auth_service.get_refresh_session(db, refresh_token)

    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    user = await profile_service.get_user_by_id(db, session.user_id)

    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


# ============================================================
# LOGOUT
# ============================================================

@router.post("/logout")
@limiter.limit("20/minute")        # prevent refresh token flood
async def logout(
    request: Request,
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    await local_auth_service.revoke_refresh_token(db, data.refresh_token)
    return {"message": "Successfully logged out."}
