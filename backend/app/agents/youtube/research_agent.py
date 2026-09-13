"""
Agent 1: Planner + YouTube Research Data Collector.

==============================================================================
WHAT THIS AGENT DOES:
==============================================================================
Agent 1 is the entry point of the ResearchTube execution pipeline.
It transforms a user's natural language research inquiry into a structured
search strategy, executes queries against the YouTube Data API, collects video
metadata (titles, channels, metrics), and retrieves transcripts for each video.

==============================================================================
REQUIREMENTS & PREREQUISITES:
==============================================================================
- Input Parameters:
    - `user_query` (str): Non-empty research inquiry from user.
    - `num_videos` (int): Number of videos to retrieve (ge=1, default=3).
- External Services:
    - Gemini LLM for structured output planning (`YouTubeResearchRequest`).
    - YouTube Data API (v3) via `search_youtube` and `get_video_details` tools.
    - YouTube Transcript API via `get_video_transcript` tool.
- Environment:
    - Valid `GEMINI_API_KEY` and `YOUTUBE_API_KEY` configured in settings.

==============================================================================
RESPONSIBILITIES:
==============================================================================
1. Plan YouTube search parameters:
   - Identify best search keywords/topics.
   - Enforce exact `video_count` constraint requested by user.
   - Determine which metadata fields and transcript options to request.
2. Query YouTube Search API to retrieve candidate video IDs.
3. Collect detailed video metadata (views, likes, comments, publication date).
4. Fetch full video transcripts (up to character cap) and detect transcript language.
5. Return a strictly validated `YouTubeResearchResult` schema.

==============================================================================
NON-RESPONSIBILITIES (What this agent MUST NOT do):
==============================================================================
- DOES NOT generate embeddings or write to pgvector (delegated to RAG ingestor).
- DOES NOT evaluate video depth or calculate quality scores (delegated to Agent 2).
- DOES NOT rank videos from best to worst (delegated to Agent 2).
- DOES NOT synthesize research reports or learning paths (delegated to Agent 3).
==============================================================================
"""

from __future__ import annotations

import asyncio

from app.llm.gemini import GeminiLLM
from app.schema.youtube import (
    YouTubeResearchRequest,
    YouTubeResearchResult,
    YouTubeVideoResult,
)
from app.tools.youtube_tools import (
    search_youtube,
    get_video_details,
    get_video_transcript,
)
from app.prompts.youtube import PlanYouTubeResearchPromptTemplate


# ============================================================
# GEMINI & PROMPT TEMPLATE
# ============================================================

gemini = GeminiLLM()

planner_llm = gemini.with_structured_output(
    YouTubeResearchRequest
)

plan_prompt_template = PlanYouTubeResearchPromptTemplate()


# ============================================================
# PLAN YOUTUBE RESEARCH (Functional)
# ============================================================

async def plan_youtube_research(
    user_query: str,
    num_videos: int,
) -> YouTubeResearchRequest:
    """
    Plan the YouTube search query and collection strategy using Gemini.

    Parameters
    ----------
    user_query:
        Raw user inquiry.
    num_videos:
        Target video count.

    Returns
    -------
    YouTubeResearchRequest:
        Structured research plan with search parameters and fields.
    """
    prompt = plan_prompt_template.render(
        user_query=user_query,
        num_videos=num_videos,
    )

    # Wrap the synchronous LLM call in a thread
    raw_request = await asyncio.to_thread(
        planner_llm.invoke,
        prompt,
    )

    # Convert / validate
    if isinstance(raw_request, YouTubeResearchRequest):
        request_data = raw_request.model_dump()
    else:
        request_data = raw_request

    # NEVER allow the LLM to mutate user-specified video count
    request_data["video_count"] = num_videos

    return YouTubeResearchRequest.model_validate(request_data)


# ============================================================
# COLLECT VIDEO DATA (Functional)
# ============================================================

