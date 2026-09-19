"""
Embedding Services for RAG.

Provides base embedding protocol, OpenAI embedding implementation (768 dimensions),
Gemini embedding implementation (768 dimensions), and a unified DualEmbeddingService
that defaults to OpenAI with automatic Gemini fallback and per-step logging.

Vector dimension: 768 (matching PostgreSQL pgvector column Vector(768)).
"""

from __future__ import annotations

import asyncio
import time
from typing import Protocol, runtime_checkable

# pyrefly: ignore [missing-import]
import structlog
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_openai import OpenAIEmbeddings

from app.core.config import settings

logger = structlog.get_logger("embeddings")


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


# ==============================================================================
# GEMINI EMBEDDING SERVICE (Fallback)
# ==============================================================================

class GeminiEmbeddingService:
    """
    Gemini Embedding Service using GoogleGenerativeAIEmbeddings.
    Vector dimension: 768.
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

    def embed_text(self, text: str) -> list[float]:
        if not text:
            raise ValueError("Cannot embed empty text.")

        vector = self.embeddings.embed_query(text)
        if len(vector) != self.dimension:
            raise ValueError(
                f"Expected {self.dimension} dimensions, got {len(vector)}."
            )
        return vector

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

    async def embed_text_async(self, text: str) -> list[float]:
        return await asyncio.to_thread(self.embed_text, text)

    async def embed_documents_async(self, texts: list[str]) -> list[list[float]]:
        return await asyncio.to_thread(self.embed_documents, texts)


# ==============================================================================
# OPENAI EMBEDDING SERVICE (Primary)
# ==============================================================================

class OpenAIEmbeddingService:
    """
    OpenAI Embedding Service using OpenAIEmbeddings (text-embedding-3-small).
    Configured with native 768-dimension reduction to match PostgreSQL Vector(768).
    """

    def __init__(
        self,
        model: str | None = None,
        dimension: int = 768,
    ) -> None:
        self.model = model or settings.OPENAI_EMBEDDING_MODEL
        self.dimension = dimension

        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not set in the environment.")

        self.embeddings = OpenAIEmbeddings(
            model=self.model,
            dimensions=self.dimension,
            api_key=settings.OPENAI_API_KEY,
        )

    def embed_text(self, text: str) -> list[float]:
        if not text:
            raise ValueError("Cannot embed empty text.")

        vector = self.embeddings.embed_query(text)
        if len(vector) != self.dimension:
            raise ValueError(
                f"Expected {self.dimension} dimensions, got {len(vector)}."
            )
        return vector

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

    async def embed_text_async(self, text: str) -> list[float]:
        return await asyncio.to_thread(self.embed_text, text)

    async def embed_documents_async(self, texts: list[str]) -> list[list[float]]:
        return await asyncio.to_thread(self.embed_documents, texts)


# ==============================================================================
# DUAL EMBEDDING SERVICE (Primary OpenAI with Gemini Fallback)
# ==============================================================================

class DualEmbeddingService:
    """
    Dual Embedding Service routing to OpenAI first, with automatic Gemini fallback.
    Outputs vectors of dimension 768 in both cases.
    """

    def __init__(
        self,
        openai_model: str | None = None,
        gemini_model: str | None = None,
        dimension: int = 768,
    ) -> None:
        self.openai_model = openai_model or settings.OPENAI_EMBEDDING_MODEL
        self.gemini_model = gemini_model or settings.EMBEDDING_MODEL
        self.dimension = dimension

        self.openai_service: OpenAIEmbeddingService | None = None
        if settings.OPENAI_API_KEY:
            try:
                self.openai_service = OpenAIEmbeddingService(
                    model=self.openai_model,
                    dimension=self.dimension,
                )
            except Exception as exc:
                logger.warning("dual_embedding.openai_init_failed", error=str(exc))
                print(f"[WARNING] Could not initialize OpenAIEmbeddingService: {exc}")

        self.gemini_service = GeminiEmbeddingService(
            model=self.gemini_model,
            dimension=self.dimension,
        )

    def embed_text(self, text: str) -> list[float]:
        # 1. Attempt OpenAI primary
        if self.openai_service:
            start_time = time.perf_counter()
            logger.info("embedding.text.attempt", provider="openai", model=self.openai_model)
            print(f"[Embedding] Generating query embedding using OpenAI ({self.openai_model}, dim={self.dimension})...")
            try:
                vector = self.openai_service.embed_text(text)
                elapsed = time.perf_counter() - start_time
                logger.info("embedding.text.success", provider="openai", latency=round(elapsed, 3))
                print(f"[Embedding] Completed query embedding using OpenAI in {elapsed:.2f}s")
                return vector
            except Exception as exc:
                elapsed = time.perf_counter() - start_time
                logger.warning(
                    "embedding.text.fallback",
                    failed_provider="openai",
                    error=str(exc),
                    fallback_provider="gemini",
                )
                print(f"[WARNING] OpenAI embedding failed: {exc}. Falling back to Gemini ({self.gemini_model})...")

        # 2. Fallback to Gemini
        start_time = time.perf_counter()
        logger.info("embedding.text.attempt", provider="gemini", model=self.gemini_model, is_fallback=True)
        print(f"[Embedding] [Fallback] Generating query embedding using Gemini ({self.gemini_model}, dim={self.dimension})...")
        try:
            vector = self.gemini_service.embed_text(text)
            elapsed = time.perf_counter() - start_time
            logger.info("embedding.text.success", provider="gemini", latency=round(elapsed, 3), is_fallback=True)
            print(f"[Embedding] Completed query embedding using Gemini fallback in {elapsed:.2f}s")
            return vector
        except Exception as exc:
            logger.error("embedding.text.failed", error=str(exc))
            print(f"[ERROR] Both OpenAI and Gemini query embeddings failed: {exc}")
            raise

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        # 1. Attempt OpenAI primary
        if self.openai_service:
            start_time = time.perf_counter()
            logger.info(
                "embedding.documents.attempt",
                provider="openai",
                model=self.openai_model,
                count=len(texts),
            )
            print(f"[Embedding] Generating {len(texts)} document embeddings using OpenAI ({self.openai_model}, dim={self.dimension})...")
            try:
                vectors = self.openai_service.embed_documents(texts)
                elapsed = time.perf_counter() - start_time
                logger.info(
                    "embedding.documents.success",
                    provider="openai",
                    count=len(texts),
                    latency=round(elapsed, 3),
                )
                print(f"[Embedding] Completed {len(texts)} document embeddings using OpenAI in {elapsed:.2f}s")
                return vectors
            except Exception as exc:
                elapsed = time.perf_counter() - start_time
                logger.warning(
                    "embedding.documents.fallback",
                    failed_provider="openai",
                    error=str(exc),
                    fallback_provider="gemini",
                )
                print(f"[WARNING] OpenAI document embeddings failed: {exc}. Falling back to Gemini ({self.gemini_model})...")

        # 2. Fallback to Gemini
        start_time = time.perf_counter()
        logger.info(
            "embedding.documents.attempt",
            provider="gemini",
            model=self.gemini_model,
            count=len(texts),
            is_fallback=True,
        )
        print(f"[Embedding] [Fallback] Generating {len(texts)} document embeddings using Gemini ({self.gemini_model}, dim={self.dimension})...")
        try:
            vectors = self.gemini_service.embed_documents(texts)
            elapsed = time.perf_counter() - start_time
            logger.info(
                "embedding.documents.success",
                provider="gemini",
                count=len(texts),
                latency=round(elapsed, 3),
                is_fallback=True,
            )
            print(f"[Embedding] Completed {len(texts)} document embeddings using Gemini fallback in {elapsed:.2f}s")
            return vectors
        except Exception as exc:
            logger.error("embedding.documents.failed", error=str(exc))
            print(f"[ERROR] Both OpenAI and Gemini document embeddings failed: {exc}")
            raise

    async def embed_text_async(self, text: str) -> list[float]:
        return await asyncio.to_thread(self.embed_text, text)

    async def embed_documents_async(self, texts: list[str]) -> list[list[float]]:
        return await asyncio.to_thread(self.embed_documents, texts)