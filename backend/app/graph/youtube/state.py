"""
State Definitions for the LangGraph YouTube Research Pipeline.

==============================================================================
WHAT THIS MODULE DOES:
==============================================================================
Defines the shared state schema (`ResearchState`) that flows through all 7 nodes
of the compiled LangGraph execution graph. Each node inspects incoming state
channels, performs its specialized task, and yields mutations that update the state.

==============================================================================
GRAPH STATE LIFECYCLE & DATA FLOW:
==============================================================================
1. START:
   - Initial input: `user_query`, `video_count`, `research_run_id`
2. Node 1 (youtube_research):
   - Adds `research_result` (Agent 1 output)
3. Node 2 (persist_research):
   - Adds `video_id_map` (mapping YouTube string IDs → PostgreSQL DB UUIDs)
4. Node 3 (ingest_transcripts):
   - Chunks & embeds transcripts into pgvector (state remains unchanged)
5. Node 4 (context_analysis):
   - Adds `analysis` (Agent 2 evaluation & ranking output)
6. Node 5 (persist_analysis):
   - Flushes evaluations & ranking summary to PostgreSQL
7. Node 6 (final_report):
   - Adds `final_report` (Agent 3 synthesized report)
8. Node 7 (persist_final_report):
   - Flushes FinalReport to PostgreSQL and updates ResearchRun status to "completed"
9. END
==============================================================================
"""

from __future__ import annotations

from typing import Optional
from typing_extensions import TypedDict

from app.schema.youtube import (
    YouTubeResearchResult,
    ResourceAnalysis,
    FinalReport,
)


class ResearchState(TypedDict, total=False):
    """
    Shared state container passed between all nodes in the YouTube research LangGraph.

    Channels:
    ---------
    user_query:
        The initial natural language topic or research inquiry from the user.
    video_count:
        Target number of candidate videos to collect and evaluate.
    research_run_id:
        Stringified UUID corresponding to the active `research_runs` row in PostgreSQL.
    video_id_map:
        Mapping of YouTube string video IDs (e.g. 'dQw4w9WgXcQ') to DB UUID strings.
    research_result:
        Agent 1 output containing collected YouTube video metadata and transcripts.
    analysis:
        Agent 2 output containing RAG evaluation scores, depth metrics, and rankings.
    final_report:
        Agent 3 output containing the publication-ready synthesis and learning path.
    error:
        Optional error message if any pipeline node fails.
    """

    # ========================================================
    # INPUT CHANNELS
    # ========================================================
    user_query: str
    video_count: int

    # ========================================================
    # DATABASE IDENTIFIERS
    # ========================================================
    research_run_id: str
    video_id_map: dict[str, str]

    # ========================================================
    # AGENT OUTPUT CHANNELS
    # ========================================================
    research_result: YouTubeResearchResult
    analysis: ResourceAnalysis
    final_report: FinalReport

    # ========================================================
    # ERROR HANDLING
    # ========================================================
    error: Optional[str]


__all__ = ["ResearchState"]
