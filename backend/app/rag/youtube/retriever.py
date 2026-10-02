"""
YouTube Transcript Retriever (Hybrid: pgvector + BM25 Full-Text Search via Reciprocal Rank Fusion).

Agent 2 and Chatbot use this module to retrieve the transcript chunks most relevant to
the user's research question or query from PostgreSQL.

Hybrid Search combines:
1. Dense Vector Search (pgvector cosine distance) for broad semantic understanding.
2. Sparse Lexical Search (PostgreSQL tsvector + tsquery with ts_rank_cd) for exact command names,
   code snippets, tools, error codes, and technical keywords.
3. Reciprocal Rank Fusion (RRF):
      RRF_score(d) = sum_{m in {vector, bm25}} (1.0 / (k + rank_m(d)))
   with calibrated similarity score to preserve downstream compatibility with similarity thresholds.

Filtering is scoped by:
- research_run_id (prevents cross-run contamination)
- db_video_ids (youtube_videos.id DB UUIDs)
"""

from __future__ import annotations

import asyncio
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.youtube import TranscriptChunk
from app.rag.embeddings import (
    BaseEmbeddingService,
    DualEmbeddingService,
)


class YouTubeTranscriptRetriever:
    """
    Retriever specialized for YouTube video transcript chunks stored in PostgreSQL
    using pgvector dense embeddings and full-text search (tsvector/BM25) fused via RRF.
    Defaults to DualEmbeddingService (OpenAI primary, Gemini fallback).
    """

    def __init__(
        self,
        embedding_service: BaseEmbeddingService | None = None,
    ) -> None:
        self.embedding_service = embedding_service or DualEmbeddingService()

    async def dense_search(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 10,
        db_video_ids: list[UUID] | None = None,
        research_run_id: UUID | None = None,
    ) -> list[dict[str, Any]]:
        """
        Retrieve top-K chunks via dense vector cosine distance.
        """
        if not query:
            raise ValueError("Query cannot be empty.")
        if top_k <= 0:
            raise ValueError("top_k must be greater than 0.")

        query_embedding = await self.embedding_service.embed_text_async(query)
        distance = TranscriptChunk.embedding.cosine_distance(query_embedding)

        stmt = (
            select(
                TranscriptChunk,
                distance.label("distance"),
            )
            .where(TranscriptChunk.embedding.is_not(None))
        )

        if research_run_id is not None:
            stmt = stmt.where(TranscriptChunk.research_run_id == research_run_id)

        if db_video_ids:
            stmt = stmt.where(TranscriptChunk.video_id.in_(db_video_ids))

        stmt = stmt.order_by(distance).limit(top_k)
        result = await session.execute(stmt)
        rows = result.all()

        retrieved: list[dict[str, Any]] = []
        for rank, row in enumerate(rows, start=1):
            chunk: TranscriptChunk = row[0]
            distance_value = row[1]
            similarity = 1.0 - float(distance_value)

            retrieved.append({
                "chunk_id": str(chunk.id),
                "video_id": str(chunk.video_id),
                "chunk_index": chunk.chunk_index,
                "text": chunk.text,
                "language": chunk.language,
                "start_time": chunk.start_time,
                "end_time": chunk.end_time,
                "similarity": similarity,
                "dense_rank": rank,
            })

        return retrieved

    async def bm25_search(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 10,
        db_video_ids: list[UUID] | None = None,
        research_run_id: UUID | None = None,
    ) -> list[dict[str, Any]]:
        """
        Retrieve top-K chunks via PostgreSQL native Full-Text Search (tsvector + tsquery).
        Uses websearch_to_tsquery with fallback to plainto_tsquery for robust text parsing.
        """
        clean_query = query.strip()
        if not clean_query or top_k <= 0:
            return []

        tsvector_expr = func.to_tsvector("english", TranscriptChunk.text)

        rows: list[Any] = []
        for tsquery_fn_name in ["websearch_to_tsquery", "plainto_tsquery"]:
            try:
                tsquery_fn = getattr(func, tsquery_fn_name)
                tsquery_expr = tsquery_fn("english", clean_query)
                rank_expr = func.ts_rank_cd(tsvector_expr, tsquery_expr)

                stmt = (
                    select(
                        TranscriptChunk,
                        rank_expr.label("rank"),
                    )
                    .where(tsvector_expr.op("@@")(tsquery_expr))
                )

                if research_run_id is not None:
                    stmt = stmt.where(TranscriptChunk.research_run_id == research_run_id)

                if db_video_ids:
                    stmt = stmt.where(TranscriptChunk.video_id.in_(db_video_ids))

                stmt = stmt.order_by(rank_expr.desc()).limit(top_k)
                result = await session.execute(stmt)
                rows = result.all()
                if rows:
                    break
            except Exception:
                continue

        retrieved: list[dict[str, Any]] = []
        for rank, row in enumerate(rows, start=1):
            chunk: TranscriptChunk = row[0]
            bm25_score = float(row[1])

            retrieved.append({
                "chunk_id": str(chunk.id),
                "video_id": str(chunk.video_id),
                "chunk_index": chunk.chunk_index,
                "text": chunk.text,
                "language": chunk.language,
                "start_time": chunk.start_time,
                "end_time": chunk.end_time,
                "bm25_rank": rank,
                "bm25_score": bm25_score,
            })

        return retrieved

    async def hybrid_search(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 10,
        db_video_ids: list[UUID] | None = None,
        research_run_id: UUID | None = None,
        rrf_k: int = 60,
    ) -> list[dict[str, Any]]:
        """
        Hybrid search combining dense pgvector search and BM25 lexical search via
        Reciprocal Rank Fusion (RRF).

        Parameters
        ----------
        session:
            Active AsyncSession.
        query:
            User research question or prompt text.
        top_k:
            Number of top results to return.
        db_video_ids:
            Optional filter by video IDs.
        research_run_id:
            Optional filter by research run ID.
        rrf_k:
            RRF smoothing constant (default: 60).
        """
        candidate_k = max(top_k * 2, 10)

        # Concurrently execute dense and BM25 queries
        dense_results, bm25_results = await asyncio.gather(
            self.dense_search(
                session=session,
                query=query,
                top_k=candidate_k,
                db_video_ids=db_video_ids,
                research_run_id=research_run_id,
            ),
            self.bm25_search(
                session=session,
                query=query,
                top_k=candidate_k,
                db_video_ids=db_video_ids,
                research_run_id=research_run_id,
            ),
            return_exceptions=True,
        )

        if isinstance(dense_results, Exception):
            dense_results = []
        if isinstance(bm25_results, Exception):
            bm25_results = []

        # If BM25 returned no hits, return dense results directly
        if not bm25_results:
            return dense_results[:top_k]

        # If dense returned no hits, return BM25 results with calibrated similarity
        if not dense_results:
            out: list[dict[str, Any]] = []
            for item in bm25_results[:top_k]:
                rank = item["bm25_rank"]
                calibrated_sim = 0.50 + 0.35 * (1.0 - (rank - 1) / float(candidate_k))
                item_copy = dict(item)
                item_copy["similarity"] = round(calibrated_sim, 4)
                out.append(item_copy)
            return out

        # Compute Reciprocal Rank Fusion
        dense_map = {item["chunk_id"]: item for item in dense_results}
        bm25_map = {item["chunk_id"]: item for item in bm25_results}
        all_chunk_ids = list(dict.fromkeys(list(dense_map.keys()) + list(bm25_map.keys())))

        max_possible_rrf = (1.0 / (rrf_k + 1)) + (1.0 / (rrf_k + 1))  # Rank 1 in both lists

        fused_items: list[dict[str, Any]] = []
        for chunk_id in all_chunk_ids:
            dense_item = dense_map.get(chunk_id)
            bm25_item = bm25_map.get(chunk_id)

            rrf_score = 0.0
            dense_rank = dense_item["dense_rank"] if dense_item else None
            bm25_rank = bm25_item["bm25_rank"] if bm25_item else None

            if dense_rank is not None:
                rrf_score += 1.0 / (rrf_k + dense_rank)
            if bm25_rank is not None:
                rrf_score += 1.0 / (rrf_k + bm25_rank)

            norm_rrf = min(1.0, rrf_score / max_possible_rrf)

            # Calibrate similarity to [0.0, 1.0] scale so downstream filters (e.g. min_similarity >= 0.40)
            # and citations continue functioning with 100% backward-compatibility
            if dense_item is not None:
                dense_sim = float(dense_item["similarity"])
                calibrated_sim = max(dense_sim, (dense_sim * 0.70) + (norm_rrf * 0.30))
            else:
                calibrated_sim = 0.50 + 0.35 * (1.0 - (bm25_rank - 1) / float(candidate_k))

            source_item = dense_item or bm25_item
            fused_items.append({
                "chunk_id": chunk_id,
                "video_id": source_item["video_id"],
                "chunk_index": source_item["chunk_index"],
                "text": source_item["text"],
                "language": source_item.get("language"),
                "start_time": source_item.get("start_time"),
                "end_time": source_item.get("end_time"),
                "similarity": round(calibrated_sim, 4),
                "rrf_score": round(rrf_score, 6),
                "dense_rank": dense_rank,
                "bm25_rank": bm25_rank,
            })

        fused_items.sort(key=lambda x: x["rrf_score"], reverse=True)
        return fused_items[:top_k]

    async def similarity_search(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 10,
        db_video_ids: list[UUID] | None = None,
        research_run_id: UUID | None = None,
        enable_hybrid: bool = True,
    ) -> list[dict[str, Any]]:
        """
        Retrieve the top-K transcript chunks most relevant to `query`.
        By default, uses Hybrid Search (Dense + BM25 via Reciprocal Rank Fusion)
        with zero-regression fallback to dense vector search.
        """
        if not query:
            raise ValueError("Query cannot be empty.")
        if top_k <= 0:
            raise ValueError("top_k must be greater than 0.")

        if enable_hybrid:
            try:
                return await self.hybrid_search(
                    session=session,
                    query=query,
                    top_k=top_k,
                    db_video_ids=db_video_ids,
                    research_run_id=research_run_id,
                )
            except Exception:
                # Seamless fallback to pure dense search if hybrid encounters any issue
                pass

        return await self.dense_search(
            session=session,
            query=query,
            top_k=top_k,
            db_video_ids=db_video_ids,
            research_run_id=research_run_id,
        )


# Backward compatibility alias
PGVectorRetriever = YouTubeTranscriptRetriever

