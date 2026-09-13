"""
app.services — Services package.

Re-exports all service singleton instances and key dependencies.
"""

from app.services.auth import (
    local_auth_service,
    google_auth_service,
    profile_service,
    get_current_user,
)

from app.services.user_service import user_service
from app.services.youtube_research import (
    youtube_research_service,
    YoutubeResearchService,
    history_service,
    HistoryService,
)

__all__ = [
    "local_auth_service",
    "google_auth_service",
    "profile_service",
    "get_current_user",
    "user_service",
    "history_service",
    "HistoryService",
    "youtube_research_service",
    "YoutubeResearchService",
]


