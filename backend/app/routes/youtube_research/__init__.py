"""
app.routes.youtube_research — YouTube Research routes package.

Assembles the unified /youtube router from modular sub-routers:
- research_routes: /research and /shared/{run_id}
- history_routes: /history, /history/{run_id}, rename, share, delete
"""

# pyrefly: ignore [missing-import]
import structlog
from fastapi import APIRouter

from app.routes.youtube_research.research_routes import router as research_router
from app.routes.youtube_research.history_routes import router as history_router

router = APIRouter(
    prefix="/youtube",
    tags=["YouTube Research"],
)

router.include_router(research_router)
router.include_router(history_router)

_logger = structlog.get_logger("youtube_research")

__all__ = ["router"]
