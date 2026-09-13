"""
app.agents.youtube — Functional YouTube Research Agents package.

Contains the 3 core functional agents:
1. research_agent: Agent 1 (Planner + YouTube Search & Transcript Collector)
2. context_analysis_agent: Agent 2 (pgvector RAG + Depth Evaluation + Ranking)
3. final_report_agent: Agent 3 (Synthesis + Pedagogical Report Generator)
"""

from app.agents.youtube.research_agent import (
    youtube_research_agent,
    plan_youtube_research,
    collect_video_data,
)

from app.agents.youtube.context_analysis_agent import (
    context_analysis_agent,
    build_video_context,
    build_rag_context,
    format_rag_context,
)

from app.agents.youtube.final_report_agent import (
    final_report_agent,
    build_final_report_context,
    format_final_report_context,
)

__all__ = [
    # Agent 1
    "youtube_research_agent",
    "plan_youtube_research",
    "collect_video_data",
    # Agent 2
    "context_analysis_agent",
    "build_video_context",
    "build_rag_context",
    "format_rag_context",
    # Agent 3
    "final_report_agent",
    "build_final_report_context",
    "format_final_report_context",
]
