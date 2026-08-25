from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.db.models.user import User
from app.services.auth_service import get_current_user
from app.services.user_service import get_user_stats
from app.schema.user_stats import UserStatsResponse
from app.core.limiter import limiter

router = APIRouter(
    prefix="/user",
    tags=["User Settings / Stats"]
)

@router.get(
    "/stats",
    response_model=UserStatsResponse,
    summary="Get user research activity statistics"
)
@limiter.limit("30/minute")          # aggregation query — moderate limit
async def get_stats(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Aggregate and return 15 detailed research statistics for the authenticated user.
    """
    return await get_user_stats(db, current_user.id)


@router.delete(
    "/account",
    status_code=204,
    summary="Permanently delete user account"
)
@limiter.limit("3/hour")             # dangerous action — very strict
async def delete_account(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Permanently delete the current authenticated user's account and all associated data.
    """
    await db.delete(current_user)
    await db.commit()
    return None