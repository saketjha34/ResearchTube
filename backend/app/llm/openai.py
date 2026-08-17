"""
Shared OpenAI LLM Provider.

All agents use this class to access OpenAI (ChatGPT).

Responsibilities:
    - Create the OpenAI LLM.
    - Centralize model configuration.
    - Provide structured-output LLMs.

Agents should NOT create ChatOpenAI directly.
"""

from __future__ import annotations

from typing import Type

# pyrefly: ignore [missing-import]
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from app.core.config import settings


class OpenAILLM:
    """
    Shared OpenAI LLM provider.

    Example:

        openai_llm = OpenAILLM()

        llm = openai_llm.get_llm()

        planner_llm = openai_llm.with_structured_output(
            YouTubeResearchRequest
        )
    """

    def __init__(
        self,
        model: str = "gpt-4o-mini",
        temperature: float = 0,
    ):

        self.model = model
        self.temperature = temperature

        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not set in the environment.")

        self.llm = ChatOpenAI(
            model=self.model,
            temperature=self.temperature,
            api_key=settings.OPENAI_API_KEY,
        )

    # ========================================================
    # GET NORMAL LLM
    # ========================================================

    def get_llm(self) -> ChatOpenAI:
        """
        Return the configured OpenAI LLM.
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
        Return an OpenAI LLM configured to produce
        the specified Pydantic schema.
        """

        return self.llm.with_structured_output(
            schema
        )
