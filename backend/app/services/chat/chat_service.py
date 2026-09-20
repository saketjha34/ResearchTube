"""
app.services.chat.chat_service — Unified Chat Service Facade.

Maintains backward-compatible interface for all chat capabilities by delegating
to specialized domain services:
- SessionService: Session CRUD, listing, pinning, archiving, and video scoping
- MessagingService: RAG prompt construction, DualLLM generation, SSE streaming
- ShareService: Share token generation, public threads, OCR tolerance, forking
- GreetingService: Personalized welcome greetings and available video discovery
"""

from __future__ import annotations

from typing import Any, AsyncGenerator, List, Optional, Tuple, Union
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat import ChatSession
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
from app.services.chat.greeting_service import GreetingService
from app.services.chat.messaging_service import MessagingService
from app.services.chat.session_service import SessionService
from app.services.chat.share_service import ShareService
from app.services.chat.chat_utils import (
    _MAX_HISTORY_TURNS,
    assert_run_accessible,
    build_scope_description,
    get_session_or_404,
    load_session_history,
    resolve_and_assert_video,
    retrieve_chat_context,
)

_logger = structlog.get_logger()


class ChatService:
    """
    Unified entry point for all chat domain operations.
    Delegates to SessionService, MessagingService, ShareService, and GreetingService.
    """

    _instance: Optional[ChatService] = None

    def __new__(cls) -> ChatService:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if hasattr(self, "_initialized"):
            return
        self._initialized = True

        self.sessions = SessionService()
        self.messaging = MessagingService()
        self.sharing = ShareService()
        self.greetings = GreetingService()
        _logger.info("chat_service.initialized")

    # ── Available Videos & Greetings ───────────────────────────

    async def list_available_videos(
        self,
        session: AsyncSession,
        user_id: UUID,
    ) -> AvailableVideosResponse:
        return await self.greetings.list_available_videos(session, user_id)

    def get_chat_greeting(
        self,
        user: Optional[Any] = None,
        name_override: Optional[str] = None,
    ) -> ChatGreetingResponse:
        return self.greetings.get_chat_greeting(user=user, name_override=name_override)

    # ── Session Lifecycle ──────────────────────────────────────

    async def create_session(
        self,
        session: AsyncSession,
        user_id: UUID,
        payload: CreateChatSessionRequest,
    ) -> ChatSessionResponse:
        return await self.sessions.create_session(session, user_id, payload)

    async def list_sessions(
        self,
        session: AsyncSession,
        user_id: UUID,
        include_archived: bool = False,
        archived_only: bool = False,
    ) -> ChatSessionListResponse:
        return await self.sessions.list_sessions(
            session=session,
            user_id=user_id,
            include_archived=include_archived,
            archived_only=archived_only,
        )

    async def get_session(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
    ) -> ChatSessionDetailResponse:
        return await self.sessions.get_session(session, user_id, session_id)

    async def delete_session(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
    ) -> None:
        return await self.sessions.delete_session(session, user_id, session_id)

    async def archive_session(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
    ) -> ChatSessionResponse:
        return await self.sessions.archive_session(session, user_id, session_id)

    async def toggle_pin_session(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
    ) -> ChatSessionResponse:
        return await self.sessions.toggle_pin_session(session, user_id, session_id)

    async def rename_session(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
        new_title: str,
    ) -> ChatSessionResponse:
        return await self.sessions.rename_session(session, user_id, session_id, new_title)

    async def update_session_scope(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
        payload: UpdateSessionScopeRequest,
    ) -> ChatSessionResponse:
        return await self.sessions.update_session_scope(session, user_id, session_id, payload)

    # ── Sharing & Forking ──────────────────────────────────────

    async def create_or_get_share_link(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
    ) -> ShareChatResponse:
        return await self.sharing.create_or_get_share_link(session, user_id, session_id)

    async def revoke_share_link(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
    ) -> ChatSessionResponse:
        return await self.sharing.revoke_share_link(session, user_id, session_id)

    async def get_public_shared_chat(
        self,
        session: AsyncSession,
        share_token: str,
    ) -> PublicSharedChatResponse:
        return await self.sharing.get_public_shared_chat(session, share_token)

    async def fork_shared_chat(
        self,
        session: AsyncSession,
        share_token: str,
        user_id: UUID,
    ) -> ForkChatResponse:
        return await self.sharing.fork_shared_chat(session, share_token, user_id)

    # ── Messaging & Streaming ──────────────────────────────────

    async def send_message(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
        payload: SendMessageRequest,
    ) -> SendMessageResponse:
        return await self.messaging.send_message(session, user_id, session_id, payload)

    async def stream_message(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
        payload: SendMessageRequest,
    ) -> AsyncGenerator[str, None]:
        async for chunk in self.messaging.stream_message(session, user_id, session_id, payload):
            yield chunk

    # ── Backward Compatibility Helpers ─────────────────────────

    async def _get_session_or_404(
        self, session: AsyncSession, session_id: UUID, user_id: UUID
    ) -> ChatSession:
        return await get_session_or_404(session, session_id, user_id)

    async def _load_history(
        self, session: AsyncSession, session_id: UUID, limit: int = _MAX_HISTORY_TURNS
    ) -> List[dict[str, str]]:
        return await load_session_history(session, session_id, limit)

    async def _retrieve_context(
        self,
        session: AsyncSession,
        query: str,
        video_id: Optional[UUID],
        research_run_id: Optional[UUID],
    ) -> Tuple[List[dict[str, Any]], List[dict[str, Any]]]:
        return await retrieve_chat_context(
            session=session,
            query=query,
            video_id=video_id,
            research_run_id=research_run_id,
            retriever=self.messaging._retriever,
        )

    async def _build_scope_description(
        self, session: AsyncSession, chat_session: ChatSession
    ) -> Optional[str]:
        return await build_scope_description(session, chat_session)

    async def _resolve_and_assert_video(
        self, session: AsyncSession, video_identifier: Union[UUID, str], user_id: UUID
    ) -> UUID:
        return await resolve_and_assert_video(session, video_identifier, user_id)

    async def _assert_run_accessible(
        self, session: AsyncSession, run_id: UUID, user_id: UUID
    ) -> None:
        return await assert_run_accessible(session, run_id, user_id)

    async def _find_shared_session(
        self, session: AsyncSession, share_token: str
    ) -> Optional[ChatSession]:
        return await self.sharing.find_shared_session(session, share_token)


# ============================================================
# SINGLETON INSTANCE
# ============================================================

chat_service = ChatService()
