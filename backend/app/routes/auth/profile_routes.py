"""
Profile routes — current user read/update and password change.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.db.database import get_db
from app.db.models import User
from app.schema.auth import (
    UserResponse,
    UpdateProfileRequest,
    ChangePasswordRequest,
)
from app.services.auth.security_deps import get_current_user
from app.services.auth.profile_service import profile_service


router = APIRouter()


# ============================================================
# GET CURRENT USER
# ============================================================

@router.get(
    "/me",
    response_model=UserResponse,
)
@limiter.limit("60/minute")        # read-only, generous
async def get_profile(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    return UserResponse.model_validate(current_user)


# ============================================================
# UPDATE PROFILE
# ============================================================

@router.patch(
    "/me",
    response_model=UserResponse,
)
@limiter.limit("10/minute")        # profile update
async def update_profile(
    request: Request,
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        updated_user = await profile_service.update_user_profile(
            db=db,
            user=current_user,
            full_name=data.full_name,
            username=data.username,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return UserResponse.model_validate(updated_user)


# ============================================================
# CHANGE PASSWORD
# ============================================================

@router.post("/change-password")
@limiter.limit("5/minute")         # sensitive — very strict
async def change_password(
    request: Request,
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.current_password == data.new_password:
        raise HTTPException(
            status_code=400,
            detail="New password must be different from the current password.",
        )

    try:
        await profile_service.change_password(
            db=db,
            user=current_user,
            current_password=data.current_password,
            new_password=data.new_password,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"message": "Password updated successfully."}
