"""
app.services.youtube_research — YouTube Research Services package.

Re-exports YoutubeResearchService and its singleton instance.
"""

from app.services.youtube_research.research_service import (
    YoutubeResearchService,
    youtube_research_service,
)
from app.services.youtube_research.history_service import (
    HistoryService,
    history_service,
)

__all__ = [
    "YoutubeResearchService",
    "youtube_research_service",
    "HistoryService",
    "history_service",
]

