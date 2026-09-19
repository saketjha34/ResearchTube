"""
app.routes.chat — Chat routes package.

Exposes the unified /chat router.
"""

from fastapi import APIRouter

from app.routes.chat.chat_routes import router as chat_router

router = APIRouter(
    prefix="/chat",
    tags=["Chat"],
)

router.include_router(chat_router)

__all__ = ["router"]
