from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
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
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
)

from pgvector.sqlalchemy import Vector


# ============================================================
# BASE
# ============================================================

class Base(DeclarativeBase):
    pass


# ============================================================
# ENUMS
# ============================================================

class AuthProvider(str, Enum):

    LOCAL = "local"
    GOOGLE = "google"


class ResearchStatus(str, Enum):

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# ============================================================
# USERS
# ============================================================

class User(Base):
    """
    Main application user.

    Stores user identity and basic account information.
    Authentication credentials are handled separately
    through UserAuth and OAuthAccount.
    """

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        comment="Unique identifier for the user.",
    )

    email: Mapped[str] = mapped_column(
        String(320),
        unique=True,
        nullable=False,
        index=True,
        comment="User's unique email address.",
    )

    username: Mapped[Optional[str]] = mapped_column(
        String(100),
        unique=True,
        nullable=True,
        comment="Optional unique username displayed in the application.",
    )

    full_name: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
        comment="User's display name or full name.",
    )

    profile_picture_url: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="URL of the user's profile picture, usually from Google OAuth.",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether the user's account is currently active.",
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether the user's email/account has been verified.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the user account was created.",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Timestamp when the user account was last modified.",
    )

    # --------------------------------------------------------
    # RELATIONSHIPS
    # --------------------------------------------------------

    auth: Mapped[Optional["UserAuth"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )

    oauth_accounts: Mapped[List["OAuthAccount"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    research_runs: Mapped[List["ResearchRun"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


# ============================================================
# LOCAL AUTHENTICATION
# ============================================================

class UserAuth(Base):
    """
    Stores credentials for traditional email/password login.

    Passwords must NEVER be stored in plaintext.
    Only a secure password hash should be stored.
    """

    __tablename__ = "user_auth"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        comment="Unique identifier for the authentication record.",
    )

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        comment="User associated with these authentication credentials.",
    )

    password_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Secure hash of the user's password. Never store plaintext passwords.",
    )

    last_password_change: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp of the user's most recent password change.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when local authentication was created.",
    )

    user: Mapped["User"] = relationship(
        back_populates="auth",
    )


# ============================================================
# GOOGLE / OAUTH ACCOUNTS
# ============================================================

class OAuthAccount(Base):
    """
    Stores external authentication providers such as Google.

    One user can potentially connect multiple OAuth providers.
    """

    __tablename__ = "oauth_accounts"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        comment="Unique identifier for the OAuth account.",
    )

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Application user associated with the OAuth account.",
    )

    provider: Mapped[AuthProvider] = mapped_column(
        SQLEnum(AuthProvider),
        nullable=False,
        comment="OAuth provider used for authentication, such as Google.",
    )

    provider_user_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Unique user identifier supplied by the OAuth provider.",
    )

    provider_email: Mapped[Optional[str]] = mapped_column(
        String(320),
        nullable=True,
        comment="Email address returned by the OAuth provider.",
    )

    access_token: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="OAuth access token if required for provider API access.",
    )

    refresh_token: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="OAuth refresh token if supplied by the provider.",
    )

    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Expiration timestamp of the OAuth access token.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the OAuth account was connected.",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Timestamp when the OAuth account was last updated.",
    )

    user: Mapped["User"] = relationship(
        back_populates="oauth_accounts",
    )

    __table_args__ = (
        UniqueConstraint(
            "provider",
            "provider_user_id",
            name="uq_oauth_provider_user",
        ),
    )


# ============================================================
# REFRESH TOKENS
# ============================================================

class RefreshToken(Base):
    """
    Stores refresh-token sessions for JWT authentication.

    Store a hash of the refresh token rather than the raw token
    whenever possible.
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        comment="Unique identifier for the refresh-token session.",
    )

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="User who owns this refresh-token session.",
    )

    token_hash: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False,
        comment="Hash of the refresh token.",
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="Timestamp after which the refresh token is invalid.",
    )

    revoked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether this refresh token has been revoked.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the refresh token was created.",
    )

    user: Mapped["User"] = relationship(
        back_populates="refresh_tokens",
    )


# ============================================================
# RESEARCH RUN
# ============================================================

class ResearchRun(Base):
    """
    Represents one complete YouTube research request.

    Example:

    User asks:
    "Find the best YouTube resources for learning blockchain."

    One ResearchRun is created for that request.
    """

    __tablename__ = "research_runs"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        comment="Unique identifier for the research run.",
    )

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="User who initiated this research request.",
    )

    user_query: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Original natural-language research question entered by the user.",
    )

    video_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Number of YouTube videos requested by the user.",
    )

    status: Mapped[ResearchStatus] = mapped_column(
        SQLEnum(ResearchStatus),
        default=ResearchStatus.PENDING,
        nullable=False,
        index=True,
        comment="Current execution status of the research pipeline.",
    )

    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Error message if the research pipeline failed.",
    )

    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when research processing started.",
    )

    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when research processing completed.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        comment="Timestamp when this research request was created.",
    )

    user: Mapped["User"] = relationship(
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


# ============================================================
# YOUTUBE VIDEO
# ============================================================

class YouTubeVideo(Base):
    """
    Canonical YouTube video information.

    A video can appear in multiple research runs,
    therefore videos are stored independently from ResearchRun.
    """

    __tablename__ = "youtube_videos"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        comment="Internal database identifier for the video.",
    )

    video_id: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique YouTube video ID.",
    )

    title: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="YouTube video title.",
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="YouTube video description.",
    )

    channel: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="YouTube channel name.",
    )

    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Original YouTube publication timestamp.",
    )

    url: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Canonical YouTube URL.",
    )

    views: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Number of YouTube views collected during research.",
    )

    likes: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Number of YouTube likes collected during research.",
    )

    comments: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Number of YouTube comments collected during research.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the video was first stored.",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Timestamp when video metadata was last updated.",
    )

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
    Association table between a research run and a YouTube video.

    Stores information specific to that particular research run.
    """

    __tablename__ = "research_videos"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        comment="Unique identifier for this research-video relationship.",
    )

    research_run_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("research_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Research run that discovered this video.",
    )

    video_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("youtube_videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="YouTube video associated with this research run.",
    )

    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Original position of the video in the YouTube search results.",
    )

    transcript_available: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether a transcript was successfully retrieved for this video.",
    )

    transcript_language: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Primary transcript language detected for this research result.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when this video was added to the research run.",
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
# TRANSCRIPT CHUNKS
# ============================================================

