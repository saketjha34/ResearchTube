from __future__ import annotations

import json
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================
# ANALYSIS EVALUATION
# (mirrors ResourceEvaluation Pydantic schema from youtube.py)
# ============================================================

class HistoryEvaluation(BaseModel):
    """
    One video's evaluation produced by Agent 2.
    Mirrors the ResourceEvaluation schema stored in the DB.
    """

    rank: Optional[int] = None
    video_id: str          # YouTube string ID
    title: Optional[str] = None

    relevance_score: Optional[float] = None
    educational_quality_score: Optional[float] = None
    coverage_score: Optional[float] = None
    overall_score: Optional[float] = None

    beginner_friendly: Optional[bool] = None

    concepts_covered: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)

    recommendation_reason: Optional[str] = None


# ============================================================
# RECOMMENDED RESOURCE
# (mirrors FinalReportResource from youtube.py)
# ============================================================

class HistoryRecommendedResource(BaseModel):
    """
    One recommended resource inside the final report.
    Mirrors the FinalReportResource stored as JSON in the DB.
    """

    rank: Optional[int] = None
    video_id: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    channel: Optional[str] = None
    published_at: Optional[str] = None
    description: Optional[str] = None

    views: Optional[int] = None
    likes: Optional[int] = None
    comments: Optional[int] = None

    transcript_available: Optional[bool] = None
    transcript_language: Optional[str] = None

    relevance_score: Optional[float] = None
    educational_quality_score: Optional[float] = None
    coverage_score: Optional[float] = None
    overall_score: Optional[float] = None

    beginner_friendly: Optional[bool] = None

    concepts_covered: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)

    recommendation_reason: Optional[str] = None

    thumbnail_url: Optional[str] = None


# ============================================================
# HISTORY VIDEO ITEM
# (enriched with all evaluation + metadata fields)
# ============================================================

class HistoryVideoItem(BaseModel):
    """
    Compact video representation inside a history entry.
    Includes YouTube metadata + Agent 2 evaluation scores.
    """

    # YouTube metadata
    video_id: str
    title: Optional[str] = None
    url: Optional[str] = None
    channel: Optional[str] = None
    description: Optional[str] = None
    published_at: Optional[str] = None
    thumbnail_url: Optional[str] = None

    views: Optional[int] = None
    likes: Optional[int] = None
    comments: Optional[int] = None

    transcript_available: Optional[bool] = None
    transcript_language: Optional[str] = None

    # Agent 2 evaluation scores
    rank: Optional[int] = None
    relevance_score: Optional[float] = None
    educational_quality_score: Optional[float] = None
    coverage_score: Optional[float] = None
    overall_score: Optional[float] = None

    beginner_friendly: Optional[bool] = None

    concepts_covered: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)

    recommendation_reason: Optional[str] = None


# ============================================================
# HISTORY ENTRY
# (one research run — shown as a "chat" in the sidebar)
# ============================================================

class HistoryEntry(BaseModel):
    """
    Complete record of one research session.

    Includes:
        - Run metadata (query, status, timestamps)
        - Agent 2 analysis (evaluations per video + ranking summary)
        - Agent 3 final report (recommended resources, summary, path)
        - All videos with full scores
    """

    # --------------------------------------------------------
    # Run metadata
    # --------------------------------------------------------

    run_id: str

    query: str

    status: str

    video_count: int

    created_at: datetime

    completed_at: Optional[datetime] = None

    # --------------------------------------------------------
    # Agent 3 — Final Report
    # --------------------------------------------------------

    research_question: Optional[str] = None

    executive_summary: Optional[str] = None

    conclusion: Optional[str] = None

    methodology: Optional[str] = None

    learning_path: list[str] = Field(default_factory=list)

    key_topics: list[str] = Field(default_factory=list)

    limitations: list[str] = Field(default_factory=list)

    # Full list of recommended resources from Agent 3
    # (parsed from final_reports.recommended_resources JSON)
    recommended_resources: list[HistoryRecommendedResource] = Field(
        default_factory=list
    )

    # --------------------------------------------------------
    # Agent 2 — Analysis
    # --------------------------------------------------------

    # Per-video evaluations with full scores, strengths, weaknesses
    analysis_evaluations: list[HistoryEvaluation] = Field(
        default_factory=list
    )

    ranking_summary: Optional[str] = None

    # --------------------------------------------------------
    # Videos (enriched with evaluation data)
    # --------------------------------------------------------

    videos: list[HistoryVideoItem] = Field(default_factory=list)


# ============================================================
# PAGINATED RESPONSE
# ============================================================

class HistoryListResponse(BaseModel):
    """
    Paginated history list returned by GET /youtube/history.
    """

    total: int

    page: int

    page_size: int

    items: list[HistoryEntry] = Field(default_factory=list)
