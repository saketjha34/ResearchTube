"""
Chat DB Models.

Defines the persistent database schema for the ResearchTube AI chat system.

Tables:
    chat_sessions:  One persistent conversation thread per user.
    chat_messages:  Individual messages within a session (user + assistant turns).

Relations:
    User (1) ──< ChatSession (1) ──< ChatMessage (*)

Features:
    - Optional scoping to a specific YouTubeVideo (video_id) or ResearchRun (research_run_id)
    - Full message history for multi-turn conversation
    - Soft-deletable sessions (is_archived flag)
    - Cascade delete: deleting a session removes all its messages
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


if TYPE_CHECKING:
    from app.db.models.user import User
    from app.db.models.youtube import YouTubeVideo, ResearchRun


# ============================================================
# ENUMS
# ============================================================

class MessageRole(str, Enum):
    """Role of the message sender in a chat turn."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


# ============================================================
# CHAT SESSION
# ============================================================

class ChatSession(Base):
    """
    A persistent chat conversation thread.

    Each session belongs to a user and optionally scopes to a video or research run.
    If no scope is set, the chatbot behaves as a general ResearchTube AI assistant.

    Example:
        - General chat: video_id=None, research_run_id=None
        - Video-scoped: video_id=<uuid of YouTubeVideo>, research_run_id=None
        - Run-scoped:   research_run_id=<uuid of ResearchRun>, video_id=None
    """

    __tablename__ = "chat_sessions"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --------------------------------------------------------
    # Title — auto-generated or user-provided
    # --------------------------------------------------------

    title: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    # --------------------------------------------------------
    # Optional scope: video or research run
    # --------------------------------------------------------

    video_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("youtube_videos.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    research_run_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("research_runs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # --------------------------------------------------------
    # Metadata
    # --------------------------------------------------------

    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    is_pinned: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    share_token: Mapped[Optional[str]] = mapped_column(
        String(64),
        unique=True,
        nullable=True,
        index=True,
    )

    is_shared: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    shared_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    message_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
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

    user: Mapped["User"] = relationship(
        back_populates="chat_sessions",
    )

    video: Mapped[Optional["YouTubeVideo"]] = relationship(
        back_populates="chat_sessions",
        foreign_keys=[video_id],
    )

    research_run: Mapped[Optional["ResearchRun"]] = relationship(
        back_populates="chat_sessions",
        foreign_keys=[research_run_id],
    )

    messages: Mapped[List["ChatMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )


# ============================================================
# CHAT MESSAGE
# ============================================================

class ChatMessage(Base):
    """
    A single message turn in a chat session.

    Roles:
        - user: text sent by the end-user
        - assistant: AI response text
        - system: injected context (RAG snippets, etc.) — rarely stored, but reserved

    The 'sources' column stores a JSON array of retrieved transcript chunk IDs/metadata
    used to ground the assistant response (RAG provenance).
    """

    __tablename__ = "chat_messages"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    session_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    role: Mapped[MessageRole] = mapped_column(
        SQLEnum(MessageRole),
        nullable=False,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # JSON-serialised list of RAG source references:
    # e.g. [{"chunk_id": "...", "video_title": "...", "start_time": 120, "similarity": 0.87}]
    sources: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Token / usage metadata for observability (optional)
    prompt_tokens: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )

    completion_tokens: Mapped[Optional[int]] = mapped_column(
        Integer,
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

    session: Mapped["ChatSession"] = relationship(
        back_populates="messages",
    )
