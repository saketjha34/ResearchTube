"""
YouTube Research Routes.

All endpoints under /youtube are protected — the user
must be authenticated via Bearer JWT.

Endpoints:

    POST /youtube/research
        Run the full 3-agent research pipeline.

    GET /youtube/history
        Get the authenticated user's research history.

    GET /youtube/history/{run_id}
        Get full details of a single research run.
"""

from __future__ import annotations

from uuid import UUID
from pydantic import BaseModel

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models.user import User
from app.db.models.youtube import ResearchRun

from app.schema.youtube import (
    ResearchAPIRequest,
    ResearchAPIResponse,
)

from app.schema.history import (
    HistoryListResponse,
    HistoryEntry,
)

from app.graph.youtube_graph import create_research_graph

from app.graph.persistence import (
    create_research_run,
    update_research_run_status,
)

from app.services.auth_service import get_current_user
from app.services.history_service import (
    get_user_history,
    _build_entry,
)


class RenameHistoryRequest(BaseModel):
    query: str


router = APIRouter(
    prefix="/youtube",
    tags=["YouTube Research"],
)


# ============================================================
# POST /youtube/research  — PROTECTED
# ============================================================

@router.post(
    "/research",
    response_model=ResearchAPIResponse,
)
async def research_youtube(
    request: ResearchAPIRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Run the full ResearchTube pipeline for the authenticated user.

    - Agent 1: YouTube search + transcript collection
    - Agent 2: RAG analysis + ranking (pgvector)
    - Agent 3: Final report generation
    """

    # ========================================================
    # CREATE RESEARCH RUN (linked to the logged-in user)
    # ========================================================

    try:

        run = await create_research_run(
            session=session,
            user_query=request.query,
            video_count=request.video_count,
            user_id=current_user.id,
        )

        await session.commit()

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=f"Failed to create research run: {exc}",
        )

    run_id_str = str(run.id)

    # ========================================================
    # RUN LANGGRAPH PIPELINE
    # ========================================================

    try:

        graph = create_research_graph(session)

        result = await graph.ainvoke(
            {
                "user_query": request.query,
                "video_count": request.video_count,
                "research_run_id": run_id_str,
            }
        )

    except Exception as exc:

        print()
        print("=" * 70)
        print("RESEARCH PIPELINE FAILED")
        print("=" * 70)
        print(type(exc).__name__)
        print(str(exc))

        try:
            await update_research_run_status(
                session=session,
                run_id=run.id,
                status="failed",
                error=str(exc),
            )
            await session.commit()
        except Exception:
            pass

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    # ========================================================
    # RETURN
    # ========================================================

    return ResearchAPIResponse(
        success=True,
        report=result["final_report"],
        research_result=result["research_result"],
        analysis=result["analysis"],
    )


# ============================================================
# GET /youtube/history  — PROTECTED
# ============================================================

@router.get(
    "/history",
    response_model=HistoryListResponse,
)
async def get_history(
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

    return await get_user_history(
        session=session,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
    )


# ============================================================
# GET /youtube/history/{run_id}  — PROTECTED
# ============================================================

@router.get(
    "/history/{run_id}",
    response_model=HistoryEntry,
)
async def get_history_entry(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Return the full details of a single research run.

    Returns 404 if the run does not exist or does not
    belong to the authenticated user.
    """

    result = await session.execute(
        select(ResearchRun).where(
            ResearchRun.id == run_id,
            ResearchRun.user_id == current_user.id,
        )
    )
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(
            status_code=404,
            detail="Research run not found.",
        )

    return await _build_entry(
        session=session,
        run=run,
    )


# ============================================================
# DELETE /youtube/history/{run_id}  — PROTECTED
# ============================================================

@router.delete(
    "/history/{run_id}",
)
async def delete_history_entry(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Delete a single research run history entry.

    Returns 404 if the run does not exist or does not
    belong to the authenticated user.
    """

    result = await session.execute(
        select(ResearchRun).where(
            ResearchRun.id == run_id,
            ResearchRun.user_id == current_user.id,
        )
    )
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(
            status_code=404,
            detail="Research run not found.",
        )

    try:
        await session.delete(run)
        await session.commit()
    except Exception as exc:
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete research run: {exc}",
        )

    return {
        "success": True,
        "message": "Research run deleted successfully.",
    }


# ============================================================
# PATCH /youtube/history/{run_id}/rename  — PROTECTED
# ============================================================

@router.patch(
    "/history/{run_id}/rename",
)
async def rename_history_entry(
    run_id: UUID,
    request: RenameHistoryRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Rename a single research run history entry.

    Returns 404 if the run does not exist or does not
    belong to the authenticated user.
    """

    result = await session.execute(
        select(ResearchRun).where(
            ResearchRun.id == run_id,
            ResearchRun.user_id == current_user.id,
        )
    )
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(
            status_code=404,
            detail="Research run not found.",
        )

    try:
        run.user_query = request.query
        await session.commit()
    except Exception as exc:
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to rename research run: {exc}",
        )

    return {
        "success": True,
        "message": "Research run renamed successfully.",
    }



