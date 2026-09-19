"""
YouTube Transcript Ingestor.

Chunks, embeds, and persists YouTube transcripts into PostgreSQL + pgvector
for a given research run using LangChain's chunker and Gemini embeddings.

Used between Agent 1 (YouTube research) and Agent 2 (RAG + context analysis).
"""

from __future__ import annotations

from uuid import UUID

# pyrefly: ignore [missing-import]
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.youtube import TranscriptChunk
from app.rag.chunker import chunk_text
from app.rag.embeddings import (
    DualEmbeddingService,
    BaseEmbeddingService,
)
from app.schema.youtube import YouTubeVideoResult

# Module-level embedding service (default to DualEmbeddingService: OpenAI primary, Gemini fallback)
_default_embedding_service = DualEmbeddingService()

logger = structlog.get_logger("youtube_rag_ingestor")


async def ingest_youtube_transcripts(
    session: AsyncSession,
    research_run_id: UUID,
    videos: list[YouTubeVideoResult],
    video_id_map: dict[str, UUID],
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    embedding_service: BaseEmbeddingService | None = None,
) -> None:
    """
    For each video with an available transcript:

        video.transcript
             ↓
        chunk_text()  [LangChain RecursiveCharacterTextSplitter]
             ↓
        embed_documents_async() [Gemini Embedding Service]
             ↓
        TranscriptChunk rows → PostgreSQL / pgvector

    Parameters
    ----------
    session:
        Active AsyncSession for DB operations.
    research_run_id:
        UUID of the current ResearchRun.
    videos:
        Agent 1 output — list of YouTubeVideoResult.
    video_id_map:
        Maps YouTube string video_id → DB UUID (youtube_videos.id).
    chunk_size:
        Target characters per chunk (default 1000).
    chunk_overlap:
        Overlap characters between consecutive chunks (default 200).
    embedding_service:
        Optional custom embedding service implementing BaseEmbeddingService.
    """
    embedder = embedding_service or _default_embedding_service
    log = logger.bind(run_id=str(research_run_id))

    for video in videos:
        # ====================================================
        # SKIP videos without transcripts
        # ====================================================
        if not video.transcript_available:
            log.info(
                "rag.skipped",
                video_id=video.video_id,
                reason="no_transcript",
            )
            continue

        transcript_text = video.transcript

        if not transcript_text or not transcript_text.strip():
            log.info(
                "rag.skipped",
                video_id=video.video_id,
                reason="empty_transcript",
            )
            continue

        db_video_uuid = video_id_map.get(video.video_id)

        if db_video_uuid is None:
            log.warning(
                "rag.skipped",
                video_id=video.video_id,
                reason="no_db_uuid",
            )
            continue

        # ====================================================
        # CHUNK (via LangChain RecursiveCharacterTextSplitter)
        # ====================================================
        chunks = chunk_text(
            text=transcript_text,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

        if not chunks:
            log.warning("rag.no_chunks", video_id=video.video_id)
            continue

        log.info(
            "rag.embedding",
            video_id=video.video_id,
            chunk_count=len(chunks),
        )

        # ====================================================
        # EMBED (non-blocking async)
        # ====================================================
        embeddings = await embedder.embed_documents_async(chunks)

        # ====================================================
        # PERSIST TO DATABASE
        # ====================================================
        for chunk_index, (chunk_text_value, embedding) in enumerate(
            zip(chunks, embeddings)
        ):
            chunk = TranscriptChunk(
                research_run_id=research_run_id,
                video_id=db_video_uuid,
                chunk_index=chunk_index,
                text=chunk_text_value,
                embedding=embedding,
                language=video.transcript_language,
            )
            session.add(chunk)

        await session.flush()

        log.info(
            "rag.ingested",
            video_id=video.video_id,
            vectors_stored=len(chunks),
        )


# Backward compatibility alias
ingest_transcripts = ingest_youtube_transcripts
