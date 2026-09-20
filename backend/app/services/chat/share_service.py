"""
app.services.chat.share_service — Chat Sharing & Forking Domain Service.

Handles public share link creation, revocation, public read-only retrieval
with OCR/visual mistype correction, and conversation cloning (forking).
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import structlog
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat import ChatMessage, ChatSession
from app.db.models.youtube import YouTubeVideo
from app.schema.chat import (
    ChatMessageResponse,
    ChatSessionResponse,
    ForkChatResponse,
    PublicSharedChatResponse,
    PublicSharedMessage,
    ShareChatResponse,
)
from app.services.chat.chat_utils import get_session_or_404

_logger = structlog.get_logger()


class ShareService:
    """Manages chat sharing, public resolution, and forking."""

    async def create_or_get_share_link(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
    ) -> ShareChatResponse:
        """Generate or activate a public share link for the session."""
        chat_session = await get_session_or_404(session, session_id, user_id)

        if not chat_session.share_token:
            chat_session.share_token = secrets.token_urlsafe(16)

        chat_session.is_shared = True
        chat_session.shared_at = datetime.now(timezone.utc)

        await session.commit()
        await session.refresh(chat_session)

        share_url = f"/share/chat/{chat_session.share_token}"
        _logger.info(
            "chat.session_shared",
            session_id=str(session_id),
            token=chat_session.share_token,
        )

        return ShareChatResponse(
            session_id=chat_session.id,
            share_token=chat_session.share_token,
            share_url=share_url,
            is_shared=True,
            shared_at=chat_session.shared_at,
        )

    async def revoke_share_link(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
    ) -> ChatSessionResponse:
        """Revoke public access to a shared session."""
        chat_session = await get_session_or_404(session, session_id, user_id)
        chat_session.is_shared = False
        await session.commit()
        await session.refresh(chat_session)
        _logger.info("chat.session_share_revoked", session_id=str(session_id))
        return ChatSessionResponse.model_validate(chat_session)

    async def find_shared_session(
        self,
        session: AsyncSession,
        share_token: str,
    ) -> Optional[ChatSession]:
        """Find a shared ChatSession by token with tolerance for case and visual mistypes."""
        token_clean = share_token.strip()

        # 1. Exact match
        stmt = (
            select(ChatSession)
            .where(
                ChatSession.share_token == token_clean,
                ChatSession.is_shared.is_(True),
                ChatSession.is_archived.is_(False),
            )
        )
        res = await session.execute(stmt)
        chat_session = res.scalar_one_or_none()
        if chat_session:
            return chat_session

        # 2. Case-insensitive match
        stmt_ci = (
            select(ChatSession)
            .where(
                func.lower(ChatSession.share_token) == token_clean.lower(),
                ChatSession.is_shared.is_(True),
                ChatSession.is_archived.is_(False),
            )
        )
        res_ci = await session.execute(stmt_ci)
        chat_session = res_ci.scalar_one_or_none()
        if chat_session:
            return chat_session

        # 3. Visual mistype correction (e.g. '7' typed for 'Z'/'z' from visual transcription)
        candidates: list[str] = []
        if "7" in token_clean:
            candidates.append(token_clean.replace("7", "Z"))
            candidates.append(token_clean.replace("7", "z"))
        if "Z" in token_clean or "z" in token_clean:
            candidates.append(token_clean.replace("Z", "7").replace("z", "7"))

        for cand in candidates:
            stmt_cand = (
                select(ChatSession)
                .where(
                    ChatSession.share_token == cand,
                    ChatSession.is_shared.is_(True),
                    ChatSession.is_archived.is_(False),
                )
            )
            res_cand = await session.execute(stmt_cand)
            found = res_cand.scalar_one_or_none()
            if found:
                return found

        return None

    async def get_public_shared_chat(
        self,
        session: AsyncSession,
        share_token: str,
    ) -> PublicSharedChatResponse:
        """
        Public endpoint: fetch a shared chat thread by token without requiring authentication.
        """
        chat_session = await self.find_shared_session(session, share_token)

        if not chat_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shared chat not found or has been revoked.",
            )

        video_title: Optional[str] = None
        youtube_video_id: Optional[str] = None
        if chat_session.video_id:
            video_stmt = select(YouTubeVideo).where(YouTubeVideo.id == chat_session.video_id)
            v_res = await session.execute(video_stmt)
            video = v_res.scalar_one_or_none()
            if video:
                video_title = video.title
                youtube_video_id = video.video_id

        msg_stmt = (
            select(ChatMessage)
            .where(ChatMessage.session_id == chat_session.id)
            .order_by(ChatMessage.created_at.asc())
        )
        m_res = await session.execute(msg_stmt)
        messages = m_res.scalars().all()

        shared_messages = []
        for m in messages:
            parsed = ChatMessageResponse.from_orm_message(m)
            shared_messages.append(
                PublicSharedMessage(
                    id=parsed.id,
                    role=parsed.role,
                    content=parsed.content,
                    sources=parsed.sources,
                    created_at=parsed.created_at,
                )
            )

        return PublicSharedChatResponse(
            id=chat_session.id,
            title=chat_session.title or "Shared Conversation",
            share_token=chat_session.share_token,
            created_at=chat_session.created_at,
            shared_at=chat_session.shared_at,
            video_title=video_title,
            youtube_video_id=youtube_video_id,
            messages=shared_messages,
        )

    async def fork_shared_chat(
        self,
        session: AsyncSession,
        share_token: str,
        user_id: UUID,
    ) -> ForkChatResponse:
        """
        Clone a shared conversation thread into a new private ChatSession for the authenticated user.
        Allows the user to 'Continue this conversation' seamlessly.
        """
        original_session = await self.find_shared_session(session, share_token)

        if not original_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shared chat not found or has been revoked.",
            )

        forked_title = f"{original_session.title or 'Conversation'} (Fork)"
        new_session = ChatSession(
            user_id=user_id,
            title=forked_title[:255],
            video_id=original_session.video_id,
            research_run_id=original_session.research_run_id,
            is_pinned=False,
            is_archived=False,
            message_count=0,
        )
        session.add(new_session)
        await session.flush()

        msg_stmt = (
            select(ChatMessage)
            .where(ChatMessage.session_id == original_session.id)
            .order_by(ChatMessage.created_at.asc())
        )
        m_res = await session.execute(msg_stmt)
        orig_messages = m_res.scalars().all()

        for orig_m in orig_messages:
            new_msg = ChatMessage(
                session_id=new_session.id,
                role=orig_m.role,
                content=orig_m.content,
                sources=orig_m.sources,
                created_at=datetime.now(timezone.utc),
            )
            session.add(new_msg)

        new_session.message_count = len(orig_messages)
        await session.commit()
        await session.refresh(new_session)

        _logger.info(
            "chat.session_forked",
            original_session_id=str(original_session.id),
            new_session_id=str(new_session.id),
            user_id=str(user_id),
        )

        return ForkChatResponse(
            new_session_id=new_session.id,
            title=new_session.title,
            message_count=new_session.message_count,
            created_at=new_session.created_at,
        )
