"""
Chat Prompt Templates.

Typed classes for ResearchTube AI chat features, loaded from Jinja2 templates.
"""

from __future__ import annotations

from typing import Any, List, Optional
from app.prompts.base import JinjaPromptTemplate


class ChatRAGPromptTemplate(JinjaPromptTemplate):
    """
    Prompt template class for the ResearchTube RAG-powered multi-turn chat assistant.
    Combines user message, optional video/run scope, retrieved transcript chunks, and turn history.
    """

    def __init__(self) -> None:
        super().__init__(
            template_name="chat/chat_rag.txt",
            required_vars=["user_message"],
        )

    def render(
        self,
        user_message: str,
        scope_description: Optional[str] = None,
        context_chunks: Optional[List[Any]] = None,
        history: Optional[List[Any]] = None,
        web_search_results: Optional[str] = None,
        **kwargs: Any,
    ) -> str:
        return super().render(
            user_message=user_message,
            scope_description=scope_description,
            context_chunks=context_chunks,
            history=history,
            web_search_results=web_search_results,
            **kwargs,
        )

    def format(
        self,
        user_message: str,
        scope_description: Optional[str] = None,
        context_chunks: Optional[List[Any]] = None,
        history: Optional[List[Any]] = None,
        web_search_results: Optional[str] = None,
        **kwargs: Any,
    ) -> str:
        return self.render(
            user_message=user_message,
            scope_description=scope_description,
            context_chunks=context_chunks,
            history=history,
            web_search_results=web_search_results,
            **kwargs,
        )


# Pre-instantiated class objects for direct use
chat_rag_template = ChatRAGPromptTemplate()

__all__ = [
    "ChatRAGPromptTemplate",
    "chat_rag_template",
]
