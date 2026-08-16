"""
PostgreSQL + pgvector Retriever.

Agent 2 uses this module to retrieve
the transcript chunks most relevant to
the user's research question.

Filtering is done by DB UUID (youtube_videos.id),
not by the YouTube string video ID.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.youtube import (
    TranscriptChunk,
)

from app.rag.embeddings import (
    GeminiEmbeddingService,
)


class PGVectorRetriever:

    def __init__(
        self,
        embedding_service: GeminiEmbeddingService | None = None,
    ):

        self.embedding_service = (
            embedding_service
            or GeminiEmbeddingService()
        )

    # ========================================================
    # SEMANTIC SEARCH
    # ========================================================

    async def similarity_search(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 10,
        db_video_ids: list[UUID] | None = None,
        research_run_id: UUID | None = None,
    ) -> list[dict[str, Any]]:
        """
        Retrieve the top-K transcript chunks most similar
        to `query`.

        Parameters
        ----------
        db_video_ids:
            Filter to chunks belonging to these DB UUIDs
            (youtube_videos.id), not YouTube string IDs.

        research_run_id:
            Further restrict to chunks from a specific
            research run, preventing cross-run contamination.
        """

        if not query:
            raise ValueError(
                "Query cannot be empty."
            )

        if top_k <= 0:
            raise ValueError(
                "top_k must be greater than 0."
            )

        # ----------------------------------------------------
        # 1. EMBED USER QUERY (non-blocking)
        # ----------------------------------------------------

        query_embedding = (
            await self.embedding_service.embed_text_async(
                query
            )
        )

        # ----------------------------------------------------
        # 2. COSINE DISTANCE
        # ----------------------------------------------------

        distance = (
            TranscriptChunk.embedding.cosine_distance(
                query_embedding
            )
        )

        # ----------------------------------------------------
        # 3. BUILD QUERY
        # ----------------------------------------------------

        stmt = (
            select(
                TranscriptChunk,
                distance.label(
                    "distance"
                ),
            )
            .where(
                TranscriptChunk.embedding.is_not(
                    None
                )
            )
        )

        # ----------------------------------------------------
        # OPTIONAL: scope to research run
        # ----------------------------------------------------

        if research_run_id is not None:

            stmt = stmt.where(
                TranscriptChunk.research_run_id == research_run_id
            )

        # ----------------------------------------------------
        # OPTIONAL: scope to specific DB video UUIDs
        # ----------------------------------------------------

        if db_video_ids:

            stmt = stmt.where(
                TranscriptChunk.video_id.in_(
                    db_video_ids
                )
            )

        # ----------------------------------------------------
        # ORDER BY SIMILARITY
        # ----------------------------------------------------

        stmt = (
            stmt
            .order_by(distance)
            .limit(top_k)
        )

        # ----------------------------------------------------
        # 4. EXECUTE
        # ----------------------------------------------------

        result = await session.execute(
            stmt
        )

        rows = result.all()

        # ----------------------------------------------------
        # 5. FORMAT RESULTS
        # ----------------------------------------------------

        retrieved = []

        for row in rows:

            chunk = row[0]
            distance_value = row[1]

            similarity = (
                1.0 - float(distance_value)
            )

            retrieved.append({

                "chunk_id": str(
                    chunk.id
                ),

                "video_id": str(
                    chunk.video_id
                ),

                "chunk_index": (
                    chunk.chunk_index
                ),

                "text": chunk.text,

                "language": (
                    chunk.language
                ),

                "start_time": (
                    chunk.start_time
                ),

                "end_time": (
                    chunk.end_time
                ),

                "similarity": similarity,

            })

        return retrieved