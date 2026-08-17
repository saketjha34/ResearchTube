from __future__ import annotations

from typing import Optional
from uuid import UUID

from typing_extensions import TypedDict

from app.schema.youtube import (
    YouTubeResearchResult,
    ResourceAnalysis,
    FinalReport,
)


class ResearchState(TypedDict, total=False):

    # ========================================================
    # INPUT
    # ========================================================

    user_query: str

    video_count: int

    # ========================================================
    # DATABASE
    # ========================================================

    # UUID of the current ResearchRun row (as string)
    research_run_id: str

    # Maps YouTube string video_id → DB UUID string
    # e.g. {"dQw4w9WgXcQ": "3fa85f64-..."}
    video_id_map: dict[str, str]

    # ========================================================
    # AGENT 1
    # ========================================================

    research_result: YouTubeResearchResult

    # ========================================================
    # AGENT 2
    # ========================================================

    analysis: ResourceAnalysis

    # ========================================================
    # AGENT 3
    # ========================================================

    final_report: FinalReport

    # ========================================================
    # ERROR
    # ========================================================

    error: Optional[str]