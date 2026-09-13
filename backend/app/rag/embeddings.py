"""
Embedding Services for RAG.

Provides base embedding protocol and Gemini embedding implementation.
Vector dimension: 768.
"""

from __future__ import annotations

import asyncio
from typing import Protocol, runtime_checkable

# pyrefly: ignore [missing-import]
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from app.core.config import settings


@runtime_checkable
class BaseEmbeddingService(Protocol):
    """
    Protocol defining the embedding interface required by RAG retrievers and ingestors.
    """

    def embed_text(self, text: str) -> list[float]:
        ...

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        ...

    async def embed_text_async(self, text: str) -> list[float]:
        ...

    async def embed_documents_async(self, texts: list[str]) -> list[list[float]]:
        ...


class GeminiEmbeddingService:
    """
    Gemini Embedding Service using GoogleGenerativeAIEmbeddings.

    Used for:
        - Document/chunk embeddings
        - Query embeddings
    """

    def __init__(
        self,
        model: str | None = None,
        dimension: int = 768,
    ) -> None:
        self.model = model or settings.EMBEDDING_MODEL
        self.dimension = dimension

        self.embeddings = GoogleGenerativeAIEmbeddings(
            model=self.model,
            google_api_key=settings.GEMINI_API_KEY,
            output_dimensionality=self.dimension,
        )

    # ========================================================
    # SINGLE TEXT (sync)
    # ========================================================

    def embed_text(self, text: str) -> list[float]:
        if not text:
            raise ValueError("Cannot embed empty text.")

        vector = self.embeddings.embed_query(text)

        if len(vector) != self.dimension:
            raise ValueError(
                f"Expected {self.dimension} dimensions, got {len(vector)}."
            )

        return vector

    # ========================================================
    # MULTIPLE DOCUMENTS (sync)
    # ========================================================

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        vectors = self.embeddings.embed_documents(texts)

        for vector in vectors:
            if len(vector) != self.dimension:
                raise ValueError(
                    f"Embedding dimension mismatch. Expected {self.dimension}, got {len(vector)}."
                )

        return vectors

    # ========================================================
    # ASYNC WRAPPERS
    # ========================================================

    async def embed_text_async(self, text: str) -> list[float]:
        """
        Non-blocking wrapper around embed_text.
        Runs the synchronous Gemini embedding call in a thread pool.
        """
        return await asyncio.to_thread(self.embed_text, text)

    async def embed_documents_async(self, texts: list[str]) -> list[list[float]]:
        """
        Non-blocking wrapper around embed_documents.
        Runs the synchronous Gemini embedding call in a thread pool.
        """
        return await asyncio.to_thread(self.embed_documents, texts)