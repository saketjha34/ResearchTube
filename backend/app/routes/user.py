from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.db.models.user import User
from app.services.auth_service import get_current_user
from app.services.user_service import get_user_stats
from app.schema.user_stats import UserStatsResponse

router = APIRouter(
    prefix="/user",
    tags=["User Settings / Stats"]
)

@router.get(
    "/stats",
    response_model=UserStatsResponse,
    summary="Get user research activity statistics"
)
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Aggregate and return 15 detailed research statistics for the authenticated user.
    """
    return await get_user_stats(db, current_user.id)
