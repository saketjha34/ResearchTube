"""
ChatService — Singleton service for the ResearchTube AI chat system.

Responsibilities:
    - Create and manage persistent ChatSession records.
    - Handle multi-turn message persistence (ChatMessage).
    - Perform RAG retrieval over ingested YouTube transcript chunks.
    - Build prompts via Jinja2 templates and invoke the DualLLM.
    - Provide available-videos listing scoped to the authenticated user.

Architecture:
    User request → ChatService → RAG retriever → DualLLM → persist messages → return response

Usage:
    from app.services.chat import chat_service
    response = await chat_service.send_message(session, user, session_id, payload)
"""

from __future__ import annotations

import json
import random
import secrets
import textwrap
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, List, Optional, Union
from uuid import UUID

import structlog
from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.chat import ChatSession, ChatMessage, MessageRole
from app.db.models.youtube import YouTubeVideo, ResearchVideo, TranscriptChunk
from app.llm.dual import DualLLM
from app.prompts.chat import ChatRAGPromptTemplate, chat_rag_template
from app.rag.youtube.retriever import YouTubeTranscriptRetriever
from app.schema.chat import (
    AvailableVideoItem,
    AvailableVideosResponse,
    ChatGreetingResponse,
    ChatMessageResponse,
    ChatSessionDetailResponse,
    ChatSessionListResponse,
    ChatSessionResponse,
    CreateChatSessionRequest,
    ForkChatResponse,
    PublicSharedChatResponse,
    PublicSharedMessage,
    SendMessageRequest,
    SendMessageResponse,
    ShareChatResponse,
    SourceCitation,
    UpdateSessionScopeRequest,
)


_logger = structlog.get_logger("chat_service")

# Maximum number of conversation turns to include in the prompt history
_MAX_HISTORY_TURNS = 8

# Maximum number of RAG chunks to retrieve (fetch a few extra to allow threshold filtering)
_RAG_TOP_K = 5

# Minimum cosine similarity to include a chunk in the prompt (0.0–1.0)
# Unrelated queries (math, general code, chit-chat) score below 0.35 and are cleanly dropped
_RAG_MIN_SIMILARITY = 0.20

# Maximum sources to include after threshold filtering (top 3 sources only)
_RAG_MAX_SOURCES = 3

# How many characters of a chunk to expose as a snippet in source citations
_SNIPPET_CHARS = 180


