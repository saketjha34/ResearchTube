"""
app.routes.chat.video_routes — Available Videos & Greeting Endpoints.

Provides endpoints for listing user-researched videos for scoping and
fetching personalized welcome greetings.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.db.database import get_db
from app.db.models.user import User
from app.schema.chat import AvailableVideosResponse, ChatGreetingResponse
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
