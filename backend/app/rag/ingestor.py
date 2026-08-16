"""
Transcript Ingestor.

Chunks, embeds, and persists YouTube transcripts
into PostgreSQL + pgvector for a given research run.

Used between Agent 1 (YouTube research) and
Agent 2 (RAG + context analysis).
"""

from __future__ import annotations

import asyncio
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models.youtube import (
    TranscriptChunk,
    YouTubeVideo,
)

from app.rag.chunker import chunk_text
from app.rag.embeddings import GeminiEmbeddingService
from app.schema.youtube import YouTubeVideoResult


# Module-level embedding service (shared)
_embedding_service = GeminiEmbeddingService()


async def ingest_transcripts(
    session: AsyncSession,
    research_run_id: UUID,
    videos: list[YouTubeVideoResult],
    video_id_map: dict[str, UUID],
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> None:
    """
    For each video with an available transcript:

        transcript
            ↓
        chunk_text()
            ↓
        embed_documents_async()
            ↓
        TranscriptChunk rows → PostgreSQL/pgvector

    Parameters
    ----------
    research_run_id:
        The UUID of the current ResearchRun.

    videos:
        Agent 1 output — list of YouTubeVideoResult.

    video_id_map:
        Maps YouTube string video_id → DB UUID (youtube_videos.id).

    chunk_size:
        Characters per chunk.

    chunk_overlap:
        Overlap between consecutive chunks.
    """

    for video in videos:

        # ====================================================
        # SKIP videos without transcripts
        # ====================================================

        if not video.transcript_available:
            print(
                f"[Ingestor] Skipping {video.video_id} "
                f"(no transcript)."
            )
            continue

        transcript_text = video.transcript

        if not transcript_text or not transcript_text.strip():
            print(
                f"[Ingestor] Skipping {video.video_id} "
                f"(empty transcript)."
            )
            continue

        db_video_uuid = video_id_map.get(video.video_id)

        if db_video_uuid is None:
            print(
                f"[Ingestor] WARNING: No DB UUID for "
                f"{video.video_id} — skipping."
            )
            continue

        # ====================================================
        # CHUNK
        # ====================================================

        chunks = chunk_text(
            text=transcript_text,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

        if not chunks:
            print(
                f"[Ingestor] No chunks for {video.video_id}."
            )
            continue

        print(
            f"[Ingestor] {video.video_id}: "
            f"{len(chunks)} chunks — embedding..."
        )

        # ====================================================
        # EMBED (non-blocking)
        # ====================================================

        embeddings = await _embedding_service.embed_documents_async(
            chunks
        )

        # ====================================================
        # PERSIST
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

        print(
            f"[Ingestor] {video.video_id}: "
            f"persisted {len(chunks)} chunks."
        )
