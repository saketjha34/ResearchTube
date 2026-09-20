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
import re
from typing import Optional

from app.llm.dual import DualLLM
from app.schema.youtube import (
    VideoFields,
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
# DUAL LLM & PROMPT TEMPLATE
# ============================================================

llm_provider = DualLLM()

planner_llm = llm_provider.with_structured_output(
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
    Plan the YouTube search query and collection strategy using Dual LLM
    (OpenAI gpt-5-mini primary, Gemini fallback).

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
    print(f"\n[Agent 1: Planner] Generating research plan for query: '{user_query}' (target videos: {num_videos})...")

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
# YOUTUBE URL / ID PARSER
# ============================================================

YOUTUBE_URL_PATTERNS = [
    r"(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?(?:[^ \n\t\r\"\'<]*&)?v=([a-zA-Z0-9_-]{11})",
    r"(?:https?:\/\/)?(?:www\.|m\.)?youtu\.be\/([a-zA-Z0-9_-]{11})",
    r"(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(?:embed|v|shorts|live)\/([a-zA-Z0-9_-]{11})",
]


def extract_all_youtube_video_ids(text: str | None) -> list[str]:
    """
    Extract all unique 11-character YouTube video IDs from a URL, list of URLs,
    or freeform text containing multiple YouTube links.
    Preserves order of appearance.
    """
    if not text or not text.strip():
        return []

    found: list[str] = []
    seen: set[str] = set()

    for pattern in YOUTUBE_URL_PATTERNS:
        for match in re.finditer(pattern, text):
            vid = match.group(1)
            if vid not in seen:
                seen.add(vid)
                found.append(vid)

    # Check for standalone 11-character alphanumeric tokens (e.g. raw video IDs)
    tokens = re.split(r"[\s,;|\n\r]+", text.strip())
    for token in tokens:
        token = token.strip()
        if re.fullmatch(r"[a-zA-Z0-9_-]{11}", token):
            if token not in seen:
                seen.add(token)
                found.append(token)

    return found


def extract_youtube_video_id(text: str | None) -> Optional[str]:
    """Backward compatibility helper: returns the first video ID found or None."""
    ids = extract_all_youtube_video_ids(text)
    return ids[0] if ids else None


# ============================================================
# FETCH SINGLE VIDEO (Metadata + Details + Transcript)
# ============================================================

async def fetch_single_video(
    video_id: str,
    request: YouTubeResearchRequest,
    preloaded_info: Optional[dict] = None,
) -> YouTubeVideoResult:
    """
    Fetch metadata, statistics, and transcript for a single YouTube video.
    """
    result = YouTubeVideoResult(video_id=video_id)
    info = preloaded_info or {}

    # 1. Populate basic search fields if available
    if request.fields.title:
        result.title = info.get("title")
    if request.fields.description:
        result.description = info.get("description")
    if request.fields.channel:
        result.channel = info.get("channel")
    if request.fields.published_at:
        result.published_at = info.get("published_at")
    if request.fields.url:
        result.url = f"https://www.youtube.com/watch?v={video_id}"

    # 2. Fetch detailed statistics or missing metadata
    need_details = request.get_details or not result.title or not result.channel
    if need_details:
        try:
            details = await asyncio.to_thread(
                get_video_details.invoke,
                {"video_id": video_id},
            )

            if details.get("success", True):
                if request.fields.views:
                    val = details.get("views")
                    result.views = int(val) if val is not None else None
                if request.fields.likes:
                    val = details.get("likes")
                    result.likes = int(val) if val is not None else None
                if request.fields.comments:
                    val = details.get("comments")
                    result.comments = int(val) if val is not None else None

                if not result.title:
                    result.title = details.get("title")
                if not result.description:
                    result.description = details.get("description")
                if not result.channel:
                    result.channel = details.get("channel")
                if not result.published_at:
                    result.published_at = details.get("published_at")
                if not result.url:
                    result.url = details.get("url") or f"https://www.youtube.com/watch?v={video_id}"
        except Exception as exc:
            print(f"[WARNING] Details unavailable for {video_id}: {exc}")

    # Ensure url is always populated
    if not result.url:
        result.url = f"https://www.youtube.com/watch?v={video_id}"

    # 3. Transcript collection
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

    return YouTubeVideoResult.model_validate(result.model_dump())


# ============================================================
# COLLECT VIDEO DATA (Functional)
# ============================================================

async def collect_video_data(
    request: YouTubeResearchRequest,
    direct_video_ids: Optional[list[str]] = None,
) -> list[YouTubeVideoResult]:
    """
    Execute YouTube search or direct video fetch, and collect metadata and transcripts.
    Handles multiple direct video links/IDs as well as natural-language search queries.
    """
    results: list[YouTubeVideoResult] = []
    seen_ids: set[str] = set()

    # Determine all target video IDs (from parameter or parsed from topic)
    target_video_ids = list(direct_video_ids or [])
    if not target_video_ids:
        target_video_ids = extract_all_youtube_video_ids(request.topic)

    # 1. Fetch all direct videos concurrently
    if target_video_ids:
        print(f"Direct video targets detected ({len(target_video_ids)} videos): {target_video_ids}. Fetching data...")
        tasks = [
            fetch_single_video(vid, request)
            for vid in target_video_ids
        ]
        direct_results = await asyncio.gather(*tasks, return_exceptions=True)
        for vid, res in zip(target_video_ids, direct_results):
            if isinstance(res, YouTubeVideoResult):
                results.append(res)
                seen_ids.add(vid)
            else:
                print(f"[WARNING] Failed to fetch direct video {vid}: {res}")

        # If all requested videos are satisfied or search is disabled, return directly
        if len(results) >= request.video_count or not request.search_videos:
            return results

    # 2. If more videos are needed and search_videos is enabled
    remaining_count = max(0, request.video_count - len(results))
    if remaining_count > 0:
        search_query = request.topic
        # If topic was purely a list of URLs and we fetched direct videos, use the title of the first video
        if target_video_ids and results and results[0].title:
            search_query = results[0].title

        print(f"Searching YouTube for {remaining_count} additional videos (query: '{search_query}')...")
        try:
            candidate_videos = await asyncio.to_thread(
                search_youtube.invoke,
                {
                    "query": search_query,
                    "max_results": remaining_count + 3,
                },
            )
        except Exception as exc:
            print(f"[WARNING] YouTube search failed: {exc}")
            candidate_videos = []

        for video in candidate_videos:
            vid = video.get("video_id")
            if not vid or vid in seen_ids:
                continue

            print(f"Processing candidate video {len(results) + 1}/{request.video_count}: {vid}...")
            video_result = await fetch_single_video(vid, request, preloaded_info=video)
            results.append(video_result)
            seen_ids.add(vid)

            if len(results) >= request.video_count:
                break

    # 3. Safeguard: if results is still empty
    if not results:
        print(f"[Fallback] No videos collected yet. Attempting search with topic: '{request.topic}'...")
        try:
            candidate_videos = await asyncio.to_thread(
                search_youtube.invoke,
                {
                    "query": request.topic,
                    "max_results": request.video_count,
                },
            )
            for video in candidate_videos:
                vid = video.get("video_id")
                if not vid or vid in seen_ids:
                    continue
                video_result = await fetch_single_video(vid, request, preloaded_info=video)
                results.append(video_result)
                seen_ids.add(vid)
                if len(results) >= request.video_count:
                    break
        except Exception as exc:
            print(f"[ERROR] Fallback search failed: {exc}")

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
    2. Runs planner to create YouTubeResearchRequest (or builds direct plan if video link given).
    3. Searches YouTube and fetches metadata and transcripts.
    4. Packages results into a validated YouTubeResearchResult.
    """
    if not user_query or not user_query.strip():
        raise ValueError("Research query cannot be empty.")

    if num_videos < 1:
        raise ValueError("num_videos must be at least 1.")

    direct_video_ids = extract_all_youtube_video_ids(user_query)
    target_count = max(num_videos, len(direct_video_ids))

    print("\n[1/3] Planning YouTube research...")
    if direct_video_ids and len(direct_video_ids) >= target_count:
        print(f"[Agent 1: Planner] {len(direct_video_ids)} direct YouTube video(s) detected: {direct_video_ids}. Building direct plan...")
        research_request = YouTubeResearchRequest(
            topic=user_query.strip(),
            video_count=len(direct_video_ids),
            search_videos=False,
            get_details=True,
            get_transcript=True,
            fields=VideoFields(
                title=True,
                description=True,
                url=True,
                channel=True,
                published_at=True,
                views=True,
                likes=True,
                comments=True,
                transcript=True,
            ),
        )
    else:
        research_request = await plan_youtube_research(
            user_query=user_query,
            num_videos=target_count,
        )
        research_request.video_count = target_count

    print(f"Topic: {research_request.topic}")
    print(f"Videos requested: {research_request.video_count}")
    print(f"Transcript collection: {research_request.get_transcript}")

    print("\n[2/3] Searching YouTube / Fetching videos...")
    print("\n[3/3] Collecting video data & transcripts...")
    videos = await collect_video_data(research_request, direct_video_ids=direct_video_ids)
    print(f"\nCollected {len(videos)} videos.")

    research_result = YouTubeResearchResult(
        research_request=research_request,
        videos=videos,
    )

    return YouTubeResearchResult.model_validate(research_result.model_dump())
