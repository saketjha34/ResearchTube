"""
Chat Routes — REST API endpoints for the ResearchTube AI chat feature.

Route map:
    GET    /chat/available-videos                      — list all researched videos user can scope to
    POST   /chat/sessions                              — create a new chat session
    GET    /chat/sessions                              — list all chat sessions for the user
    GET    /chat/sessions/{session_id}                 — get a session with full message history
    DELETE /chat/sessions/{session_id}                 — delete a session (cascade messages)
    PATCH  /chat/sessions/{session_id}/archive         — toggle archive flag
    PATCH  /chat/sessions/{session_id}/rename          — rename a session
    PATCH  /chat/sessions/{session_id}/scope           — update the session's video scope mid-conversation
    POST   /chat/sessions/{session_id}/messages        — send a message and get AI response
    POST   /chat/sessions/{session_id}/messages/stream — stream AI response via SSE
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.db.database import get_db
from app.db.models.user import User
from app.schema.chat import (
    AvailableVideosResponse,
    ChatGreetingResponse,
    ChatSessionDetailResponse,
    ChatSessionListResponse,
    ChatSessionResponse,
    CreateChatSessionRequest,
    ForkChatResponse,
    PublicSharedChatResponse,
    SendMessageRequest,
    SendMessageResponse,
    ShareChatResponse,
    UpdateSessionScopeRequest,
)
from app.services.auth.security_deps import get_current_user, get_optional_user
from app.services.chat import chat_service

router = APIRouter()


# ============================================================
# GET /chat/greeting
# ============================================================

@router.get(
    "/greeting",
    response_model=ChatGreetingResponse,
    summary="Get personalized greeting headline for new chat interface",
)
@limiter.limit("60/minute")
async def get_chat_greeting(
    request: Request,
    name: Optional[str] = None,
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Returns a personalized greeting sentence (Claude / ChatGPT style)
    interpolated with the user's display name, chosen from 30 curated templates.
    """
    return chat_service.get_chat_greeting(user=current_user, name_override=name)


# ============================================================
# GET /chat/available-videos
# ============================================================

