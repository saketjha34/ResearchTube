from __future__ import annotations

# pyrefly: ignore [missing-import]
from langgraph.graph import (
  StateGraph,
  START,
  END,
)

from sqlalchemy.ext.asyncio import AsyncSession

from app.graph.youtube_state import ResearchState
from app.graph.youtube_nodes import make_nodes


def create_research_graph(
    session: AsyncSession,
):
    """
    Build and compile the 7-node LangGraph research workflow.

    Graph:
        START
          ↓
        youtube_research      (Agent 1)
          ↓
        persist_research      (save videos)
          ↓
        ingest_transcripts    (chunk + embed + pgvector)
          ↓
        context_analysis      (Agent 2)
          ↓
        persist_analysis      (save evaluations)
          ↓
        final_report          (Agent 3)
          ↓
        persist_final_report  (save report + mark COMPLETED)
          ↓
        END
    """

    nodes = make_nodes(session)

    graph = StateGraph(ResearchState)

    # ========================================================
    # REGISTER NODES
    # ========================================================

    graph.add_node(
        "youtube_research",
        nodes["youtube_research"],
    )

    graph.add_node(
        "persist_research",
        nodes["persist_research"],
    )

    graph.add_node(
        "ingest_transcripts",
        nodes["ingest_transcripts"],
    )

    graph.add_node(
        "context_analysis",
        nodes["context_analysis"],
    )

    graph.add_node(
        "persist_analysis",
        nodes["persist_analysis"],
    )

    graph.add_node(
        "final_report",
        nodes["final_report"],
    )

    graph.add_node(
        "persist_final_report",
        nodes["persist_final_report"],
    )

    # ========================================================
    # EDGES
    # ========================================================

    graph.add_edge(START, "youtube_research")
    graph.add_edge("youtube_research", "persist_research")
    graph.add_edge("persist_research", "ingest_transcripts")
    graph.add_edge("ingest_transcripts", "context_analysis")
    graph.add_edge("context_analysis", "persist_analysis")
    graph.add_edge("persist_analysis", "final_report")
    graph.add_edge("final_report", "persist_final_report")
    graph.add_edge("persist_final_report", END)

    return graph.compile()