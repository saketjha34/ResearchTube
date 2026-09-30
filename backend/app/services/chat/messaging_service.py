"""
app.services.chat.messaging_service — Chat Messaging & Streaming Domain Service.

Handles user message processing, RAG prompt construction, DualLLM invocation,
and Server-Sent Events (SSE) streaming with live token deltas and source citations.
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import AsyncGenerator, Optional
from uuid import UUID

from starlette.requests import Request

import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import HumanMessage, ToolMessage
from typing import Any
from app.core.config import settings
from app.db.models.chat import ChatMessage, MessageRole
from app.llm.dual import DualLLM
from app.prompts.chat import chat_rag_template
from app.rag.youtube.retriever import YouTubeTranscriptRetriever
from app.schema.chat import (
    ChatMessageResponse,
    SendMessageRequest,
    SendMessageResponse,
)
from app.tools.python_sandbox import execute_python_code, execute_python_code_async
from app.tools.cpp_sandbox import execute_cpp_code, execute_cpp_code_async
from app.tools.web_search import (
    execute_web_search,
    firecrawl_web_search,
    format_web_search_prompt,
    scrape_top_sources,
    search_web_sources,
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


def _normalize_content(content: Any) -> str:
    """Extract plain text string from str or list of block dicts."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and "text" in item:
                parts.append(item["text"])
            elif isinstance(item, str):
                parts.append(item)
        return "".join(parts)
    return str(content or "")


