"""
LangGraph Node Definitions for the ResearchTube Execution Pipeline.

==============================================================================
WHAT THIS MODULE DOES:
==============================================================================
Implements the 7 stateful execution nodes that form the linear LangGraph DAG.
Each node receives the current `ResearchState`, performs agent computation or
database persistence, updates research run status, and returns a state delta.

==============================================================================
THE 7 PIPELINE NODES:
==============================================================================
1. `youtube_research_node`:
   - Agent 1 execution (planning, YouTube API search, transcript fetching).
   - Updates run status to "researching".
2. `persist_research_node`:
   - Upserts discovered videos to PostgreSQL and maps YouTube IDs to DB UUIDs.
3. `ingest_transcripts_node`:
   - Chunks transcripts using LangChain and embeds vectors into pgvector.
   - Updates run status to "ingesting".
4. `context_analysis_node`:
   - Agent 2 execution (pgvector RAG similarity search, depth evaluation, ranking).
   - Updates run status to "analyzing".
5. `persist_analysis_node`:
   - Persists evaluation scores and ranking summary to PostgreSQL.
6. `final_report_node`:
   - Agent 3 execution (pedagogical synthesis, learning path, markdown report).
   - Updates run status to "reporting".
7. `persist_final_report_node`:
   - Persists final report and marks run status as "completed".

==============================================================================
OOP DESIGN:
==============================================================================
Encapsulated inside the `YouTubeGraphNodes` class. Injects dependencies (database
session, persistence manager) via the constructor rather than relying on global state.
==============================================================================
"""

from __future__ import annotations

from typing import Any, Callable
from uuid import UUID

# pyrefly: ignore [missing-import]
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.youtube import (
    youtube_research_agent,
    context_analysis_agent,
    final_report_agent,
)
from app.graph.youtube.state import ResearchState
from app.graph.youtube.persistence import (
    YouTubeGraphPersistence,
    youtube_graph_persistence,
)
from app.core.config import settings
from app.rag.youtube import ingest_transcripts

_logger = structlog.get_logger("graph_nodes")


