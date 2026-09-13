"""
YouTube History Routes — Research run history querying, renaming, sharing, and deletion.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    Query,
    Request,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.db.database import get_db
from app.db.models.user import User
from app.schema.youtube import RenameHistoryRequest
from app.schema.history import (
    HistoryListResponse,
    HistoryEntry,
)
from app.services.auth.security_deps import get_current_user
from app.services.youtube_research import youtube_research_service

router = APIRouter()


# ============================================================
# GET /youtube/history — PROTECTED
# ============================================================

@router.get(
    "/history",
    response_model=HistoryListResponse,
)
@limiter.limit("60/minute")          # read-only list
async def get_history(
    request: Request,
    page: int = Query(default=1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Results per page",
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Return the authenticated user's research history,
    newest first.

    Each item corresponds to one research session and
    includes the query, status, videos (with scores),
    and report summary.
    """
    return await youtube_research_service.get_user_history(
        session=session,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
    )


# ============================================================
# GET /youtube/history/{run_id} — PROTECTED
# ============================================================

@router.get(
    "/history/{run_id}",
    response_model=HistoryEntry,
)
@limiter.limit("60/minute")          # read-only single entry
async def get_history_entry(
    request: Request,
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Return the full details of a single research run.

    Returns 404 if the run does not exist or does not
    belong to the authenticated user.
    """
    return await youtube_research_service.get_history_entry(
        session=session,
        run_id=run_id,
        current_user=current_user,
    )


# ============================================================
# DELETE /youtube/history/{run_id} — PROTECTED
# ============================================================

@router.delete(
    "/history/{run_id}",
)
@limiter.limit("20/minute")          # delete operations
async def delete_history_entry(
    request: Request,
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Delete a single research run history entry.

    Returns 404 if the run does not exist or does not
    belong to the authenticated user.
    """
    return await youtube_research_service.delete_history_entry(
        session=session,
        run_id=run_id,
        current_user=current_user,
    )


# ============================================================
# PATCH /youtube/history/{run_id}/rename — PROTECTED
# ============================================================

@router.patch(
    "/history/{run_id}/rename",
)
@limiter.limit("20/minute")          # rename operations
async def rename_history_entry(
    request: Request,
    run_id: UUID,
    rename_request: RenameHistoryRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Rename a single research run history entry.

    Returns 404 if the run does not exist or does not
    belong to the authenticated user.
    """
    return await youtube_research_service.rename_history_entry(
        session=session,
        run_id=run_id,
        current_user=current_user,
        new_query=rename_request.query,
    )


# ============================================================
# PATCH /youtube/history/{run_id}/share — PROTECTED
# ============================================================

@router.patch(
    "/history/{run_id}/share",
    response_model=dict,
)
@limiter.limit("10/minute")          # share toggle
async def share_history_entry(
    request: Request,
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Toggle the is_public status of a research run.
    """
    return await youtube_research_service.share_history_entry(
        session=session,
        run_id=run_id,
        current_user=current_user,
    )
