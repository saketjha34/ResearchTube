"""
app.services.chat — Chat services package.

Re-exports the singleton chat_service instance.
"""

from app.services.chat.chat_service import ChatService, chat_service

__all__ = [
    "ChatService",
    "chat_service",
]
