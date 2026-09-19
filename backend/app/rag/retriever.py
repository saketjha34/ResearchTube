"""
Common RAG Retriever abstractions and PostgreSQL pgvector implementations.

Defines the BaseVectorRetriever protocol for any vector store retrieval,
and re-exports PGVectorRetriever for YouTube transcript research.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.rag.embeddings import (
    BaseEmbeddingService,
    GeminiEmbeddingService,
    OpenAIEmbeddingService,
    DualEmbeddingService,
)
from app.rag.youtube.retriever import YouTubeTranscriptRetriever, PGVectorRetriever


@runtime_checkable
class BaseVectorRetriever(Protocol):
    """
    Protocol defining the interface for all RAG vector retrievers.
    """

    embedding_service: BaseEmbeddingService

    async def similarity_search(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 10,
        **kwargs: Any,
    ) -> list[dict[str, Any]]:
        """
        Execute semantic similarity search for the given query.
        """
        ...


__all__ = [
    "BaseVectorRetriever",
    "PGVectorRetriever",
    "YouTubeTranscriptRetriever",
]