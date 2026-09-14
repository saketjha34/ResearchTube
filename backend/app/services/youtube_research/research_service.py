"""
YoutubeResearchService - Singleton service for executing the 3-agent YouTube
research pipeline and managing the lifecycle of research runs.
"""

from __future__ import annotations

from uuid import UUID
from typing import Any

# pyrefly: ignore [missing-import]
import structlog
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from app.db.models.youtube import ResearchRun
from app.schema.youtube import (
    ResearchAPIRequest,
    ResearchAPIResponse,
)
from app.schema.history import (
    HistoryEntry,
    HistoryListResponse,
)
from app.graph.youtube import (
    create_research_graph,
    create_research_run,
    update_research_run_status,
)
from app.services.youtube_research.history_service import history_service



_logger = structlog.get_logger("youtube_research_service")


class YoutubeResearchService:
    """
    Singleton service managing YouTube research execution pipeline
    and research run lifecycle (queries, renames, shares, deletions).

    Usage:
        from app.services.youtube_research import youtube_research_service
        result = await youtube_research_service.run_pipeline(session, user, payload)
    """

    _instance: YoutubeResearchService | None = None

    def __new__(cls) -> YoutubeResearchService:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    # ========================================================
    # 1. RUN RESEARCH PIPELINE
    # ========================================================

    async def run_pipeline(
        self,
        session: AsyncSession,
        current_user: User,
        payload: ResearchAPIRequest,
    ) -> ResearchAPIResponse:
        """
        Run the full 3-agent ResearchTube pipeline for the authenticated user.

        - Agent 1: YouTube search + transcript collection
        - Agent 2: RAG analysis + ranking (pgvector)
        - Agent 3: Final report generation
        """

        # ----------------------------------------------------
        # CREATE RESEARCH RUN
        # ----------------------------------------------------
        try:
            run = await create_research_run(
                session=session,
                user_query=payload.query,
                video_count=payload.video_count,
                user_id=current_user.id,
            )
            await session.commit()
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create research run: {exc}",
            )

        run_id_str = str(run.id)

        # ----------------------------------------------------
        # RUN LANGGRAPH PIPELINE
        # ----------------------------------------------------
        try:
            graph = create_research_graph(session)
            result = await graph.ainvoke(
                {
                    "user_query": payload.query,
                    "video_count": payload.video_count,
                    "research_run_id": run_id_str,
                }
            )
        except Exception as exc:
            _logger.error(
                "pipeline.failed",
                run_id=run_id_str,
                user_id=str(current_user.id),
                exc_type=type(exc).__name__,
                exc_msg=str(exc),
            )

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

        # ----------------------------------------------------
        # RETURN STRUCTURED RESPONSE
        # ----------------------------------------------------
        return ResearchAPIResponse(
            success=True,
            report=result["final_report"],
            research_result=result["research_result"],
            analysis=result["analysis"],
        )

    # ========================================================
    # 2. GET SINGLE HISTORY ENTRY
    # ========================================================

    async def get_history_entry(
        self,
        session: AsyncSession,
        run_id: UUID,
        current_user: User,
    ) -> HistoryEntry:
        """
        Return full details of a single research run belonging to the user.
        Raises 404 if not found.
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

        return await history_service.build_entry(
            session=session,
            run=run,
        )

    # ========================================================
    # 3. DELETE HISTORY ENTRY
    # ========================================================

    async def delete_history_entry(
        self,
        session: AsyncSession,
        run_id: UUID,
        current_user: User,
    ) -> dict[str, Any]:
        """
        Delete a single research run history entry belonging to the user.
        Raises 404 if not found.
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

    # ========================================================
    # 4. RENAME HISTORY ENTRY
    # ========================================================

    async def rename_history_entry(
        self,
        session: AsyncSession,
        run_id: UUID,
        current_user: User,
        new_query: str,
    ) -> dict[str, Any]:
        """
        Rename a single research run query for the authenticated user.
        Raises 404 if not found.
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
            run.user_query = new_query
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

    # ========================================================
    # 5. SHARE HISTORY ENTRY (Toggle public)
    # ========================================================

    async def share_history_entry(
        self,
        session: AsyncSession,
        run_id: UUID,
        current_user: User,
    ) -> dict[str, Any]:
        """
        Set is_public=True on a research run belonging to the user.
        Raises 404 if not found.
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
            run.is_public = True
            await session.commit()
        except Exception as exc:
            await session.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to share research run: {exc}",
            )

        return {
            "success": True,
            "message": "Research run is now public.",
            "is_public": True,
        }

    # ========================================================
    # 6. GET SHARED (PUBLIC) HISTORY ENTRY
    # ========================================================

    async def get_shared_history_entry(
        self,
        session: AsyncSession,
        run_id: UUID,
    ) -> HistoryEntry:
        """
        Return the full details of a public research run.
        Raises 404 if not found or not marked public.
        """
        result = await session.execute(
            select(ResearchRun).where(
                ResearchRun.id == run_id,
                ResearchRun.is_public == True,
            )
        )
        run = result.scalar_one_or_none()

        if run is None:
            raise HTTPException(
                status_code=404,
                detail="Research run not found or not public.",
            )

        return await history_service.build_entry(session=session, run=run)

    # ========================================================
    # 7. GET USER HISTORY (PAGINATED)
    # ========================================================

    async def get_user_history(
        self,
        session: AsyncSession,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> HistoryListResponse:
        """
        Return paginated history entries for user, newest first.
        Delegates to history_service.
        """
        return await history_service.get_user_history(
            session=session,
            user_id=user_id,
            page=page,
            page_size=page_size,
        )


# Singleton instance
youtube_research_service = YoutubeResearchService()