class YouTubeGraphNodes:
    """
    Encapsulates all 7 execution nodes for the YouTube research LangGraph pipeline,
    binding the database session and persistence service into each node's execution context.
    """

    def __init__(
        self,
        session: AsyncSession,
        persistence: YouTubeGraphPersistence | None = None,
    ) -> None:
        self.session = session
        self.persistence = persistence or youtube_graph_persistence

    # ========================================================
    # NODE 1 — AGENT 1: YOUTUBE RESEARCH
    # ========================================================

    async def youtube_research_node(self, state: ResearchState) -> dict[str, Any]:
        """
        Execute Agent 1: plans search strategy and collects YouTube videos and transcripts.
        """
        run_id = UUID(state["research_run_id"])
        log = _logger.bind(node=1, run_id=str(run_id))
        log.info("node.started", name="youtube_research", primary_model=settings.OPENAI_MODEL, fallback_model=settings.GEMINI_MODEL)
        print(f"\n{'='*60}\n>>> [Node 1] YouTube Research & Planning (Primary: OpenAI {settings.OPENAI_MODEL}, Fallback: Gemini {settings.GEMINI_MODEL})\n{'='*60}")

        user_query = state["user_query"]
        video_count = state.get("video_count", 3)

        await self.persistence.update_research_run_status(
            session=self.session,
            run_id=run_id,
            status="researching",
        )

        try:
            research_result = await youtube_research_agent(
                user_query=user_query,
                num_videos=video_count,
            )
        except Exception as exc:
            log.error("node.failed", exc_type=type(exc).__name__, exc_msg=str(exc))
            await self.persistence.update_research_run_status(
                session=self.session,
                run_id=run_id,
                status="failed",
                error=str(exc),
            )
            await self.session.commit()
            raise

        log.info("node.completed", name="youtube_research")
        return {"research_result": research_result}

    # ========================================================
    # NODE 2 — PERSIST RESEARCH RESULTS
    # ========================================================

    async def persist_research_node(self, state: ResearchState) -> dict[str, Any]:
        """
        Persist collected videos to PostgreSQL and build string→UUID mapping.
        """
        run_id = UUID(state["research_run_id"])
        log = _logger.bind(node=2, run_id=str(run_id))
        log.info("node.started", name="persist_research")

        research_result = state["research_result"]

        try:
            video_id_map = await self.persistence.persist_videos(
                session=self.session,
                research_run_id=run_id,
                videos=research_result.videos,
            )
            await self.session.commit()
        except Exception as exc:
            log.error("node.failed", exc_type=type(exc).__name__, exc_msg=str(exc))
            await self.persistence.update_research_run_status(
                session=self.session,
                run_id=run_id,
                status="failed",
                error=str(exc),
            )
            await self.session.commit()
            raise

        # Convert UUID objects to strings for TypedDict state channel
        str_map = {vid: str(uuid_val) for vid, uuid_val in video_id_map.items()}

        log.info("node.completed", name="persist_research")
        return {"video_id_map": str_map}

    # ========================================================
    # NODE 3 — INGEST TRANSCRIPTS (RAG / pgvector)
    # ========================================================

    async def ingest_transcripts_node(self, state: ResearchState) -> dict[str, Any]:
        """
        Chunk and embed video transcripts into pgvector for downstream RAG.
        """
        run_id = UUID(state["research_run_id"])
        log = _logger.bind(node=3, run_id=str(run_id))
        log.info("node.started", name="ingest_transcripts", primary_embedding=settings.OPENAI_EMBEDDING_MODEL, fallback_embedding=settings.EMBEDDING_MODEL)
        print(f"\n{'='*60}\n>>> [Node 3] Ingesting Transcripts & Generating Embeddings (Primary: OpenAI {settings.OPENAI_EMBEDDING_MODEL} [768-dim], Fallback: Gemini {settings.EMBEDDING_MODEL})\n{'='*60}")

        await self.persistence.update_research_run_status(
            session=self.session,
            run_id=run_id,
            status="ingesting",
        )

        research_result = state["research_result"]
        str_map = state["video_id_map"]
        video_id_map = {vid: UUID(uid) for vid, uid in str_map.items()}

        try:
            await ingest_transcripts(
                session=self.session,
                research_run_id=run_id,
                videos=research_result.videos,
                video_id_map=video_id_map,
            )
            await self.session.commit()
        except Exception as exc:
            log.error("node.failed", exc_type=type(exc).__name__, exc_msg=str(exc))
            await self.persistence.update_research_run_status(
                session=self.session,
                run_id=run_id,
                status="failed",
                error=str(exc),
            )
            await self.session.commit()
            raise

        log.info("node.completed", name="ingest_transcripts")
        return {}

    # ========================================================
    # NODE 4 — AGENT 2: CONTEXT ANALYSIS & RANKING
    # ========================================================

    async def context_analysis_node(self, state: ResearchState) -> dict[str, Any]:
        """
        Execute Agent 2: RAG evaluation, depth scoring, and comparative ranking.
        """
        run_id = UUID(state["research_run_id"])
        log = _logger.bind(node=4, run_id=str(run_id))
        log.info("node.started", name="context_analysis", primary_model=settings.OPENAI_MODEL, fallback_model=settings.GEMINI_MODEL)
        print(f"\n{'='*60}\n>>> [Node 4] Context Analysis & Ranking (Primary: OpenAI {settings.OPENAI_MODEL}, Fallback: Gemini {settings.GEMINI_MODEL})\n{'='*60}")

        await self.persistence.update_research_run_status(
            session=self.session,
            run_id=run_id,
            status="analyzing",
        )

        user_query = state["user_query"]
        research_result = state["research_result"]
        str_map = state["video_id_map"]
        video_id_map = {vid: UUID(uid) for vid, uid in str_map.items()}

        try:
            analysis = await context_analysis_agent(
                session=self.session,
                user_query=user_query,
                research_result=research_result,
                video_id_map=video_id_map,
                research_run_id=run_id,
            )
        except Exception as exc:
            log.error("node.failed", exc_type=type(exc).__name__, exc_msg=str(exc))
            await self.persistence.update_research_run_status(
                session=self.session,
                run_id=run_id,
                status="failed",
                error=str(exc),
            )
            await self.session.commit()
            raise

        log.info("node.completed", name="context_analysis")
        return {"analysis": analysis}

    # ========================================================
    # NODE 5 — PERSIST ANALYSIS
    # ========================================================

    async def persist_analysis_node(self, state: ResearchState) -> dict[str, Any]:
        """
        Persist evaluations and ranking summary to PostgreSQL.
        """
        run_id = UUID(state["research_run_id"])
        log = _logger.bind(node=5, run_id=str(run_id))
        log.info("node.started", name="persist_analysis")

        analysis = state["analysis"]
        str_map = state["video_id_map"]
        video_id_map = {vid: UUID(uid) for vid, uid in str_map.items()}

        try:
            await self.persistence.persist_analysis(
                session=self.session,
                research_run_id=run_id,
                analysis=analysis,
                video_id_map=video_id_map,
            )
            await self.session.commit()
        except Exception as exc:
            log.error("node.failed", exc_type=type(exc).__name__, exc_msg=str(exc))
            await self.persistence.update_research_run_status(
                session=self.session,
                run_id=run_id,
                status="failed",
                error=str(exc),
            )
            await self.session.commit()
            raise

        log.info("node.completed", name="persist_analysis")
        return {}

    # ========================================================
    # NODE 6 — AGENT 3: FINAL REPORT
    # ========================================================

    async def final_report_node(self, state: ResearchState) -> dict[str, Any]:
        """
        Execute Agent 3: synthesize research results and evaluations into a final pedagogical report.
        """
        run_id = UUID(state["research_run_id"])
        log = _logger.bind(node=6, run_id=str(run_id))
        log.info("node.started", name="final_report", primary_model=settings.OPENAI_MODEL, fallback_model=settings.GEMINI_MODEL)
        print(f"\n{'='*60}\n>>> [Node 6] Final Pedagogical Report Synthesis (Primary: OpenAI {settings.OPENAI_MODEL}, Fallback: Gemini {settings.GEMINI_MODEL})\n{'='*60}")

        await self.persistence.update_research_run_status(
            session=self.session,
            run_id=run_id,
            status="reporting",
        )

        user_query = state["user_query"]
        research_result = state["research_result"]
        analysis = state["analysis"]

        try:
            final_report = await final_report_agent(
                user_query=user_query,
                research_result=research_result,
                analysis=analysis,
            )
        except Exception as exc:
            log.error("node.failed", exc_type=type(exc).__name__, exc_msg=str(exc))
            await self.persistence.update_research_run_status(
                session=self.session,
                run_id=run_id,
                status="failed",
                error=str(exc),
            )
            await self.session.commit()
            raise

        log.info("node.completed", name="final_report")
        return {"final_report": final_report}

    # ========================================================
    # NODE 7 — PERSIST FINAL REPORT & COMPLETE RUN
    # ========================================================

    async def persist_final_report_node(self, state: ResearchState) -> dict[str, Any]:
        """
        Persist the synthesized FinalReport and mark the ResearchRun as completed.
        """
        run_id = UUID(state["research_run_id"])
        log = _logger.bind(node=7, run_id=str(run_id))
        log.info("node.started", name="persist_final_report")

        final_report = state["final_report"]

        try:
            await self.persistence.persist_final_report(
                session=self.session,
                research_run_id=run_id,
                report=final_report,
            )

            await self.persistence.update_research_run_status(
                session=self.session,
                run_id=run_id,
                status="completed",
            )
            await self.session.commit()
        except Exception as exc:
            log.error("node.failed", exc_type=type(exc).__name__, exc_msg=str(exc))
            await self.persistence.update_research_run_status(
                session=self.session,
                run_id=run_id,
                status="failed",
                error=str(exc),
            )
            await self.session.commit()
            raise

        log.info("node.completed", name="persist_final_report")
        return {}

    def as_dict(self) -> dict[str, Callable[[ResearchState], Any]]:
        """
        Return a dictionary mapping LangGraph node names to their bound async callable methods.
        """
        return {
            "youtube_research": self.youtube_research_node,
            "persist_research": self.persist_research_node,
            "ingest_transcripts": self.ingest_transcripts_node,
            "context_analysis": self.context_analysis_node,
            "persist_analysis": self.persist_analysis_node,
            "final_report": self.final_report_node,
            "persist_final_report": self.persist_final_report_node,
        }


def make_nodes(session: AsyncSession) -> dict[str, Callable[[ResearchState], Any]]:
    """
    Factory function returning a node dictionary with the session injected into YouTubeGraphNodes.
    """
    return YouTubeGraphNodes(session=session).as_dict()


__all__ = [
    "YouTubeGraphNodes",
    "make_nodes",
]
