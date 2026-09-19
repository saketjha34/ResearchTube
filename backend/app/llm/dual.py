"""
Dual Compatibility LLM Provider (OpenAI Primary with Gemini Fallback).

Responsibilities:
    - Centralize dual LLM routing and automatic resilience.
    - Execute OpenAI (default: gpt-5-mini) as the primary provider.
    - Automatically intercept failures/rate-limits and fall back to Gemini.
    - Provide structured logging on every invocation indicating provider, model, latency, and fallback state.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Type, TypeVar

# pyrefly: ignore [missing-import]
import structlog
from pydantic import BaseModel

from app.core.config import settings
from app.llm.gemini import GeminiLLM
from app.llm.openai import OpenAILLM

logger = structlog.get_logger("dual_llm")

T = TypeVar("T", bound=BaseModel)


class DualStructuredOutput:
    """
    Wrapper for structured output with primary OpenAI and Gemini fallback.
    """

    def __init__(
        self,
        schema: Type[T],
        openai_model: str,
        gemini_model: str,
        openai_llm: OpenAILLM | None,
        gemini_llm: GeminiLLM,
    ) -> None:
        self.schema = schema
        self.openai_model = openai_model
        self.gemini_model = gemini_model
        self.openai_llm = openai_llm
        self.gemini_llm = gemini_llm

        self._openai_runnable = (
            openai_llm.with_structured_output(schema) if openai_llm else None
        )
        self._gemini_runnable = gemini_llm.with_structured_output(schema)

    def invoke(self, input_prompt: Any, **kwargs: Any) -> T:
        """
        Synchronous invocation: attempts OpenAI first, falls back to Gemini on error.
        """
        # 1. Attempt OpenAI primary if configured
        if self._openai_runnable:
            start_time = time.perf_counter()
            logger.info(
                "llm.structured.attempt",
                provider="openai",
                model=self.openai_model,
                schema=self.schema.__name__,
            )
            print(f"[LLM] Attempting structured output with OpenAI ({self.openai_model}) [schema: {self.schema.__name__}]...")
            try:
                result = self._openai_runnable.invoke(input_prompt, **kwargs)
                elapsed = time.perf_counter() - start_time
                logger.info(
                    "llm.structured.success",
                    provider="openai",
                    model=self.openai_model,
                    latency=round(elapsed, 3),
                    schema=self.schema.__name__,
                )
                print(f"[LLM] Completed structured output using OpenAI ({self.openai_model}) in {elapsed:.2f}s")
                return result
            except Exception as exc:
                elapsed = time.perf_counter() - start_time
                logger.warning(
                    "llm.structured.fallback",
                    failed_provider="openai",
                    model=self.openai_model,
                    error=str(exc),
                    fallback_provider="gemini",
                    fallback_model=self.gemini_model,
                    latency=round(elapsed, 3),
                )
                print(f"[WARNING] OpenAI ({self.openai_model}) failed: {exc}. Falling back to Gemini ({self.gemini_model})...")

        # 2. Fallback to Gemini
        start_time = time.perf_counter()
        logger.info(
            "llm.structured.attempt",
            provider="gemini",
            model=self.gemini_model,
            schema=self.schema.__name__,
            is_fallback=True,
        )
        print(f"[LLM] [Fallback] Attempting structured output with Gemini ({self.gemini_model}) [schema: {self.schema.__name__}]...")
        try:
            result = self._gemini_runnable.invoke(input_prompt, **kwargs)
            elapsed = time.perf_counter() - start_time
            logger.info(
                "llm.structured.success",
                provider="gemini",
                model=self.gemini_model,
                latency=round(elapsed, 3),
                schema=self.schema.__name__,
                is_fallback=True,
            )
            print(f"[LLM] Completed structured output using Gemini fallback ({self.gemini_model}) in {elapsed:.2f}s")
            return result
        except Exception as exc:
            logger.error(
                "llm.structured.failed",
                error=str(exc),
                schema=self.schema.__name__,
            )
            print(f"[ERROR] Both OpenAI and Gemini structured output failed: {exc}")
            raise

    async def ainvoke(self, input_prompt: Any, **kwargs: Any) -> T:
        """
        Asynchronous invocation: attempts OpenAI first, falls back to Gemini on error.
        """
        return await asyncio.to_thread(self.invoke, input_prompt, **kwargs)


class DualLLMRunnable:
    """
    Wrapper for standard chat completions with primary OpenAI and Gemini fallback.
    """

    def __init__(
        self,
        openai_model: str,
        gemini_model: str,
        openai_llm: OpenAILLM | None,
        gemini_llm: GeminiLLM,
    ) -> None:
        self.openai_model = openai_model
        self.gemini_model = gemini_model
        self.openai_llm = openai_llm
        self.gemini_llm = gemini_llm

        self._openai_chat = openai_llm.get_llm() if openai_llm else None
        self._gemini_chat = gemini_llm.get_llm()

    def invoke(self, input_prompt: Any, **kwargs: Any) -> Any:
        # 1. Attempt OpenAI primary
        if self._openai_chat:
            start_time = time.perf_counter()
            logger.info(
                "llm.chat.attempt",
                provider="openai",
                model=self.openai_model,
            )
            print(f"[LLM] Attempting invocation with OpenAI ({self.openai_model})...")
            try:
                result = self._openai_chat.invoke(input_prompt, **kwargs)
                elapsed = time.perf_counter() - start_time
                logger.info(
                    "llm.chat.success",
                    provider="openai",
                    model=self.openai_model,
                    latency=round(elapsed, 3),
                )
                print(f"[LLM] Completed invocation using OpenAI ({self.openai_model}) in {elapsed:.2f}s")
                return result
            except Exception as exc:
                elapsed = time.perf_counter() - start_time
                logger.warning(
                    "llm.chat.fallback",
                    failed_provider="openai",
                    model=self.openai_model,
                    error=str(exc),
                    fallback_provider="gemini",
                    fallback_model=self.gemini_model,
                    latency=round(elapsed, 3),
                )
                print(f"[WARNING] OpenAI ({self.openai_model}) failed: {exc}. Falling back to Gemini ({self.gemini_model})...")

        # 2. Fallback to Gemini
        start_time = time.perf_counter()
        logger.info(
            "llm.chat.attempt",
            provider="gemini",
            model=self.gemini_model,
            is_fallback=True,
        )
        print(f"[LLM] [Fallback] Attempting invocation with Gemini ({self.gemini_model})...")
        try:
            result = self._gemini_chat.invoke(input_prompt, **kwargs)
            elapsed = time.perf_counter() - start_time
            logger.info(
                "llm.chat.success",
                provider="gemini",
                model=self.gemini_model,
                latency=round(elapsed, 3),
                is_fallback=True,
            )
            print(f"[LLM] Completed invocation using Gemini fallback ({self.gemini_model}) in {elapsed:.2f}s")
            return result
        except Exception as exc:
            logger.error(
                "llm.chat.failed",
                error=str(exc),
            )
            print(f"[ERROR] Both OpenAI and Gemini invocations failed: {exc}")
            raise

    async def ainvoke(self, input_prompt: Any, **kwargs: Any) -> Any:
        return await asyncio.to_thread(self.invoke, input_prompt, **kwargs)


class DualLLM:
    """
    Unified Dual LLM Provider with primary OpenAI and fallback Gemini.

    Usage:
        dual_llm = DualLLM()

        # Chat completion with fallback
        llm = dual_llm.get_llm()
        resp = llm.invoke("Hello")

        # Structured output with fallback
        planner = dual_llm.with_structured_output(YouTubeResearchRequest)
        plan = planner.invoke(prompt)
    """

    def __init__(
        self,
        openai_model: str | None = None,
        gemini_model: str | None = None,
        temperature: float = 0,
    ) -> None:
        self.openai_model = openai_model or settings.OPENAI_MODEL
        self.gemini_model = gemini_model or settings.GEMINI_MODEL
        self.temperature = temperature

        # Initialize OpenAI LLM if key is available
        self.openai_llm: OpenAILLM | None = None
        if settings.OPENAI_API_KEY:
            try:
                self.openai_llm = OpenAILLM(
                    model=self.openai_model,
                    temperature=self.temperature,
                )
            except Exception as exc:
                logger.warning("dual_llm.openai_init_failed", error=str(exc))
                print(f"[WARNING] Could not initialize OpenAILLM: {exc}")

        # Initialize Gemini fallback LLM
        self.gemini_llm = GeminiLLM(
            model=self.gemini_model,
            temperature=self.temperature,
        )

    def get_llm(self) -> DualLLMRunnable:
        """
        Return a DualLLMRunnable configured to invoke OpenAI first, Gemini second.
        """
        return DualLLMRunnable(
            openai_model=self.openai_model,
            gemini_model=self.gemini_model,
            openai_llm=self.openai_llm,
            gemini_llm=self.gemini_llm,
        )

    def with_structured_output(
        self,
        schema: Type[T],
    ) -> DualStructuredOutput:
        """
        Return a DualStructuredOutput configured to parse structured schema with fallback.
        """
        return DualStructuredOutput(
            schema=schema,
            openai_model=self.openai_model,
            gemini_model=self.gemini_model,
            openai_llm=self.openai_llm,
            gemini_llm=self.gemini_llm,
        )
