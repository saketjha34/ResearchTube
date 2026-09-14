"""
LangGraph Workflow Engine for the YouTube Research Multi-Agent Pipeline.

==============================================================================
WHAT THIS MODULE DOES:
==============================================================================
Assembles the 7-node state machine into a compiled, executable LangGraph workflow.
Controls DAG topology, wiring linear transitions between Agent 1, Agent 2, Agent 3,
and intermediate persistence and RAG ingestion steps.

==============================================================================
DAG TOPOLOGY:
==============================================================================
    START
      ↓
    youtube_research        (Node 1: Agent 1 - Search & Collect)
      ↓
    persist_research        (Node 2: Save Videos & Build UUID Map)
      ↓
    ingest_transcripts      (Node 3: LangChain Chunker + pgvector Embedding)
      ↓
    context_analysis        (Node 4: Agent 2 - RAG Context & Evaluation)
      ↓
    persist_analysis        (Node 5: Save Evaluations & Ranking)
      ↓
    final_report            (Node 6: Agent 3 - Synthesis & Report)
      ↓
    persist_final_report    (Node 7: Save Report & Complete Run)
      ↓
    END

==============================================================================
OOP DESIGN:
==============================================================================
Encapsulated inside `YouTubeResearchGraph`. Allows constructing, inspecting, and
compiling the graph cleanly with testable dependency injection.
==============================================================================
"""

from __future__ import annotations

# pyrefly: ignore [missing-import]
from langgraph.graph import (
    StateGraph,
    START,
    END,
)
from langgraph.graph.state import CompiledStateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from app.graph.youtube.state import ResearchState
from app.graph.youtube.nodes import YouTubeGraphNodes
from app.graph.youtube.persistence import (
    YouTubeGraphPersistence,
    youtube_graph_persistence,
)


class YouTubeResearchGraph:
    """
    Object-oriented builder and compiler for the ResearchTube LangGraph execution pipeline.

    Usage:
        graph_builder = YouTubeResearchGraph(session)
        compiled_graph = graph_builder.compile()
        result = await compiled_graph.ainvoke({"user_query": "...", "research_run_id": "..."})
    """

    def __init__(
        self,
        session: AsyncSession,
        persistence: YouTubeGraphPersistence | None = None,
    ) -> None:
        self.session = session
        self.persistence = persistence or youtube_graph_persistence
        self.nodes = YouTubeGraphNodes(session=self.session, persistence=self.persistence)

    def build(self) -> StateGraph:
        """
        Construct and configure the uncompiled StateGraph with nodes and edge connections.
        """
        graph = StateGraph(ResearchState)
        node_map = self.nodes.as_dict()

        # ----------------------------------------------------
        # REGISTER NODES
        # ----------------------------------------------------
        for node_name, node_func in node_map.items():
            graph.add_node(node_name, node_func)

        # ----------------------------------------------------
        # WIRE EDGES (Strict Linear DAG)
        # ----------------------------------------------------
        graph.add_edge(START, "youtube_research")
        graph.add_edge("youtube_research", "persist_research")
        graph.add_edge("persist_research", "ingest_transcripts")
        graph.add_edge("ingest_transcripts", "context_analysis")
        graph.add_edge("context_analysis", "persist_analysis")
        graph.add_edge("persist_analysis", "final_report")
        graph.add_edge("final_report", "persist_final_report")
        graph.add_edge("persist_final_report", END)

        return graph

    def compile(self) -> CompiledStateGraph:
        """
        Build and compile the StateGraph into an executable LangGraph instance.
        """
        return self.build().compile()


def create_research_graph(session: AsyncSession) -> CompiledStateGraph:
    """
    Functional factory returning a compiled research graph for the given database session.
    Maintains drop-in backward compatibility with existing route handlers and services.
    """
    return YouTubeResearchGraph(session=session).compile()


__all__ = [
    "YouTubeResearchGraph",
    "create_research_graph",
]