@router.get(
    "/available-videos",
    response_model=AvailableVideosResponse,
    summary="List researched videos available for chat scoping",
)
@limiter.limit("30/minute")
async def list_available_videos(
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Returns all YouTube videos that the authenticated user has previously
    researched (i.e., their transcripts are ingested in the vector store).

    Use the returned `db_id` as `video_id` when creating a scoped chat session.
    """
    return await chat_service.list_available_videos(
        session=session,
        user_id=current_user.id,
    )


# ============================================================
# POST /chat/sessions
# ============================================================

@router.post(
    "/sessions",
    response_model=ChatSessionResponse,
    status_code=201,
    summary="Create a new chat session",
)
@limiter.limit("20/minute")
async def create_chat_session(
    request: Request,
    payload: CreateChatSessionRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Create a new persistent chat session.

    - Leave both `video_id` and `research_run_id` empty for a **general** AI assistant.
    - Provide `video_id` to scope the chat to a specific YouTube video's transcript.
    - Provide `research_run_id` to scope to all videos in a research run.
    """
    return await chat_service.create_session(
        session=session,
        user_id=current_user.id,
        payload=payload,
    )


# ============================================================
# GET /chat/sessions
# ============================================================

@router.get(
    "/sessions",
    response_model=ChatSessionListResponse,
    summary="List all chat sessions",
)
@limiter.limit("30/minute")
async def list_chat_sessions(
    request: Request,
    include_archived: bool = False,
    archived_only: bool = False,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Returns all chat sessions for the authenticated user, newest first.
    Pass `include_archived=true` to include archived sessions.
    Pass `archived_only=true` to return only archived sessions.
    """
    return await chat_service.list_sessions(
        session=session,
        user_id=current_user.id,
        include_archived=include_archived,
        archived_only=archived_only,
    )


# ============================================================
# GET /chat/sessions/{session_id}
# ============================================================

@router.get(
    "/sessions/{session_id}",
    response_model=ChatSessionDetailResponse,
    summary="Get a session with full message history",
)
@limiter.limit("30/minute")
async def get_chat_session(
    request: Request,
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Returns a single chat session along with its complete message history."""
    return await chat_service.get_session(
        session=session,
        user_id=current_user.id,
        session_id=session_id,
    )


# ============================================================
# DELETE /chat/sessions/{session_id}
# ============================================================

@router.delete(
    "/sessions/{session_id}",
    status_code=204,
    summary="Delete a chat session",
)
@limiter.limit("20/minute")
async def delete_chat_session(
    request: Request,
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Permanently delete a chat session and all its messages."""
    await chat_service.delete_session(
        session=session,
        user_id=current_user.id,
        session_id=session_id,
    )


# ============================================================
# PATCH /chat/sessions/{session_id}/archive
# ============================================================

@router.patch(
    "/sessions/{session_id}/archive",
    response_model=ChatSessionResponse,
    summary="Toggle archive status of a session",
)
@limiter.limit("20/minute")
async def archive_chat_session(
    request: Request,
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Toggle the archive flag of a chat session."""
    return await chat_service.archive_session(
        session=session,
        user_id=current_user.id,
        session_id=session_id,
    )


# ============================================================
# PATCH /chat/sessions/{session_id}/rename
# ============================================================

class RenameRequest(CreateChatSessionRequest):
    """Minimal request body for rename — only title is needed."""
    title: str  # type: ignore[override]


@router.patch(
    "/sessions/{session_id}/rename",
    response_model=ChatSessionResponse,
    summary="Rename a chat session",
)
@limiter.limit("20/minute")
async def rename_chat_session(
    request: Request,
    session_id: UUID,
    payload: RenameRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Update the display title of a chat session."""
    return await chat_service.rename_session(
        session=session,
        user_id=current_user.id,
        session_id=session_id,
        new_title=payload.title,
    )


# ============================================================
# PATCH /chat/sessions/{session_id}/scope
# ============================================================

@router.patch(
    "/sessions/{session_id}/scope",
    response_model=ChatSessionResponse,
    summary="Update the video scope of a chat session mid-conversation",
)
@limiter.limit("30/minute")
async def update_session_scope(
    request: Request,
    session_id: UUID,
    payload: UpdateSessionScopeRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Dynamically change the video scope of an ongoing chat session.

    - Provide `video_id` (DB UUID or YouTube video ID) to restrict RAG retrieval
      to a specific video's transcript for all future turns in this session.
    - Set `clear_video_scope=True` to remove the restriction, enabling retrieval
      across the user's entire video library.

    The new scope persists in the database and applies to every subsequent message
    in this session until changed again.
    """
    return await chat_service.update_session_scope(
        session=session,
        user_id=current_user.id,
        session_id=session_id,
        payload=payload,
    )


# ============================================================
# POST /chat/sessions/{session_id}/messages
# ============================================================

@router.post(
    "/sessions/{session_id}/messages",
    response_model=SendMessageResponse,
    summary="Send a message and receive an AI response",
)
@limiter.limit("15/minute")
async def send_message(
    request: Request,
    session_id: UUID,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Send a user message in the specified chat session.

    The backend will:
    1. Retrieve relevant transcript context via RAG (pgvector).
    2. Invoke the AI (OpenAI primary, Gemini fallback) with conversation history.
    3. Persist both the user message and the AI reply.
    4. Return both messages with optional source citations.
    """
    return await chat_service.send_message(
        session=session,
        user_id=current_user.id,
        session_id=session_id,
        payload=payload,
    )


# ============================================================
# POST /chat/sessions/{session_id}/messages/stream
# ============================================================

@router.post(
    "/sessions/{session_id}/messages/stream",
    summary="Send a message and stream the AI response via Server-Sent Events (SSE)",
)
@limiter.limit("15/minute")
async def stream_message(
    request: Request,
    session_id: UUID,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Send a user message in the specified chat session and stream the AI reply.

    Yields SSE events:
    - `event: user` -> User message stored in DB
    - `event: delta` -> Chunks of AI text as generated
    - `event: done` -> Final assistant message record with source citations
    - `event: error` -> Any runtime error during processing
    """
    return StreamingResponse(
        chat_service.stream_message(
            session=session,
            user_id=current_user.id,
            session_id=session_id,
            payload=payload,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ============================================================
# PATCH /chat/sessions/{session_id}/pin
# ============================================================

@router.patch(
    "/sessions/{session_id}/pin",
    response_model=ChatSessionResponse,
    summary="Toggle pinned status of a chat session",
)
@limiter.limit("30/minute")
async def toggle_pin_session(
    request: Request,
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Toggle the pinned status of a chat session.
    Pinned sessions are sorted to the top of the session list.
    """
    return await chat_service.toggle_pin_session(
        session=session,
        user_id=current_user.id,
        session_id=session_id,
    )


# ============================================================
# POST /chat/sessions/{session_id}/share
# ============================================================

@router.post(
    "/sessions/{session_id}/share",
    response_model=ShareChatResponse,
    summary="Generate or get a public share link for a chat session",
)
@limiter.limit("20/minute")
async def share_chat_session(
    request: Request,
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Generates or retrieves a unique public share token for the session.
    Anyone with the link can view the conversation.
    """
    return await chat_service.create_or_get_share_link(
        session=session,
        user_id=current_user.id,
        session_id=session_id,
    )


# ============================================================
# DELETE /chat/sessions/{session_id}/share
# ============================================================

@router.delete(
    "/sessions/{session_id}/share",
    response_model=ChatSessionResponse,
    summary="Revoke public access to a shared chat session",
)
@limiter.limit("20/minute")
async def revoke_shared_chat_session(
    request: Request,
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Revokes public sharing so the shared URL no longer works.
    """
    return await chat_service.revoke_share_link(
        session=session,
        user_id=current_user.id,
        session_id=session_id,
    )


# ============================================================
# GET /chat/share/{share_token} (PUBLIC — NO AUTH REQUIRED)
# ============================================================

@router.get(
    "/share/{share_token}",
    response_model=PublicSharedChatResponse,
    summary="View a publicly shared chat session (public access)",
)
@limiter.limit("60/minute")
async def get_public_shared_chat(
    request: Request,
    share_token: str,
    session: AsyncSession = Depends(get_db),
):
    """
    Publicly accessible endpoint (no JWT required) to view a shared conversation thread.
    Returns the message thread and video scope details.
    """
    return await chat_service.get_public_shared_chat(
        session=session,
        share_token=share_token,
    )


# ============================================================
# POST /chat/share/{share_token}/fork (AUTH REQUIRED)
# ============================================================

@router.post(
    "/share/{share_token}/fork",
    response_model=ForkChatResponse,
    status_code=201,
    summary="Fork a shared chat session into the authenticated user's account",
)
@limiter.limit("15/minute")
async def fork_shared_chat(
    request: Request,
    share_token: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Duplicates the shared conversation thread into a brand new private chat session
    for the current user so they can continue asking questions.
    """
    return await chat_service.fork_shared_chat(
        session=session,
        share_token=share_token,
        user_id=current_user.id,
    )


