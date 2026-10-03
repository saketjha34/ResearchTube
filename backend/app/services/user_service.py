"""
UserService — Singleton service for user research activity statistics.
"""

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
    FinalReport,
    ChatSession,
    ChatMessage,
    MessageRole
)
from app.schema.user_stats import (
    UserStatsResponse,
    ChannelStat,
    ConceptStat,
    ChatVideoStat,
    ChatScopeStat
)


class UserService:
    """
    Singleton service for aggregating user research statistics.

    Usage:
        from app.services.user_service import user_service
        stats = await user_service.get_user_stats(db, user_id)
    """

    _instance: "UserService | None" = None

    def __new__(cls) -> "UserService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def get_user_stats(self, db: AsyncSession, user_id: UUID) -> UserStatsResponse:
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

        # ----------------------------------------------------
        # CHAT & CONVERSATIONAL RAG STATISTICS
        # ----------------------------------------------------
        # 1. Total sessions, pinned, shared, video-scoped
        sessions_query = await db.execute(
            select(
                func.count(ChatSession.id).label("total"),
                func.count(ChatSession.id).filter(ChatSession.is_pinned == True).label("pinned"),
                func.count(ChatSession.id).filter(ChatSession.is_shared == True).label("shared"),
                func.count(ChatSession.id).filter(
                    (ChatSession.scope_mode == "video") | (ChatSession.video_id.isnot(None))
                ).label("video_scoped")
            )
            .where(ChatSession.user_id == user_id)
        )
        sess_row = sessions_query.first()
        total_chat_sessions = sess_row.total if sess_row else 0
        pinned_chat_sessions = sess_row.pinned if sess_row else 0
        shared_chat_sessions = sess_row.shared if sess_row else 0
        total_video_scoped_sessions = sess_row.video_scoped if sess_row else 0

        # 2. Total messages and role breakdown
        messages_query = await db.execute(
            select(
                func.count(ChatMessage.id).label("total"),
                func.count(ChatMessage.id).filter(ChatMessage.role == MessageRole.USER).label("user_msgs"),
                func.count(ChatMessage.id).filter(ChatMessage.role == MessageRole.ASSISTANT).label("ai_msgs"),
                func.count(ChatMessage.id).filter(
                    (ChatMessage.role == MessageRole.ASSISTANT) &
                    ChatMessage.sources.isnot(None) &
                    (ChatMessage.sources != "[]")
                ).label("grounded_msgs")
            )
            .join(ChatSession, ChatSession.id == ChatMessage.session_id)
            .where(ChatSession.user_id == user_id)
        )
        msg_row = messages_query.first()
        total_chat_messages = msg_row.total if msg_row else 0
        total_user_messages = msg_row.user_msgs if msg_row else 0
        total_assistant_messages = msg_row.ai_msgs if msg_row else 0
        total_rag_grounded_messages = msg_row.grounded_msgs if msg_row else 0

        average_messages_per_session = (
            round(total_chat_messages / total_chat_sessions, 1) if total_chat_sessions > 0 else 0.0
        )
        rag_grounding_rate = (
            round((total_rag_grounded_messages / total_assistant_messages) * 100, 1)
            if total_assistant_messages > 0 else 0.0
        )

        # 3. Top discussed videos in chat
        top_chat_videos_query = await db.execute(
            select(
                YouTubeVideo.title,
                YouTubeVideo.channel,
                func.count(ChatSession.id).label("count")
            )
            .join(ChatSession, ChatSession.video_id == YouTubeVideo.id)
            .where(
                ChatSession.user_id == user_id,
                ChatSession.video_id.isnot(None)
            )
            .group_by(YouTubeVideo.title, YouTubeVideo.channel)
            .order_by(func.count(ChatSession.id).desc())
            .limit(5)
        )
        top_discussed_videos = [
            ChatVideoStat(title=row[0] or "Untitled Video", channel=row[1], chat_count=row[2])
            for row in top_chat_videos_query.all()
        ]

        # 4. Scope distribution
        scope_query = await db.execute(
            select(
                ChatSession.scope_mode,
                func.count(ChatSession.id)
            )
            .where(ChatSession.user_id == user_id)
            .group_by(ChatSession.scope_mode)
        )
        chat_scope_distribution = [
            ChatScopeStat(scope=row[0] or "none", count=row[1])
            for row in scope_query.all()
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
            top_concepts=top_concepts,
            total_chat_sessions=total_chat_sessions,
            total_chat_messages=total_chat_messages,
            total_user_messages=total_user_messages,
            total_assistant_messages=total_assistant_messages,
            average_messages_per_session=average_messages_per_session,
            total_video_scoped_sessions=total_video_scoped_sessions,
            total_rag_grounded_messages=total_rag_grounded_messages,
            rag_grounding_rate=rag_grounding_rate,
            pinned_chat_sessions=pinned_chat_sessions,
            shared_chat_sessions=shared_chat_sessions,
            top_discussed_videos=top_discussed_videos,
            chat_scope_distribution=chat_scope_distribution
        )


# ============================================================
# SINGLETON INSTANCE
# ============================================================

user_service = UserService()


# ============================================================
# BACKWARD COMPATIBILITY SHIM
# ============================================================

async def get_user_stats(db: AsyncSession, user_id: UUID) -> UserStatsResponse:
    """Backward-compatible function alias — delegates to user_service singleton."""
    return await user_service.get_user_stats(db, user_id)

