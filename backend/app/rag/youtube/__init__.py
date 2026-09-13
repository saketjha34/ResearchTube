"""
app.rag.youtube — YouTube Research RAG subpackage.

Contains YouTube-specific transcript ingestion, pgvector storage,
and transcript semantic retrieval.
"""

from app.rag.youtube.retriever import (
    YouTubeTranscriptRetriever,
    PGVectorRetriever,
)
from app.rag.youtube.ingestor import (
    ingest_youtube_transcripts,
    ingest_transcripts,
)

__all__ = [
    "YouTubeTranscriptRetriever",
    "PGVectorRetriever",
    "ingest_youtube_transcripts",
    "ingest_transcripts",
]