class TranscriptChunk(Base):
    """
    Chunked transcript used for RAG.

    Instead of storing one huge transcript in an LLM context,
    transcripts are split into chunks and embedded into pgvector.
    """

    __tablename__ = "transcript_chunks"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        comment="Unique identifier for the transcript chunk.",
    )

    video_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("youtube_videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="YouTube video this transcript chunk belongs to.",
    )

    chunk_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Sequential position of this chunk within the transcript.",
    )

    text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Transcript text contained in this chunk.",
    )

    language: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Language of the transcript chunk, such as en or hi-en.",
    )

    start_time: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Approximate start timestamp of this transcript chunk in seconds.",
    )

    end_time: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Approximate end timestamp of this transcript chunk in seconds.",
    )

    embedding: Mapped[Optional[List[float]]] = mapped_column(
        Vector(768),
        nullable=True,
        comment="Vector embedding used for semantic RAG search.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the transcript chunk was stored.",
    )

    video: Mapped["YouTubeVideo"] = relationship(
        back_populates="transcripts",
    )

    __table_args__ = (
        UniqueConstraint(
            "video_id",
            "chunk_index",
            name="uq_video_chunk",
        ),
    )


# ============================================================
# RESOURCE EVALUATION
# ============================================================

class ResourceEvaluation(Base):
    """
    AI-generated evaluation of a YouTube resource.

    Generated by the Content Analysis Agent.
    """

    __tablename__ = "resource_evaluations"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        comment="Unique identifier for this evaluation.",
    )

    research_run_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("research_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Research run that generated this evaluation.",
    )

    video_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("youtube_videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Video being evaluated.",
    )

    relevance_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="AI score from 0-10 representing relevance to the research question.",
    )

    educational_quality_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="AI score from 0-10 representing educational quality.",
    )

    coverage_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="AI score from 0-10 representing topic coverage.",
    )

    technical_depth_score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="AI score from 0-10 representing technical depth.",
    )

    practical_usefulness_score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="AI score from 0-10 representing practical usefulness.",
    )

    beginner_friendly: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        comment="Whether the resource is suitable for beginners.",
    )

    concepts_covered: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Concepts identified by the AI as being covered by the resource.",
    )

    strengths: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Main strengths identified during content analysis.",
    )

    weaknesses: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Main weaknesses or limitations identified during analysis.",
    )

    recommendation_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Explanation of why this resource is or is not recommended.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the evaluation was generated.",
    )

    research_run: Mapped["ResearchRun"] = relationship(
        back_populates="evaluations",
    )


# ============================================================
# RESOURCE RANKING
# ============================================================

class ResourceRanking(Base):
    """
    Stores the final ranking generated by the Resource Ranking Agent.
    """

    __tablename__ = "resource_rankings"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        comment="Unique identifier for the ranking.",
    )

    research_run_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("research_runs.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        comment="Research run associated with this ranking.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the ranking was generated.",
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
    One resource inside a research ranking.

    Stores the final ranking position and AI-derived score.
    """

    __tablename__ = "ranked_resources"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        comment="Unique identifier for the ranked resource.",
    )

    ranking_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("resource_rankings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Ranking this resource belongs to.",
    )

    video_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("youtube_videos.id", ondelete="CASCADE"),
        nullable=False,
        comment="Video represented by this ranked resource.",
    )

    rank: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Final ranking position where 1 represents the best resource.",
    )

    score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Overall AI-generated score from 0-10.",
    )

    why_recommended: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Explanation of why this resource received its ranking.",
    )

    ranking: Mapped["ResourceRanking"] = relationship(
        back_populates="ranked_resources",
    )


# ============================================================
# FINAL REPORT
# ============================================================

class FinalReport(Base):
    """
    Final structured report generated by the Report Generator Agent.
    """

    __tablename__ = "final_reports"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        comment="Unique identifier for the final report.",
    )

    research_run_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("research_runs.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        comment="Research run that produced this report.",
    )

    executive_summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="High-level summary of the research findings.",
    )

    learning_path: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Recommended learning sequence derived from the analyzed resources.",
    )

    key_topics: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Important topics identified across the researched resources.",
    )

    methodology: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Explanation of how resources were evaluated and ranked.",
    )

    limitations: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Known limitations of the research and available data.",
    )

    conclusion: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Final recommendation and conclusion.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the final report was generated.",
    )

    research_run: Mapped["ResearchRun"] = relationship(
        back_populates="report",
    )


# ============================================================
# INDEXES
# ============================================================

Index(
    "ix_research_runs_user_created",
    ResearchRun.user_id,
    ResearchRun.created_at.desc(),
)

Index(
    "ix_transcript_video_chunk",
    TranscriptChunk.video_id,
    TranscriptChunk.chunk_index,
)

Index(
    "ix_evaluation_research_video",
    ResourceEvaluation.research_run_id,
    ResourceEvaluation.video_id,
)

Index(
    "ix_ranked_resource_ranking_rank",
    RankedResource.ranking_id,
    RankedResource.rank,
)