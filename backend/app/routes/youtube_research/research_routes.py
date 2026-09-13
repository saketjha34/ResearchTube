"""
YouTube Research Routes — Pipeline execution & shared run endpoints.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    Request,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.db.database import get_db
from app.db.models.user import User
from app.schema.youtube import (
    ResearchAPIRequest,
    ResearchAPIResponse,
)
from app.schema.history import HistoryEntry
from app.services.auth.security_deps import get_current_user
from app.services.youtube_research import youtube_research_service

router = APIRouter()


# ============================================================
# POST /youtube/research — PROTECTED
# ============================================================

@router.post(
    "/research",
    response_model=ResearchAPIResponse,
)
@limiter.limit("5/minute")          # expensive pipeline — strict cap
async def research_youtube(
    request: Request,
    payload: ResearchAPIRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Run the full ResearchTube pipeline for the authenticated user.

    - Agent 1: YouTube search + transcript collection
    - Agent 2: RAG analysis + ranking (pgvector)
    - Agent 3: Final report generation
    """
    return await youtube_research_service.run_pipeline(
        session=session,
        current_user=current_user,
        payload=payload,
    )


# ============================================================
# GET /youtube/shared/{run_id} — PUBLIC
# ============================================================

@router.get(
    "/shared/{run_id}",
    response_model=HistoryEntry,
)
@limiter.limit("30/minute")          # public endpoint — IP-based
async def get_shared_history_entry(
    request: Request,
    run_id: UUID,
    session: AsyncSession = Depends(get_db),
):
    """
    Return the full details of a public research run.
    """
    return await youtube_research_service.get_shared_history_entry(
        session=session,
        run_id=run_id,
    )
