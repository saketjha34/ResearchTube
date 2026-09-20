"""
app.routes.chat.message_routes — Chat Messaging & Streaming Endpoints.

Handles standard REST message submission and Server-Sent Events (SSE)
real-time streaming with live deltas and source citations.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.db.database import get_db
from app.db.models.user import User
from app.schema.chat import (
    SendMessageRequest,
    SendMessageResponse,
)
from app.services.auth.security_deps import get_current_user
from app.services.chat import chat_service

router = APIRouter()


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
    - `event: sources` -> Citations retrieved from video transcripts
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
