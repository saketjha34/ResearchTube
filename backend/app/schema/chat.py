"""
Chat Pydantic Schemas.

Validation schemas for the Chat API endpoints.

Request schemas:  CreateChatSessionRequest, SendMessageRequest
Response schemas: ChatSessionResponse, ChatMessageResponse,
                  ChatHistoryResponse, AvailableVideoItem
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ============================================================
# AVAILABLE VIDEOS
# ============================================================

class AvailableVideoItem(BaseModel):
    """
    A video that the authenticated user has already researched
    and can scope a chat session to.
    """

    db_id: UUID = Field(..., description="Internal DB UUID of YouTubeVideo")
    youtube_video_id: str = Field(..., description="YouTube video ID (e.g. dQw4w9WgXcQ)")
    title: Optional[str] = Field(None, description="Video title")
    channel: Optional[str] = Field(None, description="Channel name")
    url: Optional[str] = Field(None, description="YouTube watch URL")

    model_config = {"from_attributes": True}


class AvailableVideosResponse(BaseModel):
    """List of videos available to scope a chat session."""

    videos: List[AvailableVideoItem]
    total: int


# ============================================================
# REQUEST SCHEMAS
# ============================================================

class CreateChatSessionRequest(BaseModel):
    """
    Create a new persistent chat session.

    Both `video_id` and `research_run_id` are optional:
    - If neither is provided  → general ResearchTube AI assistant
    - If `video_id` is set    → chat is scoped to that video's transcript
    - If `research_run_id` is set → chat is scoped to all videos in that run
    """

    title: Optional[str] = Field(
        None,
        max_length=255,
        description="Optional display title for the session. Auto-generated if omitted.",
    )

    video_id: Optional[Union[UUID, str]] = Field(
        None,
        description="DB UUID or YouTube video ID (e.g. RwPhhU7RSSs) of the YouTubeVideo to scope the chat to.",
    )

    research_run_id: Optional[UUID] = Field(
        None,
        description="DB UUID of the ResearchRun to scope the chat to.",
    )

    @field_validator("video_id", mode="before")
    @classmethod
    def empty_str_to_none_video_id(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            if not s:
                return None
            try:
                return UUID(s)
            except ValueError:
                return s
        return v

    @field_validator("research_run_id", mode="before")
    @classmethod
    def empty_str_to_none_run_id(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("title", mode="before")
    @classmethod
    def empty_str_to_none_title(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v


class SendMessageRequest(BaseModel):
    """
    Send a user message in an existing chat session.
    The backend will respond with the assistant reply and optional source citations.
    """

    message: str = Field(
        ...,
        min_length=1,
        max_length=8000,
        description="The user's message text.",
    )


# ============================================================
# RESPONSE SCHEMAS
# ============================================================

class SourceCitation(BaseModel):
    """A single RAG source chunk reference."""

    chunk_id: str
    video_title: Optional[str] = None
    youtube_video_id: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    similarity: Optional[float] = None
    text_snippet: Optional[str] = None  # first 200 chars of the chunk


class ChatMessageResponse(BaseModel):
    """Single message in a chat session (user or assistant)."""

    id: UUID
    session_id: UUID
    role: str
    content: str
    sources: Optional[List[SourceCitation]] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_message(cls, msg: Any) -> "ChatMessageResponse":
        """Convert ORM ChatMessage → response, parsing JSON sources."""
        sources: Optional[List[SourceCitation]] = None
        if msg.sources:
            try:
                raw = json.loads(msg.sources)
                sources = [SourceCitation(**s) for s in raw]
            except Exception:
                sources = None

        return cls(
            id=msg.id,
            session_id=msg.session_id,
            role=msg.role.value if hasattr(msg.role, "value") else msg.role,
            content=msg.content,
            sources=sources,
            created_at=msg.created_at,
        )


class ChatSessionResponse(BaseModel):
    """Summary of a chat session (used in list and single-session views)."""

    id: UUID
    title: Optional[str]
    video_id: Optional[UUID]
    research_run_id: Optional[UUID]
    is_archived: bool
    is_pinned: bool = False
    is_shared: bool = False
    share_token: Optional[str] = None
    shared_at: Optional[datetime] = None
    message_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionDetailResponse(ChatSessionResponse):
    """Full chat session including all messages."""

    messages: List[ChatMessageResponse] = []


class ChatSessionListResponse(BaseModel):
    """Paginated list of chat sessions."""

    sessions: List[ChatSessionResponse]
    total: int


class SendMessageResponse(BaseModel):
    """
    Response after sending a user message.
    Returns both the user message echo and the assistant reply.
    """

    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse


# ============================================================
# SHARING & FORKING SCHEMAS
# ============================================================

class ShareChatResponse(BaseModel):
    """Response returned when generating/toggling a public share link."""

    session_id: UUID
    share_token: str
    share_url: str
    is_shared: bool
    shared_at: Optional[datetime] = None


class PublicSharedMessage(BaseModel):
    """A message in a publicly shared conversation (read-only)."""

    id: UUID
    role: str
    content: str
    sources: Optional[List[SourceCitation]] = None
    created_at: datetime


class PublicSharedChatResponse(BaseModel):
    """Publicly accessible view of a shared conversation thread."""

    id: UUID
    title: Optional[str]
    share_token: str
    created_at: datetime
    shared_at: Optional[datetime] = None
    video_title: Optional[str] = None
    youtube_video_id: Optional[str] = None
    messages: List[PublicSharedMessage] = []


class ForkChatResponse(BaseModel):
    """Response returned when forking a shared conversation into user's account."""

    new_session_id: UUID
    title: str
    message_count: int
    created_at: datetime


# ============================================================
# GREETING SCHEMAS
# ============================================================

class ChatGreetingResponse(BaseModel):
    """Personalized greeting response for new chat sessions."""

    greeting: str
    user_name: str
    sentences: List[str]


