"""
Persistence Layer for the LangGraph YouTube Research Pipeline.

==============================================================================
WHAT THIS MODULE DOES:
==============================================================================
Encapsulates all database persistence operations required during the execution
of the YouTube research graph. Manages research run lifecycle state transitions,
video metadata upserts, association linking, evaluation scores, and final report
serialization using SQLAlchemy AsyncSession.

==============================================================================
DATABASE MODELS MANAGED:
==============================================================================
- `ResearchRun`: Root entity tracking user inquiry, status, error, and completion.
- `YouTubeVideo`: Deduplicated video metadata table across runs.
- `ResearchVideo`: Join table associating videos to a specific research run with position.
- `ResourceEvaluation`: Per-video educational depth scores, strengths, and weaknesses.
- `ResourceRanking`: Comparative ranking summary for the run.
- `FinalReport`: Synthesized markdown report, learning path, and resource links.

==============================================================================
TRANSACTIONAL ARCHITECTURE:
==============================================================================
Each persistence method executes `session.flush()` rather than `commit()`,
allowing the enclosing LangGraph node or calling route handler to control the
overall unit of work and roll back cleanly upon failure.
==============================================================================
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

# pyrefly: ignore [missing-import]
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# DB models aliased to prevent naming collisions with Pydantic schemas
from app.db.models.youtube import (
    ResearchRun as ResearchRunModel,
    YouTubeVideo as YouTubeVideoModel,
    ResearchVideo as ResearchVideoModel,
    ResourceEvaluation as ResourceEvaluationModel,
    ResourceRanking as ResourceRankingModel,
    FinalReport as FinalReportModel,
)

# Pydantic schemas
from app.schema.youtube import (
    YouTubeVideoResult,
    ResourceAnalysis,
    FinalReport as FinalReportSchema,
)

_logger = structlog.get_logger("graph_persistence")


class YouTubeGraphPersistence:
    """
    Object-oriented repository managing all PostgreSQL persistence operations
    for the YouTube research LangGraph pipeline.
    """

    # ========================================================
    # 1. CREATE RESEARCH RUN
    # ========================================================

    async def create_research_run(
        self,
        session: AsyncSession,
        user_query: str,
        video_count: int,
        user_id: UUID | None = None,
    ) -> ResearchRunModel:
        """
        Create a new ResearchRun row in 'planning' state and flush to obtain its UUID.

        Parameters
        ----------
        session:
            Active AsyncSession.
        user_query:
            The user's research question.
        video_count:
            Number of videos requested.
        user_id:
            Optional authenticated user ID.

        Returns
        -------
        ResearchRunModel:
            Newly created and flushed ResearchRun ORM instance.
        """
        run = ResearchRunModel(
            user_id=user_id,
            user_query=user_query,
            video_count=video_count,
            status="planning",
            started_at=datetime.now(timezone.utc),
        )

        session.add(run)
        await session.flush()

        _logger.info("research_run.created", run_id=str(run.id), user_id=str(user_id) if user_id else None)
        return run

    # ========================================================
    # 2. UPDATE RESEARCH RUN STATUS
    # ========================================================

    async def update_research_run_status(
        self,
        session: AsyncSession,
        run_id: UUID,
        status: str,
        error: str | None = None,
    ) -> None:
        """
        Update the status lifecycle flag and timestamps of an active ResearchRun.

        Statuses: planning, researching, ingesting, analyzing, reporting, completed, failed
        """
        result = await session.execute(
            select(ResearchRunModel).where(ResearchRunModel.id == run_id)
        )
        run = result.scalar_one_or_none()

        if run is None:
            _logger.warning("research_run.not_found", run_id=str(run_id))
            return

        run.status = status

        if error:
            run.error_message = error

        if status in ("completed", "failed"):
            run.completed_at = datetime.now(timezone.utc)

        await session.flush()
        _logger.info("research_run.status_updated", run_id=str(run_id), status=status)

    # ========================================================
    # 3. PERSIST VIDEOS
    # ========================================================

    async def persist_videos(
        self,
        session: AsyncSession,
        research_run_id: UUID,
        videos: list[YouTubeVideoResult],
    ) -> dict[str, UUID]:
        """
        Upsert YouTube videos into youtube_videos and link them to the research run.

        Parameters
        ----------
        session:
            Active AsyncSession.
        research_run_id:
            Target research run UUID.
        videos:
            List of YouTubeVideoResult items from Agent 1.

        Returns
        -------
        dict[str, UUID]:
            Mapping from YouTube string video_id → DB UUID (youtube_videos.id).
        """
        video_id_map: dict[str, UUID] = {}

        for position, video in enumerate(videos, start=1):
            # Upsert youtube_videos row
            result = await session.execute(
                select(YouTubeVideoModel).where(
                    YouTubeVideoModel.video_id == video.video_id
                )
            )
            db_video = result.scalar_one_or_none()

            if db_video is None:
                db_video = YouTubeVideoModel(
                    video_id=video.video_id,
                    title=video.title,
                    description=video.description,
                    channel=video.channel,
                    url=video.url,
                    views=video.views,
                    likes=video.likes,
                    comments=video.comments,
                    published_at=video.published_at,
                )
                session.add(db_video)
                await session.flush()
            else:
                # Update mutable metadata
                db_video.title = video.title or db_video.title
                db_video.description = video.description or db_video.description
                db_video.channel = video.channel or db_video.channel
                db_video.url = video.url or db_video.url

                if video.views is not None:
                    db_video.views = video.views
                if video.likes is not None:
                    db_video.likes = video.likes
                if video.comments is not None:
                    db_video.comments = video.comments
                if video.published_at is not None:
                    db_video.published_at = video.published_at

                await session.flush()

            video_id_map[video.video_id] = db_video.id

            # Insert research_videos association
            assoc = ResearchVideoModel(
                research_run_id=research_run_id,
                video_id=db_video.id,
                position=position,
                transcript_available=video.transcript_available,
                transcript_language=video.transcript_language,
            )
            session.add(assoc)

        await session.flush()
        _logger.info(
            "videos.persisted",
            run_id=str(research_run_id),
            video_count=len(videos),
        )
        return video_id_map

    # ========================================================
    # 4. PERSIST ANALYSIS
    # ========================================================

    async def persist_analysis(
        self,
        session: AsyncSession,
        research_run_id: UUID,
        analysis: ResourceAnalysis,
        video_id_map: dict[str, UUID],
    ) -> None:
        """
        Persist ResourceEvaluation rows and a ResourceRanking summary for this run.
        """
        for evaluation in analysis.evaluations:
            db_video_uuid = video_id_map.get(evaluation.video_id)

            if db_video_uuid is None:
                _logger.warning(
                    "evaluation.skipped_no_uuid",
                    video_id=evaluation.video_id,
                    run_id=str(research_run_id),
                )
                continue

            eval_row = ResourceEvaluationModel(
                research_run_id=research_run_id,
                video_id=db_video_uuid,
                rank=evaluation.rank,
                relevance_score=evaluation.relevance_score,
                educational_quality_score=evaluation.educational_quality_score,
                coverage_score=evaluation.coverage_score,
                overall_score=evaluation.overall_score,
                beginner_friendly=evaluation.beginner_friendly,
                concepts_covered=json.dumps(evaluation.concepts_covered),
                strengths=json.dumps(evaluation.strengths),
                weaknesses=json.dumps(evaluation.weaknesses),
                recommendation_reason=evaluation.recommendation_reason,
            )
            session.add(eval_row)

        # Ranking summary
        ranking_row = ResourceRankingModel(
            research_run_id=research_run_id,
            ranking_summary=analysis.ranking_summary,
        )
        session.add(ranking_row)

        await session.flush()
        _logger.info(
            "analysis.persisted",
            run_id=str(research_run_id),
            evaluations_count=len(analysis.evaluations),
        )

    # ========================================================
    # 5. PERSIST FINAL REPORT
    # ========================================================

    async def persist_final_report(
        self,
        session: AsyncSession,
        research_run_id: UUID,
        report: FinalReportSchema,
    ) -> None:
        """
        Persist the synthesized FinalReport from Agent 3 into the database.
        """
        report_row = FinalReportModel(
            research_run_id=research_run_id,
            research_question=report.research_question,
            executive_summary=report.executive_summary,
            recommended_resources=json.dumps(
                [r.model_dump() for r in report.recommended_resources]
            ),
            learning_path=json.dumps(report.learning_path),
            key_topics=json.dumps(report.key_topics),
            methodology=report.methodology,
            limitations=json.dumps(report.limitations),
            conclusion=report.conclusion,
        )

        session.add(report_row)
        await session.flush()

        _logger.info("final_report.persisted", run_id=str(research_run_id))


# ============================================================
# INSTANCE & COMPATIBILITY SHIMS
# ============================================================

youtube_graph_persistence = YouTubeGraphPersistence()


async def create_research_run(
    session: AsyncSession,
    user_query: str,
    video_count: int,
    user_id: UUID | None = None,
) -> ResearchRunModel:
    return await youtube_graph_persistence.create_research_run(
        session=session,
        user_query=user_query,
        video_count=video_count,
        user_id=user_id,
    )


async def update_research_run_status(
    session: AsyncSession,
    run_id: UUID,
    status: str,
    error: str | None = None,
) -> None:
    return await youtube_graph_persistence.update_research_run_status(
        session=session,
        run_id=run_id,
        status=status,
        error=error,
    )


async def persist_videos(
    session: AsyncSession,
    research_run_id: UUID,
    videos: list[YouTubeVideoResult],
) -> dict[str, UUID]:
    return await youtube_graph_persistence.persist_videos(
        session=session,
        research_run_id=research_run_id,
        videos=videos,
    )


async def persist_analysis(
    session: AsyncSession,
    research_run_id: UUID,
    analysis: ResourceAnalysis,
    video_id_map: dict[str, UUID],
) -> None:
    return await youtube_graph_persistence.persist_analysis(
        session=session,
        research_run_id=research_run_id,
        analysis=analysis,
        video_id_map=video_id_map,
    )


async def persist_final_report(
    session: AsyncSession,
    research_run_id: UUID,
    report: FinalReportSchema,
) -> None:
    return await youtube_graph_persistence.persist_final_report(
        session=session,
        research_run_id=research_run_id,
        report=report,
    )


__all__ = [
    "YouTubeGraphPersistence",
    "youtube_graph_persistence",
    "create_research_run",
    "update_research_run_status",
    "persist_videos",
    "persist_analysis",
    "persist_final_report",
]
