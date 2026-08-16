"""
LangGraph Node definitions for the ResearchTube pipeline.

The 7 nodes are:

    1. youtube_research_node     — Agent 1
    2. persist_research_node     — save videos to DB
    3. ingest_transcripts_node   — chunk + embed + pgvector
    4. context_analysis_node     — Agent 2 (RAG + ranking)
    5. persist_analysis_node     — save evaluations to DB
    6. final_report_node         — Agent 3
    7. persist_final_report_node — save report + mark COMPLETED

The session is injected via closure in research_graph.py.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.youtube_research_agent import (
    youtube_research_agent,
)

from app.agents.context_analysis_agent import (
    context_analysis_agent,
)

from app.agents.final_report_agent import (
    final_report_agent,
)

from app.graph.state import ResearchState

from app.graph.persistence import (
    update_research_run_status,
    persist_videos,
    persist_analysis,
    persist_final_report,
)

from app.rag.ingestor import ingest_transcripts


def make_nodes(session: AsyncSession):
    """
    Factory that returns all node functions with the
    database session captured in their closure.

    LangGraph nodes must have the signature:
        async def node(state: ResearchState) -> dict

    Extra dependencies (session) are injected here.
    """

    # ========================================================
    # NODE 1 — AGENT 1: YouTube Research
    # ========================================================

    async def youtube_research_node(
        state: ResearchState,
    ) -> dict:

        print()
        print("=" * 70)
        print("NODE 1 — YOUTUBE RESEARCH (Agent 1)")
        print("=" * 70)

        user_query = state["user_query"]
        video_count = state.get("video_count", 3)
        run_id = UUID(state["research_run_id"])

        await update_research_run_status(
            session=session,
            run_id=run_id,
            status="researching",
        )

        try:

            research_result = await youtube_research_agent(
                user_query=user_query,
                num_videos=video_count,
            )

        except Exception as exc:

            print(f"[Node 1] Agent 1 failed: {exc}")

            await update_research_run_status(
                session=session,
                run_id=run_id,
                status="failed",
                error=str(exc),
            )

            await session.commit()

            raise

        return {
            "research_result": research_result,
        }

    # ========================================================
    # NODE 2 — PERSIST RESEARCH RESULTS
    # ========================================================

    async def persist_research_node(
        state: ResearchState,
    ) -> dict:

        print()
        print("=" * 70)
        print("NODE 2 — PERSIST RESEARCH RESULTS")
        print("=" * 70)

        run_id = UUID(state["research_run_id"])
        research_result = state["research_result"]

        try:

            video_id_map = await persist_videos(
                session=session,
                research_run_id=run_id,
                videos=research_result.videos,
            )

            await session.commit()

        except Exception as exc:

            print(f"[Node 2] Persist failed: {exc}")

            await update_research_run_status(
                session=session,
                run_id=run_id,
                status="failed",
                error=str(exc),
            )

            await session.commit()

            raise

        # Convert UUID values to strings for the state
        # (TypedDict requires serialisable types)
        video_id_map_str = {
            yt_id: str(db_uuid)
            for yt_id, db_uuid in video_id_map.items()
        }

        return {
            "video_id_map": video_id_map_str,
        }

    # ========================================================
    # NODE 3 — INGEST TRANSCRIPTS (chunk + embed + pgvector)
    # ========================================================

    async def ingest_transcripts_node(
        state: ResearchState,
    ) -> dict:

        print()
        print("=" * 70)
        print("NODE 3 — INGEST TRANSCRIPTS (RAG)")
        print("=" * 70)

        run_id = UUID(state["research_run_id"])
        research_result = state["research_result"]
        video_id_map_str = state.get("video_id_map", {})

        await update_research_run_status(
            session=session,
            run_id=run_id,
            status="ingesting",
        )

        # Convert str UUIDs back to UUID objects
        video_id_map = {
            yt_id: UUID(db_uuid_str)
            for yt_id, db_uuid_str in video_id_map_str.items()
        }

        try:

            await ingest_transcripts(
                session=session,
                research_run_id=run_id,
                videos=research_result.videos,
                video_id_map=video_id_map,
            )

            await session.commit()

        except Exception as exc:

            print(f"[Node 3] Ingestion failed: {exc}")

            await update_research_run_status(
                session=session,
                run_id=run_id,
                status="failed",
                error=str(exc),
            )

            await session.commit()

            raise

        return {}

    # ========================================================
    # NODE 4 — AGENT 2: RAG + Context Analysis + Ranking
    # ========================================================

    async def context_analysis_node(
        state: ResearchState,
    ) -> dict:

        print()
        print("=" * 70)
        print("NODE 4 — RAG + ANALYSIS (Agent 2)")
        print("=" * 70)

        run_id = UUID(state["research_run_id"])
        video_id_map_str = state.get("video_id_map", {})

        await update_research_run_status(
            session=session,
            run_id=run_id,
            status="analyzing",
        )

        # Convert str UUIDs back to UUID objects
        video_id_map = {
            yt_id: UUID(db_uuid_str)
            for yt_id, db_uuid_str in video_id_map_str.items()
        }

        try:

            analysis = await context_analysis_agent(
                session=session,
                user_query=state["user_query"],
                research_result=state["research_result"],
                video_id_map=video_id_map,
                research_run_id=run_id,
            )

        except Exception as exc:

            print(f"[Node 4] Agent 2 failed: {exc}")

            await update_research_run_status(
                session=session,
                run_id=run_id,
                status="failed",
                error=str(exc),
            )

            await session.commit()

            raise

        return {
            "analysis": analysis,
        }

    # ========================================================
    # NODE 5 — PERSIST ANALYSIS
    # ========================================================

    async def persist_analysis_node(
        state: ResearchState,
    ) -> dict:

        print()
        print("=" * 70)
        print("NODE 5 — PERSIST ANALYSIS")
        print("=" * 70)

        run_id = UUID(state["research_run_id"])
        video_id_map_str = state.get("video_id_map", {})
        analysis = state["analysis"]

        video_id_map = {
            yt_id: UUID(db_uuid_str)
            for yt_id, db_uuid_str in video_id_map_str.items()
        }

        try:

            await persist_analysis(
                session=session,
                research_run_id=run_id,
                analysis=analysis,
                video_id_map=video_id_map,
            )

            await session.commit()

        except Exception as exc:

            print(f"[Node 5] Persist analysis failed: {exc}")

            await update_research_run_status(
                session=session,
                run_id=run_id,
                status="failed",
                error=str(exc),
            )

            await session.commit()

            raise

        return {}

    # ========================================================
    # NODE 6 — AGENT 3: Final Report
    # ========================================================

    async def final_report_node(
        state: ResearchState,
    ) -> dict:

        print()
        print("=" * 70)
        print("NODE 6 — FINAL REPORT (Agent 3)")
        print("=" * 70)

        run_id = UUID(state["research_run_id"])

        await update_research_run_status(
            session=session,
            run_id=run_id,
            status="reporting",
        )

        try:

            final_report = await final_report_agent(
                user_query=state["user_query"],
                research_result=state["research_result"],
                analysis=state["analysis"],
            )

        except Exception as exc:

            print(f"[Node 6] Agent 3 failed: {exc}")

            await update_research_run_status(
                session=session,
                run_id=run_id,
                status="failed",
                error=str(exc),
            )

            await session.commit()

            raise

        return {
            "final_report": final_report,
        }

    # ========================================================
    # NODE 7 — PERSIST FINAL REPORT + COMPLETE
    # ========================================================

    async def persist_final_report_node(
        state: ResearchState,
    ) -> dict:

        print()
        print("=" * 70)
        print("NODE 7 — PERSIST FINAL REPORT")
        print("=" * 70)

        run_id = UUID(state["research_run_id"])
        final_report = state["final_report"]

        try:

            await persist_final_report(
                session=session,
                research_run_id=run_id,
                report=final_report,
            )

            await update_research_run_status(
                session=session,
                run_id=run_id,
                status="completed",
            )

            await session.commit()

        except Exception as exc:

            print(f"[Node 7] Persist report failed: {exc}")

            await update_research_run_status(
                session=session,
                run_id=run_id,
                status="failed",
                error=str(exc),
            )

            await session.commit()

            raise

        return {}

    # ========================================================
    # RETURN ALL NODES
    # ========================================================

    return {
        "youtube_research": youtube_research_node,
        "persist_research": persist_research_node,
        "ingest_transcripts": ingest_transcripts_node,
        "context_analysis": context_analysis_node,
        "persist_analysis": persist_analysis_node,
        "final_report": final_report_node,
        "persist_final_report": persist_final_report_node,
    }