async def collect_video_data(
    request: YouTubeResearchRequest,
) -> list[YouTubeVideoResult]:
    """
    Execute YouTube search and collect metadata and transcripts for candidate videos.

    Parameters
    ----------
    request:
        Validated YouTubeResearchRequest plan.

    Returns
    -------
    list[YouTubeVideoResult]:
        List of enriched video records.
    """
    results: list[YouTubeVideoResult] = []

    if not request.search_videos:
        return results

    # 1. Search YouTube
    videos = await asyncio.to_thread(
        search_youtube.invoke,
        {
            "query": request.topic,
            "max_results": request.video_count,
        },
    )

    # 2. Process candidate videos
    for index, video in enumerate(videos, start=1):
        video_id = video["video_id"]
        print(f"Processing video {index}/{len(videos)}: {video_id}...")

        result = YouTubeVideoResult(video_id=video_id)

        # Basic search fields
        if request.fields.title:
            result.title = video.get("title")
        if request.fields.description:
            result.description = video.get("description")
        if request.fields.channel:
            result.channel = video.get("channel")
        if request.fields.published_at:
            result.published_at = video.get("published_at")
        if request.fields.url:
            result.url = f"https://www.youtube.com/watch?v={video_id}"

        # Additional video details (statistics & missing fields)
        if request.get_details:
            try:
                details = await asyncio.to_thread(
                    get_video_details.invoke,
                    {"video_id": video_id},
                )

                if request.fields.views:
                    val = details.get("views")
                    result.views = int(val) if val is not None else None
                if request.fields.likes:
                    val = details.get("likes")
                    result.likes = int(val) if val is not None else None
                if request.fields.comments:
                    val = details.get("comments")
                    result.comments = int(val) if val is not None else None

                if request.fields.title and not result.title:
                    result.title = details.get("title")
                if request.fields.description and not result.description:
                    result.description = details.get("description")
                if request.fields.channel and not result.channel:
                    result.channel = details.get("channel")
                if request.fields.published_at and not result.published_at:
                    result.published_at = details.get("published_at")
            except Exception as exc:
                print(f"[WARNING] Details unavailable for {video_id}: {exc}")

        # Transcript collection
        if request.get_transcript and request.fields.transcript:
            try:
                transcript = await asyncio.to_thread(
                    get_video_transcript.invoke,
                    {
                        "video_id": video_id,
                        "max_chars": 15000,
                    },
                )

                if isinstance(transcript, dict):
                    if transcript.get("success", True):
                        result.transcript = (
                            transcript.get("transcript") or transcript.get("text")
                        )
                    else:
                        result.transcript = None
                else:
                    raw = str(transcript)
                    if raw.lower().startswith("transcript unavailable") or raw.lower().startswith("transcript parsing failed"):
                        result.transcript = None
                    else:
                        result.transcript = raw

                if result.transcript and result.transcript.strip():
                    result.transcript_available = True
                    if result.transcript.startswith("[Language:"):
                        lang_end = result.transcript.find("]")
                        if lang_end != -1:
                            result.transcript_language = result.transcript[10:lang_end].strip()
                    print(f"[OK] Transcript fetched for: {video_id}")
                else:
                    result.transcript = None
                    result.transcript_available = False
                    print(f"[WARNING] No transcript available for: {video_id}")

            except Exception as exc:
                print(f"[WARNING] Transcript exception for {video_id}: {exc}")
                result.transcript = None
                result.transcript_available = False

        validated_video = YouTubeVideoResult.model_validate(result.model_dump())
        results.append(validated_video)

    return results


# ============================================================
# AGENT 1 MAIN ENTRY POINT (Functional)
# ============================================================

async def youtube_research_agent(
    user_query: str,
    num_videos: int = 3,
) -> YouTubeResearchResult:
    """
    Main functional entry point for Agent 1.

    Requirements
    ------------
    - user_query: Non-empty string.
    - num_videos: Integer >= 1.

    Responsibilities
    ----------------
    1. Validates inputs.
    2. Runs planner to create YouTubeResearchRequest.
    3. Searches YouTube and fetches metadata and transcripts.
    4. Packages results into a validated YouTubeResearchResult.
    """
    if not user_query or not user_query.strip():
        raise ValueError("Research query cannot be empty.")

    if num_videos < 1:
        raise ValueError("num_videos must be at least 1.")

    print("\n[1/3] Planning YouTube research...")
    research_request = await plan_youtube_research(
        user_query=user_query,
        num_videos=num_videos,
    )

    print(f"Topic: {research_request.topic}")
    print(f"Videos requested: {research_request.video_count}")
    print(f"Transcript collection: {research_request.get_transcript}")

    print("\n[2/3] Searching YouTube...")
    print("\n[3/3] Collecting video data & transcripts...")
    videos = await collect_video_data(research_request)
    print(f"\nCollected {len(videos)} videos.")

    research_result = YouTubeResearchResult(
        research_request=research_request,
        videos=videos,
    )

    return YouTubeResearchResult.model_validate(research_result.model_dump())
