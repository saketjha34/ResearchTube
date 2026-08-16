"""
Gemini Embedding Service.

Used for:
    - Transcript chunk embeddings
    - User query embeddings

Database vector dimension:
    768
"""

from __future__ import annotations

import asyncio

from langchain_google_genai import (
    GoogleGenerativeAIEmbeddings,
)

from app.core.config import settings


class GeminiEmbeddingService:

    def __init__(
        self,
        model: str | None = None,
    ):

        self.model = (
            model
            or settings.EMBEDDING_MODEL
        )

        self.embeddings = (
            GoogleGenerativeAIEmbeddings(
                model=self.model,
                google_api_key=(
                    settings.GEMINI_API_KEY
                ),
                output_dimensionality=768,
            )
        )

    # ========================================================
    # SINGLE TEXT (sync)
    # ========================================================

    def embed_text(
        self,
        text: str,
    ) -> list[float]:

        if not text:
            raise ValueError(
                "Cannot embed empty text."
            )

        vector = (
            self.embeddings.embed_query(
                text
            )
        )

        if len(vector) != 768:

            raise ValueError(
                f"Expected 768 dimensions, "
                f"got {len(vector)}."
            )

        return vector

    # ========================================================
    # MULTIPLE DOCUMENTS (sync)
    # ========================================================

    def embed_documents(
        self,
        texts: list[str],
    ) -> list[list[float]]:

        if not texts:
            return []

        vectors = (
            self.embeddings.embed_documents(
                texts
            )
        )

        for vector in vectors:

            if len(vector) != 768:

                raise ValueError(
                    "Embedding dimension mismatch. "
                    f"Expected 768, "
                    f"got {len(vector)}."
                )

        return vectors

    # ========================================================
    # ASYNC WRAPPERS
    # ========================================================

    async def embed_text_async(
        self,
        text: str,
    ) -> list[float]:
        """
        Non-blocking wrapper around embed_text.

        Runs the synchronous Gemini embedding call
        in a thread so the async event loop is not blocked.
        """

        return await asyncio.to_thread(
            self.embed_text,
            text,
        )

    async def embed_documents_async(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        """
        Non-blocking wrapper around embed_documents.

        Runs the synchronous Gemini embedding call
        in a thread so the async event loop is not blocked.
        """

        return await asyncio.to_thread(
            self.embed_documents,
            texts,
        )