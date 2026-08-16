"""
Persistence helpers for the LangGraph research pipeline.

Each function handles one stage of the research lifecycle:

    create_research_run()
    update_research_run_status()
    persist_videos()
    persist_analysis()
    persist_final_report()

All functions are async and use AsyncSession.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# DB models — aliased to avoid name collision with Pydantic schemas
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


# ============================================================
# CREATE RESEARCH RUN
# ============================================================

async def create_research_run(
    session: AsyncSession,
    user_query: str,
    video_count: int,
    user_id: UUID | None = None,
) -> ResearchRunModel:
    """
    Create a new ResearchRun row and flush to get its UUID.
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

    print(
        f"[DB] ResearchRun created: {run.id}"
    )

    return run


# ============================================================
# UPDATE RESEARCH RUN STATUS
# ============================================================

async def update_research_run_status(
    session: AsyncSession,
    run_id: UUID,
    status: str,
    error: str | None = None,
) -> None:
    """
    Update the status of a ResearchRun.

    Statuses: planning, researching, ingesting,
              analyzing, reporting, completed, failed
    """

    result = await session.execute(
        select(ResearchRunModel).where(
            ResearchRunModel.id == run_id
        )
    )

    run = result.scalar_one_or_none()

    if run is None:
        print(
            f"[DB] WARNING: ResearchRun {run_id} not found."
        )
        return

    run.status = status

    if error:
        run.error_message = error

    if status in ("completed", "failed"):
        run.completed_at = datetime.now(timezone.utc)

    await session.flush()

    print(
        f"[DB] ResearchRun {run_id} → {status}"
    )


# ============================================================
# PERSIST VIDEOS
# ============================================================

async def persist_videos(
    session: AsyncSession,
    research_run_id: UUID,
    videos: list[YouTubeVideoResult],
) -> dict[str, UUID]:
    """
    Upsert YouTube videos and link them to the research run.

    Returns
    -------
    video_id_map:
        Maps YouTube string video_id → DB UUID (youtube_videos.id).
    """

    video_id_map: dict[str, UUID] = {}

    for position, video in enumerate(videos, start=1):

        # ----------------------------------------------------
        # UPSERT youtube_videos row
        # ----------------------------------------------------

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
            )

            session.add(db_video)
            await session.flush()

        else:

            # Update mutable fields on re-fetch
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

            await session.flush()

        video_id_map[video.video_id] = db_video.id

        # ----------------------------------------------------
        # INSERT research_videos association
        # ----------------------------------------------------

        assoc = ResearchVideoModel(
            research_run_id=research_run_id,
            video_id=db_video.id,
            position=position,
            transcript_available=video.transcript_available,
            transcript_language=video.transcript_language,
        )

        session.add(assoc)

    await session.flush()

    print(
        f"[DB] Persisted {len(videos)} videos "
        f"for run {research_run_id}."
    )

    return video_id_map


# ============================================================
# PERSIST ANALYSIS
# ============================================================

async def persist_analysis(
    session: AsyncSession,
    research_run_id: UUID,
    analysis: ResourceAnalysis,
    video_id_map: dict[str, UUID],
) -> None:
    """
    Persist all ResourceEvaluation rows and a ResourceRanking
    summary row for this research run.
    """

    for evaluation in analysis.evaluations:

        db_video_uuid = video_id_map.get(
            evaluation.video_id
        )

        if db_video_uuid is None:
            print(
                f"[DB] WARNING: No DB UUID for "
                f"{evaluation.video_id} — skipping evaluation."
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

    # --------------------------------------------------------
    # Ranking summary
    # --------------------------------------------------------

    ranking_row = ResourceRankingModel(
        research_run_id=research_run_id,
        ranking_summary=analysis.ranking_summary,
    )

    session.add(ranking_row)

    await session.flush()

    print(
        f"[DB] Persisted {len(analysis.evaluations)} "
        f"evaluations for run {research_run_id}."
    )


# ============================================================
# PERSIST FINAL REPORT
# ============================================================

async def persist_final_report(
    session: AsyncSession,
    research_run_id: UUID,
    report: FinalReportSchema,
) -> None:
    """
    Persist the FinalReport from Agent 3.
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

    print(
        f"[DB] FinalReport persisted for run {research_run_id}."
    )
