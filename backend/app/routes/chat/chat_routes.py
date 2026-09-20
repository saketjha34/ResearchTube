"""
app.routes.chat.chat_routes — Backward-compatibility alias.

Re-exports the consolidated router from app.routes.chat package.
"""

from app.routes.chat import router

__all__ = ["router"]
