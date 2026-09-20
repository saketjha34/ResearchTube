"""
app.services.chat.session_service — Chat Session Domain Service.

Handles full lifecycle management of chat sessions: creation, listing with
filtering (active, pinned, archived), retrieval with message history,
renaming, pinning, archiving, deleting, and updating video scope.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat import ChatMessage, ChatSession
from app.db.models.youtube import YouTubeVideo
from app.schema.chat import (
    ChatMessageResponse,
    ChatSessionDetailResponse,
    ChatSessionListResponse,
    ChatSessionResponse,
    CreateChatSessionRequest,
    UpdateSessionScopeRequest,
)
from app.services.chat.chat_utils import (
    assert_run_accessible,
    get_session_or_404,
    resolve_and_assert_video,
)

_logger = structlog.get_logger()


class SessionService:
    """Manages chat session lifecycle, metadata, and scoping."""

    async def create_session(
        self,
        session: AsyncSession,
        user_id: UUID,
        payload: CreateChatSessionRequest,
    ) -> ChatSessionResponse:
        """Create a new chat session for the user."""
        _logger.info(
            "chat.create_session",
            user_id=str(user_id),
            video_id=str(payload.video_id) if payload.video_id else None,
            research_run_id=str(payload.research_run_id) if payload.research_run_id else None,
        )

        resolved_video_id: Optional[UUID] = None
        if payload.video_id:
            resolved_video_id = await resolve_and_assert_video(
                session, payload.video_id, user_id
            )

        if payload.research_run_id:
            await assert_run_accessible(session, payload.research_run_id, user_id)

        title = payload.title
        if not title:
            if resolved_video_id:
                video = await session.get(YouTubeVideo, resolved_video_id)
                title = f"Chat: {video.title[:60] if video and video.title else 'Video'}"
            elif payload.research_run_id:
                title = "Research Run Chat"
            else:
                title = "New Chat"

        chat_session = ChatSession(
            user_id=user_id,
            title=title,
            video_id=resolved_video_id,
            research_run_id=payload.research_run_id,
        )

        session.add(chat_session)
        await session.commit()
        await session.refresh(chat_session)

        _logger.info("chat.session_created", session_id=str(chat_session.id))
        return ChatSessionResponse.model_validate(chat_session)

    async def list_sessions(
        self,
        session: AsyncSession,
        user_id: UUID,
        include_archived: bool = False,
        archived_only: bool = False,
    ) -> ChatSessionListResponse:
        """Return all chat sessions for the user, pinned first, then newest updated."""
        stmt = (
            select(ChatSession)
            .where(ChatSession.user_id == user_id)
            .order_by(ChatSession.is_pinned.desc(), ChatSession.updated_at.desc())
        )

        if archived_only:
            stmt = stmt.where(ChatSession.is_archived.is_(True))
        elif not include_archived:
            stmt = stmt.where(ChatSession.is_archived.is_(False))

        result = await session.execute(stmt)
        sessions_list = result.scalars().all()

        return ChatSessionListResponse(
            sessions=[ChatSessionResponse.model_validate(s) for s in sessions_list],
            total=len(sessions_list),
        )

    async def get_session(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
    ) -> ChatSessionDetailResponse:
        """Return a single session with its full message history."""
        chat_session = await get_session_or_404(session, session_id, user_id)

        stmt = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
        )
        result = await session.execute(stmt)
        messages = result.scalars().all()

        msg_responses = [ChatMessageResponse.from_orm_message(m) for m in messages]

        return ChatSessionDetailResponse(
            **ChatSessionResponse.model_validate(chat_session).model_dump(),
            messages=msg_responses,
        )

    async def delete_session(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
    ) -> None:
        """Hard delete a chat session and all its messages (cascade)."""
        chat_session = await get_session_or_404(session, session_id, user_id)
        await session.delete(chat_session)
        await session.commit()
        _logger.info("chat.session_deleted", session_id=str(session_id))

    async def archive_session(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
    ) -> ChatSessionResponse:
        """Toggle archive status of a session."""
        chat_session = await get_session_or_404(session, session_id, user_id)
        chat_session.is_archived = not chat_session.is_archived
        await session.commit()
        await session.refresh(chat_session)
        return ChatSessionResponse.model_validate(chat_session)

    async def toggle_pin_session(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
    ) -> ChatSessionResponse:
        """Toggle pinned status of a session."""
        chat_session = await get_session_or_404(session, session_id, user_id)
        chat_session.is_pinned = not chat_session.is_pinned
        await session.commit()
        await session.refresh(chat_session)
        _logger.info(
            "chat.session_pinned_toggled",
            session_id=str(session_id),
            is_pinned=chat_session.is_pinned,
        )
        return ChatSessionResponse.model_validate(chat_session)

    async def rename_session(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
        new_title: str,
    ) -> ChatSessionResponse:
        """Update the display title of a session."""
        chat_session = await get_session_or_404(session, session_id, user_id)
        chat_session.title = new_title[:255]
        await session.commit()
        await session.refresh(chat_session)
        return ChatSessionResponse.model_validate(chat_session)

    async def update_session_scope(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
        payload: UpdateSessionScopeRequest,
    ) -> ChatSessionResponse:
        """
        Update the video scope of an existing chat session mid-conversation.

        - If `clear_video_scope=True` or `video_id=None`: removes video restriction.
        - If `video_id` is provided: validates ownership and sets the new scope.
        """
        _logger.info(
            "chat.update_session_scope",
            session_id=str(session_id),
            user_id=str(user_id),
            video_id=str(payload.video_id) if payload.video_id else None,
            clear_video_scope=payload.clear_video_scope,
        )

        chat_session = await get_session_or_404(session, session_id, user_id)

        if payload.clear_video_scope or payload.video_id is None:
            chat_session.video_id = None
        else:
            resolved_id = await resolve_and_assert_video(
                session, payload.video_id, user_id
            )
            chat_session.video_id = resolved_id

        await session.commit()
        await session.refresh(chat_session)
        _logger.info(
            "chat.session_scope_updated",
            session_id=str(session_id),
            new_video_id=str(chat_session.video_id) if chat_session.video_id else None,
        )
        return ChatSessionResponse.model_validate(chat_session)
