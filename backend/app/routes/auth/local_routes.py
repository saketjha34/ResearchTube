"""
Local auth routes — registration, login, token refresh, logout.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.db.database import get_db
from app.db.models import User
from app.schema.auth import (
    RegisterRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    VerifyResetTokenResponse,
    ResetPasswordRequest,
)
from app.services.auth.local_auth_service import local_auth_service
from app.services.auth.profile_service import profile_service
from app.services.auth.forget_password import forget_password_service


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
    except IntegrityError as e:
        err_msg = str(e.orig) if hasattr(e, "orig") else str(e)
        if "username" in err_msg:
            raise HTTPException(status_code=400, detail="A user with this username already exists.")
        if "email" in err_msg:
            raise HTTPException(status_code=400, detail="A user with this email already exists.")
        raise HTTPException(status_code=400, detail="A user with this email or username already exists.")

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
@limiter.limit("60/minute")        # accommodate multi-tabs and automatic rotation
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


# ============================================================
# FORGOT PASSWORD
# ============================================================

@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
)
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    await forget_password_service.request_password_reset(db, data.identifier)
    return ForgotPasswordResponse(
        message="If an account matches that username or email, a password reset link has been dispatched to your email."
    )


# ============================================================
# VERIFY RESET TOKEN
# ============================================================

@router.get(
    "/verify-reset-token",
    response_model=VerifyResetTokenResponse,
)
@limiter.limit("20/minute")
async def verify_reset_token(
    request: Request,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await forget_password_service.verify_reset_token(db, token)
        return VerifyResetTokenResponse(
            valid=result["valid"],
            email_masked=result.get("email_masked"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# RESET PASSWORD
# ============================================================

@router.post(
    "/reset-password",
    response_model=ForgotPasswordResponse,
)
@limiter.limit("10/minute")
async def reset_password(
    request: Request,
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        await forget_password_service.reset_password(
            db=db,
            token=data.token,
            identifier=data.identifier,
            new_password=data.new_password,
            confirm_password=data.confirm_password,
        )
        return ForgotPasswordResponse(
            message="Your password has been successfully updated. Please log in with your new password."
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
