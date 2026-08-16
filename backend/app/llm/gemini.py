"""
Shared Gemini LLM Provider.

All agents use this class to access Gemini.

Responsibilities:
    - Create the Gemini LLM.
    - Centralize model configuration.
    - Provide structured-output LLMs.

Agents should NOT create ChatGoogleGenerativeAI
directly.
"""

from __future__ import annotations

from typing import Type

# pyrefly: ignore [missing-import]
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel

from app.core.config import settings


class GeminiLLM:
    """
    Shared Gemini LLM provider.

    Example:

        gemini = GeminiLLM()

        llm = gemini.get_llm()

        planner_llm = gemini.structured_output(
            YouTubeResearchRequest
        )
    """

    def __init__(
        self,
        model: str = "gemini-3.5-flash",
        temperature: float = 0,
    ):

        self.model = model
        self.temperature = temperature

        self.llm = ChatGoogleGenerativeAI(
            model=self.model,
            temperature=self.temperature,
            google_api_key=settings.GEMINI_API_KEY,
        )

    # ========================================================
    # GET NORMAL LLM
    # ========================================================

    def get_llm(self) -> ChatGoogleGenerativeAI:
        """
        Return the configured Gemini LLM.
        """

        return self.llm

    # ========================================================
    # GET STRUCTURED LLM
    # ========================================================

    def with_structured_output(
        self,
        schema: Type[BaseModel],
    ):
        """
        Return a Gemini LLM configured to produce
        the specified Pydantic schema.
        """

        return self.llm.with_structured_output(
            schema
        )