class ChatService:
    """
    Singleton service for the ResearchTube AI chat feature.

    Usage:
        from app.services.chat import chat_service
        sessions = await chat_service.list_sessions(db, user_id)
    """

    _instance: "ChatService | None" = None

    def __new__(cls) -> "ChatService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        # Avoid re-initialising on subsequent __new__ calls
        if hasattr(self, "_initialized"):
            return
        self._initialized = True

        self._llm = DualLLM()
        self._retriever = YouTubeTranscriptRetriever()
        self._prompt = chat_rag_template
        _logger.info("chat_service.initialized")

    # ===========================================================
    # 1. AVAILABLE VIDEOS
    # ===========================================================

    async def list_available_videos(
        self,
        session: AsyncSession,
        user_id: UUID,
    ) -> AvailableVideosResponse:
        """
        Return all YouTube videos that the user has researched.

        These are the videos whose transcripts are ingested in pgvector and can be
        used to scope a chat session.
        """
        _logger.info("chat.list_available_videos", user_id=str(user_id))

        # Join youtube_videos → research_videos → research_runs filtered by user_id
        from app.db.models.youtube import ResearchRun

        stmt = (
            select(YouTubeVideo)
            .join(ResearchVideo, ResearchVideo.video_id == YouTubeVideo.id)
            .join(ResearchRun, ResearchRun.id == ResearchVideo.research_run_id)
            .where(ResearchRun.user_id == user_id)
            .where(ResearchRun.status == "completed")
            .distinct()
            .order_by(YouTubeVideo.created_at.desc())
        )

        result = await session.execute(stmt)
        videos = result.scalars().all()

        items = [
            AvailableVideoItem(
                db_id=v.id,
                youtube_video_id=v.video_id,
                title=v.title,
                channel=v.channel,
                url=v.url,
            )
            for v in videos
        ]

        return AvailableVideosResponse(videos=items, total=len(items))

    # ===========================================================
    # 2. SESSION MANAGEMENT
    # ===========================================================

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

        # Validate and resolve video_id if provided (supports DB UUID or YouTube video ID string)
        resolved_video_id: Optional[UUID] = None
        if payload.video_id:
            resolved_video_id = await self._resolve_and_assert_video(
                session, payload.video_id, user_id
            )

        # Validate research_run_id ownership if provided
        if payload.research_run_id:
            await self._assert_run_accessible(session, payload.research_run_id, user_id)

        # Auto-generate title if not provided
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
        chat_session = await self._get_session_or_404(session, session_id, user_id)

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
        chat_session = await self._get_session_or_404(session, session_id, user_id)
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
        chat_session = await self._get_session_or_404(session, session_id, user_id)
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
        chat_session = await self._get_session_or_404(session, session_id, user_id)
        chat_session.is_pinned = not chat_session.is_pinned
        await session.commit()
        await session.refresh(chat_session)
        _logger.info("chat.session_pinned_toggled", session_id=str(session_id), is_pinned=chat_session.is_pinned)
        return ChatSessionResponse.model_validate(chat_session)

    async def rename_session(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
        new_title: str,
    ) -> ChatSessionResponse:
        """Update the display title of a session."""
        chat_session = await self._get_session_or_404(session, session_id, user_id)
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

        chat_session = await self._get_session_or_404(session, session_id, user_id)

        if payload.clear_video_scope or payload.video_id is None:
            chat_session.video_id = None
        else:
            resolved_id = await self._resolve_and_assert_video(
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

    async def create_or_get_share_link(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
    ) -> ShareChatResponse:
        """
        Generate or activate a public share link for the session.
        """
        chat_session = await self._get_session_or_404(session, session_id, user_id)

        if not chat_session.share_token:
            chat_session.share_token = secrets.token_urlsafe(16)

        chat_session.is_shared = True
        chat_session.shared_at = datetime.now(timezone.utc)

        await session.commit()
        await session.refresh(chat_session)

        share_url = f"/share/chat/{chat_session.share_token}"
        _logger.info("chat.session_shared", session_id=str(session_id), token=chat_session.share_token)

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
        chat_session = await self._get_session_or_404(session, session_id, user_id)
        chat_session.is_shared = False
        await session.commit()
        await session.refresh(chat_session)
        _logger.info("chat.session_share_revoked", session_id=str(session_id))
        return ChatSessionResponse.model_validate(chat_session)

    async def _find_shared_session(
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
        chat_session = await self._find_shared_session(session, share_token)

        if not chat_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shared chat not found or has been revoked.",
            )

        # Load video context if scoped
        video_title: Optional[str] = None
        youtube_video_id: Optional[str] = None
        if chat_session.video_id:
            video_stmt = select(YouTubeVideo).where(YouTubeVideo.id == chat_session.video_id)
            v_res = await session.execute(video_stmt)
            video = v_res.scalar_one_or_none()
            if video:
                video_title = video.title
                youtube_video_id = video.video_id

        # Load messages
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
        chat_session = await self._find_shared_session(session, share_token)
        original_session = chat_session

        if not original_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shared chat not found or has been revoked.",
            )

        # Create new session under the user's account
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

        # Duplicate messages into the new session
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

    # ===========================================================
    # 3. SEND MESSAGE — Core RAG + LLM logic
    # ===========================================================

    async def send_message(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
        payload: SendMessageRequest,
    ) -> SendMessageResponse:
        """
        Handle a full user → assistant turn:

        1. Validate session ownership.
        2. Persist the user message.
        3. Concurrently: load history + perform RAG retrieval + build scope description.
        4. Build the prompt via Jinja2 template.
        5. Invoke DualLLM (OpenAI primary, Gemini fallback).
        6. Persist the assistant message with RAG source citations.
        7. Return both messages.
        """
        import asyncio

        _logger.info(
            "chat.send_message",
            session_id=str(session_id),
            user_id=str(user_id),
        )

        # ── 1. Validate ────────────────────────────────────────
        chat_session = await self._get_session_or_404(session, session_id, user_id)

        # ── 1b. Atomic scope switch (if requested) ─────────────
        if payload.clear_video_scope:
            chat_session.video_id = None
            _logger.info("chat.scope_cleared", session_id=str(session_id))
        elif payload.video_id is not None:
            resolved_id = await self._resolve_and_assert_video(
                session, payload.video_id, user_id
            )
            chat_session.video_id = resolved_id
            _logger.info(
                "chat.scope_switched",
                session_id=str(session_id),
                new_video_id=str(resolved_id),
            )

        # ── 1c. Auto-unarchive if session was archived ──────────
        if chat_session.is_archived:
            chat_session.is_archived = False
            _logger.info("chat.auto_unarchived", session_id=str(session_id))

        # ── 2. Persist user message ────────────────────────────
        user_msg = ChatMessage(
            session_id=session_id,
            role=MessageRole.USER,
            content=payload.message,
        )
        session.add(user_msg)
        await session.flush()  # get the ID without full commit

        # ── 3. Parallel: history + RAG + scope description ─────
        history, (context_chunks, retrieved_sources), scope_description = await asyncio.gather(
            self._load_history(session, session_id, limit=_MAX_HISTORY_TURNS),
            self._retrieve_context(
                session=session,
                query=payload.message,
                video_id=chat_session.video_id,
                research_run_id=chat_session.research_run_id,
            ),
            self._build_scope_description(session, chat_session),
        )

        _logger.info(
            "chat.rag_retrieved",
            session_id=str(session_id),
            context_chunks_count=len(context_chunks),
            history_turns=len(history),
        )

        # ── 4. Build prompt ────────────────────────────────────
        prompt_text = self._prompt.render(
            user_message=payload.message,
            scope_description=scope_description,
            context_chunks=context_chunks,
            history=history,
        )

        # ── 5. Invoke LLM ──────────────────────────────────────
        llm = self._llm.get_llm()
        ai_response = await llm.ainvoke(prompt_text)

        # Extract text content
        if hasattr(ai_response, "content"):
            assistant_text = ai_response.content
        else:
            assistant_text = str(ai_response)

        _logger.info(
            "chat.llm_response",
            session_id=str(session_id),
            response_len=len(assistant_text),
        )

        # ── 6. Persist assistant message ───────────────────────
        sources_json = json.dumps(retrieved_sources) if retrieved_sources else None

        assistant_msg = ChatMessage(
            session_id=session_id,
            role=MessageRole.ASSISTANT,
            content=assistant_text,
            sources=sources_json,
        )
        session.add(assistant_msg)

        # Update session message count and updated_at
        chat_session.message_count = chat_session.message_count + 2
        await session.commit()
        await session.refresh(user_msg)
        await session.refresh(assistant_msg)

        return SendMessageResponse(
            user_message=ChatMessageResponse.from_orm_message(user_msg),
            assistant_message=ChatMessageResponse.from_orm_message(assistant_msg),
        )

    async def stream_message(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
        payload: SendMessageRequest,
    ) -> AsyncGenerator[str, None]:
        """
        Handle streaming user -> assistant conversation via Server-Sent Events (SSE).

        Yields SSE formatted text:
            event: user\ndata: {...}\n\n
            event: delta\ndata: {"text": "..."}\n\n
            event: done\ndata: {...}\n\n
            event: error\ndata: {"detail": "..."}\n\n
        """
        import asyncio

        _logger.info(
            "chat.stream_message",
            session_id=str(session_id),
            user_id=str(user_id),
        )

        try:
            # 1. Validate session
            chat_session = await self._get_session_or_404(session, session_id, user_id)

            # 1b. Atomic scope switch (if requested)
            if payload.clear_video_scope:
                chat_session.video_id = None
                _logger.info("chat.scope_cleared", session_id=str(session_id))
            elif payload.video_id is not None:
                resolved_id = await self._resolve_and_assert_video(
                    session, payload.video_id, user_id
                )
                chat_session.video_id = resolved_id
                _logger.info(
                    "chat.scope_switched",
                    session_id=str(session_id),
                    new_video_id=str(resolved_id),
                )

            # 1c. Auto-unarchive if session was archived
            if chat_session.is_archived:
                chat_session.is_archived = False
                _logger.info("chat.auto_unarchived", session_id=str(session_id))

            # 2. Persist user message
            user_msg = ChatMessage(
                session_id=session_id,
                role=MessageRole.USER,
                content=payload.message,
            )
            session.add(user_msg)
            await session.commit()
            await session.refresh(user_msg)

            # Yield user event
            user_event = {
                "id": str(user_msg.id),
                "role": "user",
                "content": user_msg.content,
                "created_at": user_msg.created_at.isoformat() if user_msg.created_at else "",
            }
            yield f"event: user\ndata: {json.dumps(user_event)}\n\n"

            # 3. Parallel: load history + RAG retrieval + scope description
            history, (context_chunks, retrieved_sources), scope_description = await asyncio.gather(
                self._load_history(session, session_id, limit=_MAX_HISTORY_TURNS),
                self._retrieve_context(
                    session=session,
                    query=payload.message,
                    video_id=chat_session.video_id,
                    research_run_id=chat_session.research_run_id,
                ),
                self._build_scope_description(session, chat_session),
            )

            # 4. Render prompt template
            prompt_text = self._prompt.render(
                user_message=payload.message,
                scope_description=scope_description,
                context_chunks=context_chunks,
                history=history,
            )

            # 5. Stream LLM tokens
            llm = self._llm.get_llm()
            token_list: list[str] = []

            async for token in llm.astream(prompt_text):
                if token:
                    token_list.append(token)
                    delta_payload = {"text": token}
                    yield f"event: delta\ndata: {json.dumps(delta_payload)}\n\n"

            full_text = "".join(token_list)

            # 6. Persist assistant message with sources
            sources_json = json.dumps(retrieved_sources) if retrieved_sources else None
            assistant_msg = ChatMessage(
                session_id=session_id,
                role=MessageRole.ASSISTANT,
                content=full_text,
                sources=sources_json,
            )
            session.add(assistant_msg)
            chat_session.message_count = chat_session.message_count + 2
            await session.commit()
            await session.refresh(assistant_msg)

            # 7. Yield done event
            done_event = {
                "id": str(assistant_msg.id),
                "role": "assistant",
                "sources": retrieved_sources if retrieved_sources else None,
                "created_at": assistant_msg.created_at.isoformat() if assistant_msg.created_at else "",
            }
            yield f"event: done\ndata: {json.dumps(done_event)}\n\n"

        except Exception as exc:
            _logger.error("chat.stream_error", session_id=str(session_id), error=str(exc))
            err_payload = {"detail": str(exc)}
            yield f"event: error\ndata: {json.dumps(err_payload)}\n\n"


    # ===========================================================
    # PRIVATE HELPERS
    # ===========================================================

    async def _get_session_or_404(
        self,
        session: AsyncSession,
        session_id: UUID,
        user_id: UUID,
    ) -> ChatSession:
        """Fetch a ChatSession, raising 404 if not found or not owned by user."""
        result = await session.execute(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == user_id,
            )
        )
        chat_session = result.scalar_one_or_none()
        if not chat_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat session not found.",
            )
        return chat_session

    async def _load_history(
        self,
        session: AsyncSession,
        session_id: UUID,
        limit: int = _MAX_HISTORY_TURNS,
    ) -> List[dict[str, str]]:
        """
        Load the last `limit` messages (user + assistant turns) for the prompt.
        Returns list of dicts with 'role' and 'content'.
        """
        # Subquery: get the most recent `limit` messages by created_at DESC
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        msgs = list(reversed(result.scalars().all()))  # chronological order

        return [
            {
                "role": m.role.value if hasattr(m.role, "value") else m.role,
                "content": m.content,
            }
            for m in msgs
        ]

    async def _retrieve_context(
        self,
        session: AsyncSession,
        query: str,
        video_id: Optional[UUID],
        research_run_id: Optional[UUID],
    ) -> tuple[List[dict[str, Any]], List[dict[str, Any]]]:
        """
        Perform pgvector similarity search using the session scope.

        Only returns chunks above _RAG_MIN_SIMILARITY threshold,
        capped at _RAG_MAX_SOURCES. Completely irrelevant queries
        return ([], []) silently — the LLM answers from general knowledge.

        Returns:
            context_chunks: List of chunk dicts for the prompt template.
            retrieved_sources: Serialisable list for ChatMessage.sources JSON.
        """
        try:
            # Determine which video DB IDs to filter by
            db_video_ids: list[UUID] | None = None

            if video_id:
                db_video_ids = [video_id]
            elif research_run_id:
                stmt = select(ResearchVideo.video_id).where(
                    ResearchVideo.research_run_id == research_run_id
                )
                result = await session.execute(stmt)
                db_video_ids = list(result.scalars().all())

            raw_chunks = await self._retriever.similarity_search(
                session=session,
                query=query,
                top_k=_RAG_TOP_K,
                db_video_ids=db_video_ids,
                research_run_id=research_run_id if research_run_id else None,
            )

        except Exception as exc:
            _logger.warning("chat.rag_failed", error=str(exc))
            return [], []

        # ── Threshold filter — discard low-relevance chunks ────
        raw_chunks = [
            c for c in raw_chunks
            if (c.get("similarity") or 0.0) >= _RAG_MIN_SIMILARITY
        ][:_RAG_MAX_SOURCES]

        if not raw_chunks:
            return [], []

        # ── Enrich with video metadata ─────────────────────────
        video_cache: dict[str, Any] = {}

        context_chunks: List[dict[str, Any]] = []
        retrieved_sources: List[dict[str, Any]] = []

        for chunk in raw_chunks:
            vid_id_str = chunk.get("video_id")
            if vid_id_str and vid_id_str not in video_cache:
                try:
                    vid = await session.get(YouTubeVideo, UUID(vid_id_str))
                    video_cache[vid_id_str] = vid
                except Exception:
                    video_cache[vid_id_str] = None

            vid = video_cache.get(vid_id_str)

            context_chunks.append({
                "chunk_id": chunk["chunk_id"],
                "video_id": vid_id_str,
                "video_title": vid.title if vid else None,
                "youtube_video_id": vid.video_id if vid else None,
                "start_time": chunk.get("start_time"),
                "end_time": chunk.get("end_time"),
                "text": chunk["text"],
                "similarity": chunk.get("similarity"),
            })

            retrieved_sources.append({
                "chunk_id": chunk["chunk_id"],
                "video_title": vid.title if vid else None,
                "youtube_video_id": vid.video_id if vid else None,
                "start_time": chunk.get("start_time"),
                "end_time": chunk.get("end_time"),
                "similarity": round(chunk["similarity"], 4) if chunk.get("similarity") else None,
                "text_snippet": chunk["text"][:_SNIPPET_CHARS] if chunk.get("text") else None,
            })

        _logger.info(
            "chat.rag_chunks_used",
            count=len(context_chunks),
            min_sim=_RAG_MIN_SIMILARITY,
        )
        return context_chunks, retrieved_sources

    async def _build_scope_description(
        self,
        session: AsyncSession,
        chat_session: ChatSession,
    ) -> Optional[str]:
        """Generate a human-readable scope description for the prompt."""
        if chat_session.video_id:
            vid = await session.get(YouTubeVideo, chat_session.video_id)
            if vid:
                return f"Scoped to video: '{vid.title}' by {vid.channel or 'Unknown Channel'}"
            return "Scoped to a specific video."

        if chat_session.research_run_id:
            return f"Scoped to research run {str(chat_session.research_run_id)[:8]}…"

        return None

    async def _resolve_and_assert_video(
        self,
        session: AsyncSession,
        video_identifier: Union[UUID, str],
        user_id: UUID,
    ) -> UUID:
        """
        Confirm the video exists in the user's researched history and return its DB UUID.
        Supports both DB UUID and YouTube video ID string (e.g. 'RwPhhU7RSSs').
        """
        from app.db.models.youtube import ResearchRun

        target_uuid: Optional[UUID] = None
        if isinstance(video_identifier, UUID):
            target_uuid = video_identifier
        elif isinstance(video_identifier, str):
            try:
                target_uuid = UUID(video_identifier.strip())
            except ValueError:
                target_uuid = None

        if target_uuid is not None:
            stmt = (
                select(YouTubeVideo.id)
                .join(ResearchVideo, ResearchVideo.video_id == YouTubeVideo.id)
                .join(ResearchRun, ResearchRun.id == ResearchVideo.research_run_id)
                .where(YouTubeVideo.id == target_uuid)
                .where(ResearchRun.user_id == user_id)
                .limit(1)
            )
        else:
            stmt = (
                select(YouTubeVideo.id)
                .join(ResearchVideo, ResearchVideo.video_id == YouTubeVideo.id)
                .join(ResearchRun, ResearchRun.id == ResearchVideo.research_run_id)
                .where(YouTubeVideo.video_id == str(video_identifier).strip())
                .where(ResearchRun.user_id == user_id)
                .limit(1)
            )

        result = await session.execute(stmt)
        resolved_id = result.scalar_one_or_none()
        if not resolved_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Video '{video_identifier}' not found in your research history.",
            )
        return resolved_id

    async def _assert_run_accessible(
        self,
        session: AsyncSession,
        run_id: UUID,
        user_id: UUID,
    ) -> None:
        """Confirm the research run belongs to the user."""
        from app.db.models.youtube import ResearchRun

        stmt = select(ResearchRun.id).where(
            ResearchRun.id == run_id,
            ResearchRun.user_id == user_id,
        )
        result = await session.execute(stmt)
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Research run not found in your history.",
            )

    # ── Personalized Greeting for New Chat (Claude / ChatGPT style) ───

    def get_chat_greeting(
        self,
        user: Optional[Any] = None,
        name_override: Optional[str] = None,
    ) -> ChatGreetingResponse:
        """
        Returns a personalized greeting sentence interpolated with user's name,
        chosen from 30 curated Claude & ChatGPT style prompts for video research.
        """
        display_name = "there"
        if name_override and name_override.strip():
            display_name = name_override.strip()
        elif user:
            full_name = getattr(user, "full_name", None)
            username = getattr(user, "username", None)
            email = getattr(user, "email", None)

            if full_name and str(full_name).strip():
                display_name = str(full_name).strip().split()[0]
            elif username and str(username).strip():
                display_name = str(username).strip()
            elif email and "@" in str(email):
                display_name = str(email).split("@")[0].capitalize()

        interpolated = [tmpl.format(name=display_name) for tmpl in GREETING_TEMPLATES]
        chosen = random.choice(interpolated)

        return ChatGreetingResponse(
            greeting=chosen,
            user_name=display_name,
            sentences=interpolated,
        )


