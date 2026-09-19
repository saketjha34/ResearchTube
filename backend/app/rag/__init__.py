"""
app.rag — Retrieval-Augmented Generation package.

Provides common RAG primitives (chunking via LangChain, embeddings, base retriever protocols)
and domain-specific subpackages (such as app.rag.youtube for video transcripts).
"""

from app.rag.chunker import (
    TextChunker,
    chunk_text,
)

from app.rag.embeddings import (
    BaseEmbeddingService,
    GeminiEmbeddingService,
    OpenAIEmbeddingService,
    DualEmbeddingService,
)

from app.rag.retriever import (
    BaseVectorRetriever,
    PGVectorRetriever,
    YouTubeTranscriptRetriever,
)

from app.rag.youtube import (
    ingest_youtube_transcripts,
    ingest_transcripts,
)

__all__ = [
    # Common RAG
    "TextChunker",
    "chunk_text",
    "BaseEmbeddingService",
    "GeminiEmbeddingService",
    "OpenAIEmbeddingService",
    "DualEmbeddingService",
    "BaseVectorRetriever",
    # YouTube RAG
    "PGVectorRetriever",
    "YouTubeTranscriptRetriever",
    "ingest_youtube_transcripts",
    "ingest_transcripts",
]