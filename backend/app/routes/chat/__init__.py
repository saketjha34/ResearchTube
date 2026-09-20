"""
app.routes.chat — Chat Routes Package.

Aggregates modular chat routers (sessions, messages, sharing, videos)
under the unified `/chat` prefix.
"""

from fastapi import APIRouter

from app.routes.chat.message_routes import router as message_router
from app.routes.chat.session_routes import router as session_router
from app.routes.chat.share_routes import router as share_router
from app.routes.chat.video_routes import router as video_router

router = APIRouter(
    prefix="/chat",
    tags=["Chat"],
)

# Mount all modular sub-routers
router.include_router(video_router)
router.include_router(session_router)
router.include_router(message_router)
router.include_router(share_router)

__all__ = ["router"]
