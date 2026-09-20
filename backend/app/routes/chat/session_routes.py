"""
app.routes.chat.session_routes — Chat Session Management Endpoints.

Handles creation, listing, retrieval, deletion, archiving, renaming,
pinning, and dynamic video scope updating for chat sessions.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.db.database import get_db
from app.db.models.user import User
from app.schema.chat import (
    ChatSessionDetailResponse,
    ChatSessionListResponse,
    ChatSessionResponse,
    CreateChatSessionRequest,
    UpdateSessionScopeRequest,
)
from app.services.auth.security_deps import get_current_user
from app.services.chat import chat_service

router = APIRouter()


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
    Start a new chat session.

    - Provide `video_id` to scope the chat to a specific YouTube video's transcript.
    - Provide `research_run_id` to scope to all videos in a research run.
    - Leave both empty for an unscoped session across all researched videos.
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
    summary="Get a chat session with its full message history",
)
@limiter.limit("60/minute")
async def get_chat_session(
    request: Request,
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Returns the complete message thread for a chat session in chronological order.
    Only accessible by the session owner.
    """
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
