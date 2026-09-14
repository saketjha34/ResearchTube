"""
app.graph.youtube — YouTube Research Multi-Agent LangGraph Package.

Provides state definitions, persistence manager, node handlers, and graph builder
for executing the 7-node YouTube research workflow.
"""

from app.graph.youtube.state import ResearchState
from app.graph.youtube.persistence import (
    YouTubeGraphPersistence,
    youtube_graph_persistence,
    create_research_run,
    update_research_run_status,
    persist_videos,
    persist_analysis,
    persist_final_report,
)
from app.graph.youtube.nodes import (
    YouTubeGraphNodes,
    make_nodes,
)
from app.graph.youtube.graph import (
    YouTubeResearchGraph,
    create_research_graph,
)

__all__ = [
    # State
    "ResearchState",
    # Persistence
    "YouTubeGraphPersistence",
    "youtube_graph_persistence",
    "create_research_run",
    "update_research_run_status",
    "persist_videos",
    "persist_analysis",
    "persist_final_report",
    # Nodes
    "YouTubeGraphNodes",
    "make_nodes",
    # Graph
    "YouTubeResearchGraph",
    "create_research_graph",
]
