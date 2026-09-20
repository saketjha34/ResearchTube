"""
app.services.chat.chat_utils — Chat Domain Utilities & RAG Retrieval.

Consolidates internal domain helpers for chat operations:
- pgvector transcript similarity search, relevance thresholding & source citation building
- Video & research run scope resolution and ownership assertions
- Session retrieval with user authorization and conversation history loading
"""

from __future__ import annotations

from typing import Any, List, Optional, Tuple, Union
from uuid import UUID

import structlog
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat import ChatMessage, ChatSession
from app.db.models.youtube import ResearchRun, ResearchVideo, TranscriptChunk, YouTubeVideo
from app.rag.youtube.retriever import YouTubeTranscriptRetriever

_logger = structlog.get_logger()

# Retrieval & history parameters
_MAX_HISTORY_TURNS = 10
_RAG_TOP_K = 5
_RAG_MIN_SIMILARITY = 0.25
_RAG_MAX_SOURCES = 5
_SNIPPET_CHARS = 240


# ============================================================
# 1. SESSION & HISTORY HELPERS
# ============================================================

async def get_session_or_404(
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


async def load_session_history(
    session: AsyncSession,
    session_id: UUID,
    limit: int = _MAX_HISTORY_TURNS,
) -> List[dict[str, str]]:
    """
    Load the last `limit` messages (user + assistant turns) for the prompt.
    Returns list of dicts with 'role' and 'content' in chronological order.
    """
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    msgs = list(reversed(result.scalars().all()))

    return [
        {
            "role": m.role.value if hasattr(m.role, "value") else m.role,
            "content": m.content,
        }
        for m in msgs
    ]


# ============================================================
# 2. SCOPE & OWNERSHIP HELPERS
# ============================================================

async def resolve_and_assert_video(
    session: AsyncSession,
    video_identifier: Union[UUID, str],
    user_id: UUID,
) -> UUID:
    """
    Confirm the video exists in the user's researched history and return its DB UUID.
    Supports both DB UUID and YouTube video ID string (e.g. 'RwPhhU7RSSs').
    """
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


async def assert_run_accessible(
    session: AsyncSession,
    run_id: UUID,
    user_id: UUID,
) -> None:
    """Confirm the research run belongs to the user."""
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


async def build_scope_description(
    session: AsyncSession,
    chat_session: ChatSession,
) -> Optional[str]:
    """Generate a human-readable scope description for the prompt."""
    if chat_session.video_id:
        vid = await session.get(YouTubeVideo, chat_session.video_id)
        if vid:
            desc_snippet = f" | Summary/Description: {vid.description[:250].strip()}..." if vid.description else ""
            return f"Scoped to video: '{vid.title}' by {vid.channel or 'Unknown Channel'}{desc_snippet}"
        return "Scoped to a specific video."

    if chat_session.research_run_id:
        return f"Scoped to research run {str(chat_session.research_run_id)[:8]}…"

    return None


# ============================================================
# 3. RAG CONTEXT RETRIEVAL HELPER
# ============================================================

async def retrieve_chat_context(
    session: AsyncSession,
    query: str,
    video_id: Optional[UUID] = None,
    research_run_id: Optional[UUID] = None,
    retriever: Optional[YouTubeTranscriptRetriever] = None,
) -> Tuple[List[dict[str, Any]], List[dict[str, Any]]]:
    """
    Perform pgvector similarity search using the session scope.

    Only returns chunks above _RAG_MIN_SIMILARITY threshold, capped at
    _RAG_MAX_SOURCES. If similarity search returns no chunks for a video-scoped
    chat (e.g. broad overview questions), falls back to the video's opening chunks.

    Returns:
        context_chunks: List of chunk dicts for the prompt template.
        retrieved_sources: Serialisable list for ChatMessage.sources JSON.
    """
    if retriever is None:
        retriever = YouTubeTranscriptRetriever()

    try:
        db_video_ids: list[UUID] | None = None

        if video_id:
            db_video_ids = [video_id]
        elif research_run_id:
            stmt = select(ResearchVideo.video_id).where(
                ResearchVideo.research_run_id == research_run_id
            )
            result = await session.execute(stmt)
            db_video_ids = list(result.scalars().all())

        raw_chunks = await retriever.similarity_search(
            session=session,
            query=query,
            top_k=_RAG_TOP_K,
            db_video_ids=db_video_ids,
            research_run_id=research_run_id if research_run_id else None,
        )

    except Exception as exc:
        _logger.warning("chat.rag_failed", error=str(exc))
        raw_chunks = []

    filtered_chunks = [
        c for c in raw_chunks
        if (c.get("similarity") or 0.0) >= _RAG_MIN_SIMILARITY
    ][:_RAG_MAX_SOURCES]

    # Video-scoped fallback: if vector search yielded no high-similarity chunks for a video chat,
    # supply the opening transcript chunks so the user gets accurate overview answers & sources.
    if not filtered_chunks and video_id:
        stmt = (
            select(TranscriptChunk)
            .where(TranscriptChunk.video_id == video_id)
            .order_by(TranscriptChunk.chunk_index.asc())
            .limit(3)
        )
        fallback_res = await session.execute(stmt)
        fallback_rows = list(fallback_res.scalars().all())
        if fallback_rows:
            _logger.info("chat.rag_video_intro_fallback", video_id=str(video_id), count=len(fallback_rows))
            filtered_chunks = [
                {
                    "chunk_id": str(c.id),
                    "video_id": str(c.video_id),
                    "chunk_index": c.chunk_index,
                    "text": c.text,
                    "language": c.language,
                    "start_time": c.start_time,
                    "end_time": c.end_time,
                    "similarity": 0.50,  # default score for opening overview
                }
                for c in fallback_rows
            ]

    if not filtered_chunks:
        return [], []

    video_cache: dict[str, Any] = {}
    context_chunks: List[dict[str, Any]] = []
    retrieved_sources: List[dict[str, Any]] = []

    for idx, chunk in enumerate(filtered_chunks):
        vid_id_str = chunk.get("video_id")
        if vid_id_str and vid_id_str not in video_cache:
            try:
                vid = await session.get(YouTubeVideo, UUID(vid_id_str))
                video_cache[vid_id_str] = vid
            except Exception:
                video_cache[vid_id_str] = None

        vid = video_cache.get(vid_id_str)

        context_chunks.append({
            "chunk_id": str(chunk["chunk_id"]),
            "video_id": vid_id_str,
            "video_title": vid.title if vid else None,
            "youtube_video_id": vid.video_id if vid else None,
            "start_time": chunk.get("start_time"),
            "end_time": chunk.get("end_time"),
            "text": chunk["text"],
            "similarity": chunk.get("similarity"),
        })

        retrieved_sources.append({
            "chunk_id": str(chunk["chunk_id"]),
            "index": idx + 1,
            "video_title": vid.title if vid else None,
            "youtube_video_id": vid.video_id if vid else None,
            "start_time": chunk.get("start_time"),
            "end_time": chunk.get("end_time"),
            "similarity": round(chunk["similarity"], 4) if chunk.get("similarity") is not None else None,
            "text_snippet": chunk["text"][:_SNIPPET_CHARS] if chunk.get("text") else None,
        })

    _logger.info(
        "chat.rag_chunks_used",
        count=len(context_chunks),
        min_sim=_RAG_MIN_SIMILARITY,
    )
    return context_chunks, retrieved_sources
