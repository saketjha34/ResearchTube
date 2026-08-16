from __future__ import annotations

import json
from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Index,
    func,
)

from sqlalchemy.dialects.postgresql import UUID as PGUUID

from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

# pyrefly: ignore [missing-import]
from pgvector.sqlalchemy import Vector
from app.db.models.user import User
from app.db.database import Base


# ============================================================
# RESEARCH RUN
# ============================================================

class ResearchRun(Base):
    """
    One complete YouTube research request.

    Example:

        User:
        "Find the best Python tutorials for beginners."

    One ResearchRun represents that request.
    """

    __tablename__ = "research_runs"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # nullable so the research endpoint works without auth
    user_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    user_query: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    video_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        nullable=False,
        index=True,
    )

    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # --------------------------------------------------------
    # Relationships
    # --------------------------------------------------------

    user: Mapped[Optional["User"]] = relationship(
        back_populates="research_runs",
    )

    videos: Mapped[List["ResearchVideo"]] = relationship(
        back_populates="research_run",
        cascade="all, delete-orphan",
    )

    evaluations: Mapped[List["ResourceEvaluation"]] = relationship(
        back_populates="research_run",
        cascade="all, delete-orphan",
    )

    ranking: Mapped[Optional["ResourceRanking"]] = relationship(
        back_populates="research_run",
        cascade="all, delete-orphan",
        uselist=False,
    )

    report: Mapped[Optional["FinalReport"]] = relationship(
        back_populates="research_run",
        cascade="all, delete-orphan",
        uselist=False,
    )

    transcript_chunks: Mapped[List["TranscriptChunk"]] = relationship(
        back_populates="research_run",
        cascade="all, delete-orphan",
    )


# ============================================================
# YOUTUBE VIDEO
# ============================================================

class YouTubeVideo(Base):
    """
    Canonical YouTube video.

    A video can appear in multiple research runs,
    therefore it is stored independently.
    """

    __tablename__ = "youtube_videos"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    video_id: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    title: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    channel: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    url: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    views: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )

    likes: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )

    comments: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # --------------------------------------------------------
    # Relationships
    # --------------------------------------------------------

    research_runs: Mapped[List["ResearchVideo"]] = relationship(
        back_populates="video",
        cascade="all, delete-orphan",
    )

    transcripts: Mapped[List["TranscriptChunk"]] = relationship(
        back_populates="video",
        cascade="all, delete-orphan",
    )


# ============================================================
# RESEARCH ↔ VIDEO
# ============================================================

class ResearchVideo(Base):
    """
    Association between a research run and a YouTube video.

    Stores information specific to this research execution.
    """

    __tablename__ = "research_videos"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    research_run_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "research_runs.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    video_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "youtube_videos.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    transcript_available: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    transcript_language: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    research_run: Mapped["ResearchRun"] = relationship(
        back_populates="videos",
    )

    video: Mapped["YouTubeVideo"] = relationship(
        back_populates="research_runs",
    )

    __table_args__ = (
        UniqueConstraint(
            "research_run_id",
            "video_id",
            name="uq_research_video",
        ),
    )


# ============================================================
# TRANSCRIPT CHUNKS — RAG
# ============================================================

class TranscriptChunk(Base):
    """
    A chunk of a YouTube transcript for one research run.

    Scoped per research_run so the same YouTube video can
    appear across multiple runs without constraint violations.

    text
        Original transcript chunk.

    embedding
        Vector representation stored in PostgreSQL
        using pgvector.
    """

    __tablename__ = "transcript_chunks"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # The research run this chunk belongs to
    research_run_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "research_runs.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    video_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "youtube_videos.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    chunk_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    language: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )

    start_time: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )

    end_time: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )

    # ========================================================
    # PGVECTOR
    # ========================================================

    embedding: Mapped[Optional[List[float]]] = mapped_column(
        Vector(768),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    video: Mapped["YouTubeVideo"] = relationship(
        back_populates="transcripts",
    )

    research_run: Mapped["ResearchRun"] = relationship(
        back_populates="transcript_chunks",
    )

    __table_args__ = (
        # Scoped per run so same video in two runs doesn't collide
        UniqueConstraint(
            "research_run_id",
            "video_id",
            "chunk_index",
            name="uq_run_video_chunk",
        ),

        Index(
            "ix_transcript_run_video_chunk",
            "research_run_id",
            "video_id",
            "chunk_index",
        ),
    )


# ============================================================
# RESOURCE EVALUATION
# ============================================================

class ResourceEvaluation(Base):
    """
    Analysis produced by Agent 2.

    Agent 2 performs:

        RAG
        ↓
        Context retrieval
        ↓
        Content analysis
        ↓
        Evaluation
        ↓
        Ranking

    Therefore this table stores the analysis evidence
    used for ranking.
    """

    __tablename__ = "resource_evaluations"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    research_run_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "research_runs.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    video_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "youtube_videos.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # Rank assigned by Agent 2 (1 = best)
    rank: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )

    relevance_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    educational_quality_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    coverage_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    overall_score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )

    technical_depth_score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )

    practical_usefulness_score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )

    beginner_friendly: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
    )

    concepts_covered: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    strengths: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    weaknesses: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    recommendation_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    research_run: Mapped["ResearchRun"] = relationship(
        back_populates="evaluations",
    )

    __table_args__ = (
        UniqueConstraint(
            "research_run_id",
            "video_id",
            name="uq_evaluation_research_video",
        ),
    )


# ============================================================
# RESOURCE RANKING
# ============================================================

class ResourceRanking(Base):
    """
    Ranking generated by Agent 2.

    Agent 2 is now responsible for BOTH:

        Content Analysis
        +
        Ranking

    So there is no separate ranking agent.
    """

    __tablename__ = "resource_rankings"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    research_run_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "research_runs.id",
            ondelete="CASCADE",
        ),
        unique=True,
        nullable=False,
    )

    ranking_summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    research_run: Mapped["ResearchRun"] = relationship(
        back_populates="ranking",
    )

    ranked_resources: Mapped[List["RankedResource"]] = relationship(
        back_populates="ranking",
        cascade="all, delete-orphan",
        order_by="RankedResource.rank",
    )


# ============================================================
# RANKED RESOURCE
# ============================================================

class RankedResource(Base):
    """
    Final ranked representation of a YouTube resource.

    Generated by Agent 2.
    """

    __tablename__ = "ranked_resources"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    ranking_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "resource_rankings.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    video_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "youtube_videos.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    rank: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    why_recommended: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    ranking: Mapped["ResourceRanking"] = relationship(
        back_populates="ranked_resources",
    )

    __table_args__ = (
        UniqueConstraint(
            "ranking_id",
            "video_id",
            name="uq_ranked_resource_video",
        ),

        Index(
            "ix_ranked_resource_ranking_rank",
            "ranking_id",
            "rank",
        ),
    )


# ============================================================
# FINAL REPORT
# ============================================================

class FinalReport(Base):
    """
    Final report generated by Agent 3.
    """

    __tablename__ = "final_reports"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    research_run_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "research_runs.id",
            ondelete="CASCADE",
        ),
        unique=True,
        nullable=False,
    )

    research_question: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    executive_summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # JSON-serialized list of FinalReportResource dicts
    recommended_resources: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    learning_path: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    key_topics: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    methodology: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    limitations: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    conclusion: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    research_run: Mapped["ResearchRun"] = relationship(
        back_populates="report",
    )