def _format_attachments(images: list[str], artifacts: list[Any]) -> str:
    """Format generated charts and file artifacts as clean markdown attachments."""
    blocks = []
    if artifacts:
        blocks.append("### 📁 Generated Files & Downloads")
        for art in artifacts:
            filename = getattr(art, "filename", "file")
            size_bytes = getattr(art, "size_bytes", 0)
            data_url = getattr(art, "data_url", "")
            size_kb = f"{size_bytes / 1024:.1f} KB" if size_bytes >= 1024 else f"{size_bytes} B"
            blocks.append(f"- [📥 **Download {filename}** ({size_kb})]({data_url})")

    if images:
        blocks.append("### 📊 Generated Visualizations")
        for i, img in enumerate(images, 1):
            blocks.append(f"![Chart {i}]({img})")

    return "\n\n" + "\n\n".join(blocks) if blocks else ""


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
        self._tool_llm = self._llm.bind_tools([execute_python_code, execute_cpp_code])

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
        if payload.scope_mode:
            if payload.scope_mode == "none":
                chat_session.scope_mode = "none"
                chat_session.video_id = None
                _logger.info("chat.scope_switched_to_none", session_id=str(session_id))
            elif payload.scope_mode == "all":
                chat_session.scope_mode = "all"
                chat_session.video_id = None
                _logger.info("chat.scope_switched_to_all", session_id=str(session_id))
            elif payload.scope_mode == "video" and payload.video_id is not None:
                resolved_id = await resolve_and_assert_video(
                    session, payload.video_id, user_id
                )
                chat_session.scope_mode = "video"
                chat_session.video_id = resolved_id
                _logger.info(
                    "chat.scope_switched_to_video",
                    session_id=str(session_id),
                    new_video_id=str(resolved_id),
                )
        elif payload.clear_video_scope:
            chat_session.scope_mode = "none"
            chat_session.video_id = None
            _logger.info("chat.scope_cleared_to_none", session_id=str(session_id))
        elif payload.video_id is not None:
            resolved_id = await resolve_and_assert_video(
                session, payload.video_id, user_id
            )
            chat_session.scope_mode = "video"
            chat_session.video_id = resolved_id
            _logger.info(
                "chat.scope_switched_to_video",
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
        scope_mode = getattr(chat_session, "scope_mode", None) or ("video" if chat_session.video_id else "none")

        if scope_mode == "none":
            # "No Video Scope" -> completely bypass RAG query embedding and vector DB search!
            async def _empty_rag():
                return [], []
            rag_coro = _empty_rag()
        elif scope_mode == "all":
            # "All Library Videos" -> search across all transcripts
            rag_coro = retrieve_chat_context(
                session=session,
                query=payload.message,
                video_id=None,
                research_run_id=chat_session.research_run_id,
                retriever=self._retriever,
            )
        else:  # "video"
            rag_coro = retrieve_chat_context(
                session=session,
                query=payload.message,
                video_id=chat_session.video_id,
                research_run_id=chat_session.research_run_id,
                retriever=self._retriever,
            )

        history, (context_chunks, retrieved_sources), scope_description = await asyncio.gather(
            load_session_history(session, session_id, limit=_MAX_HISTORY_TURNS),
            rag_coro,
            build_scope_description(session, chat_session),
        )

        _logger.info(
            "chat.rag_retrieved",
            session_id=str(session_id),
            scope_mode=scope_mode,
            context_chunks_count=len(context_chunks),
            history_turns=len(history),
        )

        # ── 3b. Dual-Mode Web Search ───────────────────────────
        is_live_query = bool(
            re.search(r'\b(weather|temperature|forecast|rain|climate|news|today|latest|stock|price|score)\b', payload.message, re.IGNORECASE)
        )
        should_search_web = bool(payload.web_search) or (scope_mode != "video" and is_live_query) or bool(
            re.search(r'\b(search\s+(the\s+)?(web|internet|online)|look\s+up\s+online)\b', payload.message, re.IGNORECASE)
        )
        web_search_text: Optional[str] = None

        if should_search_web:
            _logger.info("chat.web_search_triggered", session_id=str(session_id), compulsory=bool(payload.web_search))
            web_search_text, web_sources, engine = await execute_web_search(payload.message, limit=5)
            for ws in web_sources:
                retrieved_sources.append({
                    "chunk_id": f"web_{ws['index']}",
                    "index": len(retrieved_sources) + 1,
                    "source_type": "web",
                    "url": ws["url"],
                    "engine": ws.get("engine", engine),
                    "title": ws["title"],
                    "video_title": ws["title"],
                    "youtube_video_id": None,
                    "start_time": None,
                    "end_time": None,
                    "similarity": None,
                    "text_snippet": ws["snippet"],
                })

        # ── 4. Build prompt ────────────────────────────────────
        prompt_text = self._prompt.render(
            user_message=payload.message,
            scope_description=scope_description,
            context_chunks=context_chunks,
            history=history,
            web_search_results=web_search_text,
        )

        # ── 5. Invoke LLM with Autonomous Tool Execution Loop ───────
        messages = [HumanMessage(content=prompt_text)]
        ai_response = await self._tool_llm.ainvoke(messages)

        max_tool_iterations = 3
        collected_images: list[str] = []
        collected_artifacts: list[Any] = []

        while getattr(ai_response, "tool_calls", None) and max_tool_iterations > 0:
            max_tool_iterations -= 1
            messages.append(ai_response)

            for tool_call in ai_response.tool_calls:
                tool_name = tool_call.get("name")
                tool_args = tool_call.get("args", {})
                tool_id = tool_call.get("id", "call_default")

                if tool_name == "execute_python_code":
                    code = tool_args.get("code", "")
                    _logger.info("chat.tool_execution_start", session_id=str(session_id), tool_id=tool_id)

                    tool_text, exec_res = await execute_python_code_async(
                        code=code,
                    )

                    if exec_res.images:
                        collected_images.extend(exec_res.images)
                    if exec_res.artifacts:
                        collected_artifacts.extend(exec_res.artifacts)

                    messages.append(ToolMessage(content=tool_text, tool_call_id=tool_id))

                elif tool_name == "execute_cpp_code":
                    code = tool_args.get("code", "")
                    stdin = tool_args.get("stdin")
                    _logger.info("chat.cpp_tool_execution_start", session_id=str(session_id), tool_id=tool_id)

                    tool_text, exec_res = await execute_cpp_code_async(
                        code=code,
                        stdin=stdin,
                    )

                    if exec_res.artifacts:
                        collected_artifacts.extend(exec_res.artifacts)

                    messages.append(ToolMessage(content=tool_text, tool_call_id=tool_id))

            ai_response = await self._tool_llm.ainvoke(messages)

        assistant_text = _normalize_content(getattr(ai_response, "content", ""))

        # Append generated charts or downloadable file attachments if produced
        attachment_md = _format_attachments(collected_images, collected_artifacts)
        if attachment_md and attachment_md not in assistant_text:
            assistant_text += "\n\n---\n" + attachment_md

        _logger.info(
            "chat.llm_response",
            session_id=str(session_id),
            response_len=len(assistant_text),
            images_count=len(collected_images),
            artifacts_count=len(collected_artifacts),
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
            if payload.scope_mode:
                if payload.scope_mode == "none":
                    chat_session.scope_mode = "none"
                    chat_session.video_id = None
                    _logger.info("chat.stream_scope_switched_to_none", session_id=str(session_id))
                elif payload.scope_mode == "all":
                    chat_session.scope_mode = "all"
                    chat_session.video_id = None
                    _logger.info("chat.stream_scope_switched_to_all", session_id=str(session_id))
                elif payload.scope_mode == "video" and payload.video_id is not None:
                    resolved_id = await resolve_and_assert_video(
                        session, payload.video_id, user_id
                    )
                    chat_session.scope_mode = "video"
                    chat_session.video_id = resolved_id
                    _logger.info(
                        "chat.stream_scope_switched_to_video",
                        session_id=str(session_id),
                        new_video_id=str(resolved_id),
                    )
            elif payload.clear_video_scope:
                chat_session.scope_mode = "none"
                chat_session.video_id = None
                _logger.info("chat.stream_scope_cleared_to_none", session_id=str(session_id))
            elif payload.video_id is not None:
                resolved_id = await resolve_and_assert_video(
                    session, payload.video_id, user_id
                )
                chat_session.scope_mode = "video"
                chat_session.video_id = resolved_id
                _logger.info(
                    "chat.stream_scope_switched_to_video",
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
            scope_mode = getattr(chat_session, "scope_mode", None) or ("video" if chat_session.video_id else "none")

            if scope_mode == "none":
                # "No Video Scope" -> completely bypass RAG query embedding and vector DB search!
                async def _empty_rag():
                    return [], []
                rag_coro = _empty_rag()
            elif scope_mode == "all":
                # "All Library Videos" -> search across all transcripts
                rag_coro = retrieve_chat_context(
                    session=session,
                    query=payload.message,
                    video_id=None,
                    research_run_id=chat_session.research_run_id,
                    retriever=self._retriever,
                )
            else:  # "video"
                rag_coro = retrieve_chat_context(
                    session=session,
                    query=payload.message,
                    video_id=chat_session.video_id,
                    research_run_id=chat_session.research_run_id,
                    retriever=self._retriever,
                )

            history, (context_chunks, retrieved_sources), scope_description = await asyncio.gather(
                load_session_history(session, session_id, limit=_MAX_HISTORY_TURNS),
                rag_coro,
                build_scope_description(session, chat_session),
            )

            _logger.info(
                "chat.stream_rag_retrieved",
                session_id=str(session_id),
                scope_mode=scope_mode,
                context_chunks_count=len(context_chunks),
                history_turns=len(history),
            )

            # If client disconnected during retrieval:
            if request and await request.is_disconnected():
                _logger.info("chat.stream_cancelled_after_retrieval", session_id=str(session_id))
                await session.delete(user_msg)
                await session.commit()
                return

            # 3b. Dual-Mode Web Search
            is_live_query = bool(
                re.search(r'\b(weather|temperature|forecast|rain|climate|news|today|latest|stock|price|score)\b', payload.message, re.IGNORECASE)
            )
            should_search_web = bool(payload.web_search) or (scope_mode != "video" and is_live_query) or bool(
                re.search(r'\b(search\s+(the\s+)?(web|internet|online)|look\s+up\s+online)\b', payload.message, re.IGNORECASE)
            )
            web_search_text: Optional[str] = None

            if should_search_web:
                _logger.info("chat.stream_web_search_triggered", session_id=str(session_id), compulsory=bool(payload.web_search))

                # Step 1: Emit searching status
                status_payload = {
                    "status": "searching",
                    "message": "Searching the live web...",
                }
                yield f"event: status\ndata: {json.dumps(status_payload)}\n\n"

                clean_sources, engine_used = await search_web_sources(payload.message, limit=5)

                if request and await request.is_disconnected():
                    _logger.info("chat.stream_cancelled_after_web_search", session_id=str(session_id))
                    await session.delete(user_msg)
                    await session.commit()
                    return

                if clean_sources:
                    for ws in clean_sources:
                        retrieved_sources.append({
                            "chunk_id": f"web_{ws['index']}",
                            "index": len(retrieved_sources) + 1,
                            "source_type": "web",
                            "url": ws["url"],
                            "engine": ws.get("engine", engine_used),
                            "title": ws["title"],
                            "video_title": ws["title"],
                            "youtube_video_id": None,
                            "start_time": None,
                            "end_time": None,
                            "similarity": None,
                            "text_snippet": ws["snippet"],
                        })

                    # Step 2: Emit scraping status
                    status_payload = {
                        "status": "scraping",
                        "message": "Reading verified page content...",
                    }
                    yield f"event: status\ndata: {json.dumps(status_payload)}\n\n"

                    scraped_pages = await scrape_top_sources(clean_sources, max_pages=3)

                    if request and await request.is_disconnected():
                        _logger.info("chat.stream_cancelled_after_scraping", session_id=str(session_id))
                        await session.delete(user_msg)
                        await session.commit()
                        return

                    web_search_text = format_web_search_prompt(payload.message, clean_sources, scraped_pages)
                else:
                    web_search_text = (
                        f"Web search for '{payload.message}' could not retrieve live results due to a temporary issue. "
                        "Please answer using your existing knowledge."
                    )

            # 4. Render prompt template
            prompt_text = self._prompt.render(
                user_message=payload.message,
                scope_description=scope_description,
                context_chunks=context_chunks,
                history=history,
                web_search_results=web_search_text,
            )

            # 5. Stream LLM tokens with Autonomous Tool Calling Loop
            messages = [HumanMessage(content=prompt_text)]
            token_list: list[str] = []
            was_cancelled = False
            collected_images: list[str] = []
            collected_artifacts: list[Any] = []
            any_sandbox_executed = False

            try:
                full_msg = None
                async for chunk in self._tool_llm.astream_raw(messages):
                    if request and await request.is_disconnected():
                        _logger.info("chat.stream_cancelled_by_client", session_id=str(session_id))
                        was_cancelled = True
                        break

                    full_msg = chunk if full_msg is None else full_msg + chunk

                    # If not building a tool call and text is present, stream delta immediately
                    if not getattr(chunk, "tool_call_chunks", None) and chunk.content:
                        text_delta = _normalize_content(chunk.content)
                        if text_delta:
                            token_list.append(text_delta)
                            delta_payload = {"text": text_delta}
                            yield f"event: delta\ndata: {json.dumps(delta_payload)}\n\n"

                # Check if model requested autonomous tool execution
                max_stream_tool_turns = 2
                while getattr(full_msg, "tool_calls", None) and max_stream_tool_turns > 0 and not was_cancelled:
                    max_stream_tool_turns -= 1
                    messages.append(full_msg)

                    for tool_call in full_msg.tool_calls:
                        if request and await request.is_disconnected():
                            was_cancelled = True
                            break

                        tool_name = tool_call.get("name")
                        tool_args = tool_call.get("args", {})
                        tool_id = tool_call.get("id", "call_default")

                        if tool_name == "execute_python_code":
                            any_sandbox_executed = True
                            code = tool_args.get("code", "")

                            # Step 1: Emit running SSE status
                            status_payload = {
                                "status": "executing_code",
                                "message": "Running Python code...",
                                "code": code[:200] if len(code) > 200 else code,
                            }
                            yield f"event: status\ndata: {json.dumps(status_payload)}\n\n"

                            tool_text, exec_res = await execute_python_code_async(
                                code=code,
                            )

                            if exec_res.images:
                                collected_images.extend(exec_res.images)
                            if exec_res.artifacts:
                                collected_artifacts.extend(exec_res.artifacts)

                            # Step 2: Emit completed SSE status
                            status_payload = {
                                "status": "code_executed",
                                "message": f"Execution completed ({exec_res.duration_ms:.0f}ms)",
                                "duration_ms": exec_res.duration_ms,
                                "images_count": len(exec_res.images),
                                "artifacts_count": len(exec_res.artifacts),
                                "error": exec_res.error,
                            }
                            yield f"event: status\ndata: {json.dumps(status_payload)}\n\n"

                            messages.append(ToolMessage(content=tool_text, tool_call_id=tool_id))

                        elif tool_name == "execute_cpp_code":
                            any_sandbox_executed = True
                            code = tool_args.get("code", "")
                            stdin = tool_args.get("stdin")

                            # Step 1: Emit running SSE status
                            status_payload = {
                                "status": "executing_code",
                                "message": "Compiling and running C++ code...",
                                "code": code[:200] if len(code) > 200 else code,
                            }
                            yield f"event: status\ndata: {json.dumps(status_payload)}\n\n"

                            tool_text, exec_res = await execute_cpp_code_async(
                                code=code,
                                stdin=stdin,
                            )

                            if exec_res.artifacts:
                                collected_artifacts.extend(exec_res.artifacts)

                            # Step 2: Emit completed SSE status
                            status_payload = {
                                "status": "code_executed",
                                "message": f"Execution completed ({exec_res.duration_ms:.0f}ms)",
                                "duration_ms": exec_res.duration_ms,
                                "artifacts_count": len(exec_res.artifacts),
                                "error": exec_res.error,
                            }
                            yield f"event: status\ndata: {json.dumps(status_payload)}\n\n"

                            messages.append(ToolMessage(content=tool_text, tool_call_id=tool_id))

                    if was_cancelled:
                        break

                    # Step 3: Emit generating status
                    status_payload = {
                        "status": "generating",
                        "message": "Generating response...",
                    }
                    yield f"event: status\ndata: {json.dumps(status_payload)}\n\n"

                    # Stream synthesized answer tokens
                    token_list.clear()
                    full_msg = None
                    normal_llm = self._llm.get_llm()
                    async for token in normal_llm.astream(messages):
                        if request and await request.is_disconnected():
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

            # Append generated charts or downloadable files if produced
            attachment_md = _format_attachments(collected_images, collected_artifacts)
            if attachment_md:
                attachment_text = "\n\n---\n" + attachment_md
                token_list.append(attachment_text)
                delta_payload = {"text": attachment_text}
                yield f"event: delta\ndata: {json.dumps(delta_payload)}\n\n"

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
                "sandbox_executed": bool(any_sandbox_executed or collected_images or collected_artifacts),
                "artifacts_count": len(collected_artifacts),
                "images_count": len(collected_images),
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