# ============================================================
# CURATED GREETING SENTENCE TEMPLATES (30 Variations)
# ============================================================

GREETING_TEMPLATES = [
    "Hey {name}, what are we researching today?",
    "Good to see you, {name}. What are we exploring?",
    "Hey {name}, what's on your mind today?",
    "Ready when you are, {name}. Where to start?",
    "Welcome back, {name}. Where shall we begin?",
    "Hey {name}, what concepts should we unpack?",
    "How can I help synthesize your research, {name}?",
    "Hey {name}, what problem are we solving?",
    "Hello {name}, what shall we synthesize today?",
    "Hey {name}, let's explore your video research.",
    "What would you like to discover today, {name}?",
    "Hey {name}, ready to dive into the transcripts?",
    "Where shall we start our deep dive, {name}?",
    "Hey {name}, what insights are we looking for?",
    "Let's learn something new today, {name}.",
    "Hey {name}, what topics are we investigating?",
    "How can I assist your research today, {name}?",
    "Hey {name}, ready to turn videos into answers?",
    "What shall we uncover together, {name}?",
    "Hey {name}, which videos are we breaking down?",
    "Ready to research, {name}. What's the plan?",
    "Hey {name}, let's find answers in your videos.",
    "What topic are we exploring today, {name}?",
    "Hey {name}, what's the research focus today?",
    "Good to see you back, {name}. Where to start?",
    "Hey {name}, ask anything from your video library.",
    "Hey {name}, ready to extract key takeaways?",
    "What questions can I answer for you, {name}?",
    "Hey {name}, what are we learning about today?",
    "Welcome {name}, let's get into the details.",
]


# ============================================================
# SINGLETON INSTANCE
# ============================================================

chat_service = ChatService()

