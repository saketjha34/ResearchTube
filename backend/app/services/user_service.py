import json
from uuid import UUID
from collections import Counter
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import (
    ResearchRun,
    YouTubeVideo,
    ResearchVideo,
    ResourceEvaluation,
    TranscriptChunk,
    FinalReport
)
from app.schema.user_stats import UserStatsResponse, ChannelStat, ConceptStat

async def get_user_stats(db: AsyncSession, user_id: UUID) -> UserStatsResponse:
    # Query total, completed, failed runs
    runs_query = await db.execute(
        select(
            func.count(ResearchRun.id).label("total"),
            func.count(ResearchRun.id).filter(ResearchRun.status == "completed").label("completed"),
            func.count(ResearchRun.id).filter(ResearchRun.status == "failed").label("failed")
        )
        .where(ResearchRun.user_id == user_id)
    )
    runs_row = runs_query.first()
    total_runs = runs_row.total if runs_row else 0
    completed_runs = runs_row.completed if runs_row else 0
    failed_runs = runs_row.failed if runs_row else 0

    # Unique videos and cumulative views
    video_stats_query = await db.execute(
        select(
            func.count(func.distinct(YouTubeVideo.id)).label("unique_videos"),
            func.sum(YouTubeVideo.views).label("total_views")
        )
        .join(ResearchVideo, ResearchVideo.video_id == YouTubeVideo.id)
        .join(ResearchRun, ResearchRun.id == ResearchVideo.research_run_id)
        .where(
            ResearchRun.user_id == user_id,
            ResearchRun.status == "completed"
        )
    )
    video_row = video_stats_query.first()
    total_videos_analyzed = video_row.unique_videos if (video_row and video_row.unique_videos) else 0
    total_views_analyzed = video_row.total_views if (video_row and video_row.total_views) else 0

    # Average videos per run
    avg_videos_query = await db.scalar(
        select(func.avg(ResearchRun.video_count))
        .where(ResearchRun.user_id == user_id)
    )
    average_videos_per_run = round(float(avg_videos_query or 0.0), 1)

    # Unique channels discovered
    channels_query = await db.scalar(
        select(func.count(func.distinct(YouTubeVideo.channel)))
        .join(ResearchVideo, ResearchVideo.video_id == YouTubeVideo.id)
        .join(ResearchRun, ResearchRun.id == ResearchVideo.research_run_id)
        .where(
            ResearchRun.user_id == user_id,
            ResearchRun.status == "completed"
        )
    )
    total_channels_discovered = channels_query or 0

    # Average run duration
    duration_query = await db.scalar(
        select(
            func.avg(
                func.extract("epoch", ResearchRun.completed_at) - 
                func.extract("epoch", ResearchRun.started_at)
            )
        )
        .where(
            ResearchRun.user_id == user_id,
            ResearchRun.status == "completed",
            ResearchRun.completed_at.isnot(None),
            ResearchRun.started_at.isnot(None)
        )
    )
    average_run_duration_seconds = round(float(duration_query or 0.0), 1)

    # Average evaluation scores
    scores_query = await db.execute(
        select(
            func.avg(ResourceEvaluation.relevance_score).label("rel"),
            func.avg(ResourceEvaluation.educational_quality_score).label("edu"),
            func.avg(ResourceEvaluation.coverage_score).label("cov"),
            func.count(ResourceEvaluation.id).filter(ResourceEvaluation.beginner_friendly == True).label("beginner")
        )
        .join(ResearchRun, ResearchRun.id == ResourceEvaluation.research_run_id)
        .where(
            ResearchRun.user_id == user_id,
            ResearchRun.status == "completed"
        )
    )
    scores_row = scores_query.first()
    average_relevance_score = round(float(scores_row.rel or 0.0), 2) if scores_row else 0.0
    average_educational_score = round(float(scores_row.edu or 0.0), 2) if scores_row else 0.0
    average_coverage_score = round(float(scores_row.cov or 0.0), 2) if scores_row else 0.0
    total_beginner_friendly_videos = scores_row.beginner if (scores_row and scores_row.beginner) else 0

    # Total transcript chunks embedded
    chunks_query = await db.scalar(
        select(func.count(TranscriptChunk.id))
        .join(ResearchRun, ResearchRun.id == TranscriptChunk.research_run_id)
        .where(ResearchRun.user_id == user_id)
    )
    total_transcript_chunks = chunks_query or 0

    # Top 5 channels
    top_channels_query = await db.execute(
        select(
            YouTubeVideo.channel,
            func.count(YouTubeVideo.id).label("count")
        )
        .join(ResearchVideo, ResearchVideo.video_id == YouTubeVideo.id)
        .join(ResearchRun, ResearchRun.id == ResearchVideo.research_run_id)
        .where(
            ResearchRun.user_id == user_id,
            ResearchRun.status == "completed",
            YouTubeVideo.channel.isnot(None)
        )
        .group_by(YouTubeVideo.channel)
        .order_by(func.count(YouTubeVideo.id).desc())
        .limit(5)
    )
    top_channels = [
        ChannelStat(channel=row[0], count=row[1])
        for row in top_channels_query.all()
    ]

    # Top 10 concepts (loaded dynamically from report.key_topics)
    reports_query = await db.execute(
        select(FinalReport.key_topics)
        .join(ResearchRun, ResearchRun.id == FinalReport.research_run_id)
        .where(
            ResearchRun.user_id == user_id,
            ResearchRun.status == "completed",
            FinalReport.key_topics.isnot(None)
        )
    )
    concept_counter = Counter()
    for row in reports_query.all():
        try:
            topics = json.loads(row[0])
            if isinstance(topics, list):
                for topic in topics:
                    concept_counter[topic.strip()] += 1
        except Exception:
            pass
    top_concepts = [
        ConceptStat(concept=concept, count=count)
        for concept, count in concept_counter.most_common(10)
    ]

    return UserStatsResponse(
        total_research_runs=total_runs,
        completed_research_runs=completed_runs,
        failed_research_runs=failed_runs,
        total_videos_analyzed=total_videos_analyzed,
        total_views_analyzed=total_views_analyzed,
        average_videos_per_run=average_videos_per_run,
        total_channels_discovered=total_channels_discovered,
        average_run_duration_seconds=average_run_duration_seconds,
        average_relevance_score=average_relevance_score,
        average_educational_score=average_educational_score,
        average_coverage_score=average_coverage_score,
        total_beginner_friendly_videos=total_beginner_friendly_videos,
        total_transcript_chunks=total_transcript_chunks,
        top_channels=top_channels,
        top_concepts=top_concepts
    )
