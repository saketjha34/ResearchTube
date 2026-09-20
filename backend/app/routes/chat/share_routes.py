"""
app.routes.chat.share_routes — Chat Sharing & Forking Endpoints.

Handles generating public share links, revoking public access, viewing
publicly shared threads (no auth required), and forking shared conversations.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.db.database import get_db
from app.db.models.user import User
from app.schema.chat import (
    ChatSessionResponse,
    ForkChatResponse,
    PublicSharedChatResponse,
    ShareChatResponse,
)
from app.services.auth.security_deps import get_current_user
from app.services.chat import chat_service

router = APIRouter()


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
