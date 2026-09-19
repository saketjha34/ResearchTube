"""
OpenAI LLM & LangChain Agent Integration Test Script.

Validates:
1. Environment configuration (OPENAI_API_KEY).
2. OpenAILLM class initialization.
3. Raw ChatOpenAI completion via get_llm().
4. Structured output parsing via with_structured_output() with Pydantic schemas.
5. LangChain Agent prompt template integration (Research Planning Pipeline).

Usage:
    python scripts/test_openai_llm.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

# Prevent pytest from auto-discovering this standalone CLI script as a unit test suite
__test__ = False

# Ensure backend root is in sys.path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from pydantic import BaseModel, Field

from app.core.config import settings
from app.llm.openai import OpenAILLM
from app.prompts import PlanYouTubeResearchPromptTemplate
from app.schema.youtube import YouTubeResearchRequest


# ==============================================================================
# TEST SCHEMAS
# ==============================================================================

class SampleStructuredOutput(BaseModel):
    """Simple test schema for structured output validation."""
    summary: str = Field(description="A concise summary of the topic")
    key_points: list[str] = Field(description="List of 2-3 key takeaways")
    confidence_score: float = Field(description="Confidence between 0.0 and 1.0")


# ==============================================================================
# TEST RUNNERS
# ==============================================================================

def test_environment() -> bool:
    """Check that OPENAI_API_KEY is available in settings."""
    print("\n[Step 1/5] Checking Environment Configuration...")
    key = settings.OPENAI_API_KEY
    if not key:
        print("[ERROR] OPENAI_API_KEY is not set or empty in .env / settings.")
        return False

    # Mask key for secure logging
    masked_key = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "***"
    print(f"[+] Found OPENAI_API_KEY: {masked_key} (length: {len(key)})")
    return True


def test_initialization() -> OpenAILLM | None:
    """Test instantiating the OpenAILLM class."""
    print("\n[Step 2/5] Testing OpenAILLM Initialization...")
    try:
        provider = OpenAILLM(model="gpt-4o-mini", temperature=0.0)
        print(f"[+] Initialized OpenAILLM successfully.")
        print(f"    - Model: {provider.model}")
        print(f"    - Temperature: {provider.temperature}")
        return provider
    except Exception as exc:
        print(f"[ERROR] Failed to initialize OpenAILLM: {exc}")
        return None


def test_standard_llm(provider: OpenAILLM) -> bool:
    """Test standard chat completion via get_llm()."""
    print("\n[Step 3/5] Testing get_llm() Chat Completion...")
    try:
        llm = provider.get_llm()
        prompt = "In 10 words or less, describe what ResearchTube does."
        print(f"[*] Prompt: '{prompt}'")
        
        start_time = time.perf_counter()
        response = llm.invoke(prompt)
        elapsed = time.perf_counter() - start_time

        content = response.content if hasattr(response, "content") else str(response)
        print(f"[+] Response received in {elapsed:.2f}s:")
        print(f"    \"{content.strip()}\"")
        return True
    except Exception as exc:
        print(f"[ERROR] Standard LLM invocation failed: {exc}")
        return False


def test_structured_output(provider: OpenAILLM) -> bool:
    """Test structured output using with_structured_output()."""
    print("\n[Step 4/5] Testing with_structured_output() with Pydantic Schema...")
    try:
        structured_llm = provider.with_structured_output(SampleStructuredOutput)
        prompt = "Analyze the benefits of using Python for asynchronous programming."
        print(f"[*] Prompt: '{prompt}'")
        
        start_time = time.perf_counter()
        result: SampleStructuredOutput = structured_llm.invoke(prompt)
        elapsed = time.perf_counter() - start_time

        print(f"[+] Structured output received in {elapsed:.2f}s:")
        print(f"    - Summary: {result.summary}")
        print(f"    - Key Points: {result.key_points}")
        print(f"    - Confidence Score: {result.confidence_score}")
        
        assert isinstance(result, SampleStructuredOutput), "Result is not an instance of SampleStructuredOutput"
        assert len(result.key_points) > 0, "No key points returned"
        return True
    except Exception as exc:
        print(f"[ERROR] Structured output test failed: {exc}")
        return False


def test_agent_research_planning(provider: OpenAILLM) -> bool:
    """Test Agent 1 Planner workflow: Jinja prompt + structured output."""
    print("\n[Step 5/5] Testing LangChain Agent Planning Workflow (Agent 1)...")
    try:
        planner_llm = provider.with_structured_output(YouTubeResearchRequest)
        template = PlanYouTubeResearchPromptTemplate()
        
        query = "Build high performance web APIs with FastAPI"
        num_videos = 3
        prompt = template.render(user_query=query, num_videos=num_videos)
        print(f"[*] Rendered Jinja2 Prompt for query: '{query}' (num_videos={num_videos})")
        
        start_time = time.perf_counter()
        plan: YouTubeResearchRequest = planner_llm.invoke(prompt)
        elapsed = time.perf_counter() - start_time

        print(f"[+] Agent Planner produced valid YouTubeResearchRequest in {elapsed:.2f}s:")
        print(f"    - Topic: '{plan.topic}'")
        print(f"    - Video Count: {plan.video_count} (requested: {num_videos})")
        print(f"    - Search Videos: {plan.search_videos}")
        print(f"    - Get Details: {plan.get_details}")
        print(f"    - Get Transcript: {plan.get_transcript}")
        print(f"    - Fields Requested: {plan.fields}")

        assert isinstance(plan, YouTubeResearchRequest), "Plan is not a YouTubeResearchRequest"
        assert plan.video_count == num_videos, f"Expected {num_videos} videos, got {plan.video_count}"
        return True
    except Exception as exc:
        print(f"[ERROR] Agent research planning test failed: {exc}")
        return False


# ==============================================================================
# MAIN ENTRYPOINT
# ==============================================================================

def main():
    print("=" * 70)
    print(" RESEARCHTUBE: OPENAI LLM & LANGCHAIN AGENT TEST SUITE")
    print("=" * 70)

    # 1. Check environment
    if not test_environment():
        sys.exit(1)

    # 2. Test initialization
    provider = test_initialization()
    if not provider:
        sys.exit(1)

    # 3. Test standard completion
    success_std = test_standard_llm(provider)

    # 4. Test structured output
    success_structured = test_structured_output(provider)

    # 5. Test agent prompt & planning integration
    success_agent = test_agent_research_planning(provider)

    # Summary
    print("\n" + "=" * 70)
    print(" TEST RESULTS SUMMARY")
    print("=" * 70)
    print(f"  [1] Environment Config:        PASSED")
    print(f"  [2] OpenAILLM Initialization:  PASSED")
    print(f"  [3] Standard Chat Completion:  {'PASSED' if success_std else 'FAILED'}")
    print(f"  [4] Structured Output:         {'PASSED' if success_structured else 'FAILED'}")
    print(f"  [5] LangChain Agent Planner:   {'PASSED' if success_agent else 'FAILED'}")
    print("=" * 70)

    all_passed = success_std and success_structured and success_agent
    if all_passed:
        print("[SUCCESS] All OpenAI LLM and LangChain agent tests passed successfully!\n")
        sys.exit(0)
    else:
        print("[FAILURE] One or more tests failed. Review output above.\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
