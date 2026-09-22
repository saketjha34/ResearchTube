"""
app.services.chat.messaging_service — Chat Messaging & Streaming Domain Service.

Handles user message processing, RAG prompt construction, DualLLM invocation,
and Server-Sent Events (SSE) streaming with live token deltas and source citations.
"""

from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator, Optional
from uuid import UUID

from starlette.requests import Request

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat import ChatMessage, MessageRole
from app.llm.dual import DualLLM
from app.prompts.chat import chat_rag_template
from app.rag.youtube.retriever import YouTubeTranscriptRetriever
from app.schema.chat import (
    ChatMessageResponse,
    SendMessageRequest,
    SendMessageResponse,
)
from app.services.chat.chat_utils import (
    _MAX_HISTORY_TURNS,
    build_scope_description,
    get_session_or_404,
    load_session_history,
    resolve_and_assert_video,
    retrieve_chat_context,
)

_logger = structlog.get_logger()


class MessagingService:
    """Manages chat messages, LLM generation, and SSE streaming."""

    def __init__(
        self,
        llm: DualLLM | None = None,
        retriever: YouTubeTranscriptRetriever | None = None,
    ) -> None:
        self._llm = llm or DualLLM()
        self._retriever = retriever or YouTubeTranscriptRetriever()
        self._prompt = chat_rag_template

    async def send_message(
        self,
        session: AsyncSession,
        user_id: UUID,
        session_id: UUID,
        payload: SendMessageRequest,
    ) -> SendMessageResponse:
        """
        Handle a full user → assistant turn (non-streaming):

        1. Validate session ownership.
        2. Atomic video scope switch (if requested).
        3. Auto-unarchive if session was archived.
        4. Persist the user message.
        5. Concurrently: load history + perform RAG retrieval + build scope description.
        6. Build the prompt via Jinja2 template.
        7. Invoke DualLLM (OpenAI primary, Gemini fallback).
        8. Persist the assistant message with RAG source citations.
        9. Return both messages.
        """
        _logger.info(
            "chat.send_message",
            session_id=str(session_id),
            user_id=str(user_id),
        )

        # ── 1. Validate ────────────────────────────────────────
        chat_session = await get_session_or_404(session, session_id, user_id)

        # ── 1b. Atomic scope switch (if requested) ─────────────
        if payload.clear_video_scope:
            chat_session.video_id = None
            _logger.info("chat.scope_cleared", session_id=str(session_id))
        elif payload.video_id is not None:
            resolved_id = await resolve_and_assert_video(
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
        await session.flush()

        # ── 3. Parallel: history + RAG + scope description ─────
        history, (context_chunks, retrieved_sources), scope_description = await asyncio.gather(
            load_session_history(session, session_id, limit=_MAX_HISTORY_TURNS),
            retrieve_chat_context(
                session=session,
                query=payload.message,
                video_id=chat_session.video_id,
                research_run_id=chat_session.research_run_id,
                retriever=self._retriever,
            ),
            build_scope_description(session, chat_session),
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
        sources_json = json.dumps(retrieved_sources, default=str) if retrieved_sources else None

        assistant_msg = ChatMessage(
            session_id=session_id,
            role=MessageRole.ASSISTANT,
            content=assistant_text,
            sources=sources_json,
        )
        session.add(assistant_msg)

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
        request: Optional[Request] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Handle streaming user -> assistant conversation via Server-Sent Events (SSE).

        Yields SSE formatted text:
            event: user\ndata: {...}\n\n
            event: delta\ndata: {"text": "..."}\n\n
            event: done\ndata: {...}\n\n
            event: error\ndata: {"detail": "..."}\n\n
        """
        _logger.info(
            "chat.stream_message",
            session_id=str(session_id),
            user_id=str(user_id),
        )

        try:
            # 1. Validate session
            chat_session = await get_session_or_404(session, session_id, user_id)

            # 1b. Atomic scope switch (if requested)
            if payload.clear_video_scope:
                chat_session.video_id = None
                _logger.info("chat.scope_cleared", session_id=str(session_id))
            elif payload.video_id is not None:
                resolved_id = await resolve_and_assert_video(
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

            # If client disconnected immediately after user message:
            if request and await request.is_disconnected():
                _logger.info("chat.stream_cancelled_before_llm", session_id=str(session_id))
                await session.delete(user_msg)
                await session.commit()
                return

            # 3. Parallel: load history + RAG retrieval + scope description
            history, (context_chunks, retrieved_sources), scope_description = await asyncio.gather(
                load_session_history(session, session_id, limit=_MAX_HISTORY_TURNS),
                retrieve_chat_context(
                    session=session,
                    query=payload.message,
                    video_id=chat_session.video_id,
                    research_run_id=chat_session.research_run_id,
                    retriever=self._retriever,
                ),
                build_scope_description(session, chat_session),
            )

            # If client disconnected during retrieval:
            if request and await request.is_disconnected():
                _logger.info("chat.stream_cancelled_after_retrieval", session_id=str(session_id))
                await session.delete(user_msg)
                await session.commit()
                return

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
            was_cancelled = False

            try:
                async for token in llm.astream(prompt_text):
                    if request and await request.is_disconnected():
                        _logger.info("chat.stream_cancelled_by_client", session_id=str(session_id))
                        was_cancelled = True
                        break

                    if token:
                        token_list.append(token)
                        delta_payload = {"text": token}
                        yield f"event: delta\ndata: {json.dumps(delta_payload)}\n\n"
            except (asyncio.CancelledError, GeneratorExit):
                _logger.info("chat.stream_token_loop_cancelled", session_id=str(session_id))
                was_cancelled = True

            # If the stream was cancelled or client stopped: neglect the request completely
            if was_cancelled or (request and await request.is_disconnected()):
                _logger.info("chat.stream_neglected_by_stop", session_id=str(session_id))
                try:
                    await session.delete(user_msg)
                    await session.commit()
                except Exception as del_err:
                    _logger.warning("chat.cleanup_user_msg_failed", error=str(del_err))
                return

            full_text = "".join(token_list)

            # 6. Persist assistant message with sources
            sources_json = json.dumps(retrieved_sources, default=str) if retrieved_sources else None
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

        except (asyncio.CancelledError, GeneratorExit):
            _logger.info("chat.stream_top_level_cancelled", session_id=str(session_id))
            try:
                if "user_msg" in locals():
                    await session.delete(user_msg)
                    await session.commit()
            except Exception:
                pass
            return
        except Exception as exc:
            _logger.error("chat.stream_error", session_id=str(session_id), error=str(exc))
            err_payload = {"detail": str(exc)}
            yield f"event: error\ndata: {json.dumps(err_payload)}\n\n"
