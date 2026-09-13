"""
Transcript Ingestor (backward compatibility wrapper).

Re-exports ingest_transcripts from app.rag.youtube.ingestor.
"""

from __future__ import annotations

from app.rag.youtube.ingestor import (
    ingest_youtube_transcripts,
    ingest_transcripts,
)

__all__ = [
    "ingest_youtube_transcripts",
    "ingest_transcripts",
]
