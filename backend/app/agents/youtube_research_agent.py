"""
Agent 1 — Planner + YouTube Research

Responsibilities:
    1. Understand the user's research query.
    2. Create a structured YouTubeResearchRequest.
    3. Search YouTube.
    4. Fetch video details.
    5. Fetch transcripts.
    6. Return validated YouTubeResearchResult.

This agent does NOT:
    - Generate embeddings
    - Store vectors
    - Perform RAG
    - Analyze content
    - Rank resources
    - Generate the final report
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

from app.prompts.youtube_prompts import get_plan_youtube_research_prompt


# ============================================================
# GEMINI
# ============================================================

gemini = GeminiLLM()


# ============================================================
# STRUCTURED PLANNER
# ============================================================

planner_llm = gemini.with_structured_output(
    YouTubeResearchRequest
)


# ============================================================
# PLAN YOUTUBE RESEARCH
# ============================================================

async def plan_youtube_research(
    user_query: str,
    num_videos: int,
) -> YouTubeResearchRequest:

    prompt = get_plan_youtube_research_prompt(
        user_query=user_query,
        num_videos=num_videos,
    )

    # Wrap the synchronous LLM call in a thread
    raw_request = await asyncio.to_thread(
        planner_llm.invoke,
        prompt,
    )

    # --------------------------------------------------------
    # Convert / validate
    # --------------------------------------------------------

    if isinstance(
        raw_request,
        YouTubeResearchRequest
    ):
        request_data = raw_request.model_dump()

    else:
        request_data = raw_request

    # --------------------------------------------------------
    # NEVER allow the LLM to change requested count
    # --------------------------------------------------------

    request_data["video_count"] = num_videos

    # --------------------------------------------------------
    # Validate final request
    # --------------------------------------------------------

    return YouTubeResearchRequest.model_validate(
        request_data
    )


# ============================================================
# COLLECT VIDEO DATA
# ============================================================

async def collect_video_data(
    request: YouTubeResearchRequest,
) -> list[YouTubeVideoResult]:

    results: list[YouTubeVideoResult] = []

    # ========================================================
    # SEARCH
    # ========================================================

    if not request.search_videos:

        return results

    # Wrap synchronous YouTube tool call
    videos = await asyncio.to_thread(
        search_youtube.invoke,
        {
            "query": request.topic,
            "max_results": request.video_count,
        },
    )

    # ========================================================
    # PROCESS VIDEOS
    # ========================================================

    for index, video in enumerate(
        videos,
        start=1,
    ):

        video_id = video["video_id"]

        print(
            f"Processing video "
            f"{index}/{len(videos)}..."
        )

        # ----------------------------------------------------
        # INITIAL RESULT
        # ----------------------------------------------------

        result = YouTubeVideoResult(
            video_id=video_id
        )

        # ====================================================
        # SEARCH RESULT FIELDS
        # ====================================================

        if request.fields.title:

            result.title = video.get(
                "title"
            )

        if request.fields.description:

            result.description = video.get(
                "description"
            )

        if request.fields.channel:

            result.channel = video.get(
                "channel"
            )

        if request.fields.published_at:

            result.published_at = video.get(
                "published_at"
            )

        if request.fields.url:

            result.url = (
                f"https://www.youtube.com/watch?v="
                f"{video_id}"
            )

        # ====================================================
        # VIDEO DETAILS
        # ====================================================

        if request.get_details:

            try:

                details = await asyncio.to_thread(
                    get_video_details.invoke,
                    {"video_id": video_id},
                )

                # --------------------------------------------
                # VIEWS
                # --------------------------------------------

                if request.fields.views:

                    value = details.get(
                        "views"
                    )

                    result.views = (
                        int(value)
                        if value is not None
                        else None
                    )

                # --------------------------------------------
                # LIKES
                # --------------------------------------------

                if request.fields.likes:

                    value = details.get(
                        "likes"
                    )

                    result.likes = (
                        int(value)
                        if value is not None
                        else None
                    )

                # --------------------------------------------
                # COMMENTS
                # --------------------------------------------

                if request.fields.comments:

                    value = details.get(
                        "comments"
                    )

                    result.comments = (
                        int(value)
                        if value is not None
                        else None
                    )

                # --------------------------------------------
                # Fill missing metadata from details
                # --------------------------------------------

                if (
                    request.fields.title
                    and not result.title
                ):
                    result.title = details.get(
                        "title"
                    )

                if (
                    request.fields.description
                    and not result.description
                ):
                    result.description = details.get(
                        "description"
                    )

                if (
                    request.fields.channel
                    and not result.channel
                ):
                    result.channel = details.get(
                        "channel"
                    )

                if (
                    request.fields.published_at
                    and not result.published_at
                ):
                    result.published_at = details.get(
                        "published_at"
                    )

            except Exception as e:

                print(
                    f"[WARNING] Details unavailable "
                    f"for {video_id}: {e}"
                )

        # ====================================================
        # TRANSCRIPT
        # ====================================================

        if (
            request.get_transcript
            and request.fields.transcript
        ):

            try:

                transcript = await asyncio.to_thread(
                    get_video_transcript.invoke,
                    {
                        "video_id": video_id,
                        "max_chars": 15000,
                    },
                )

                # ------------------------------------------------
                # Handle tools that return a dictionary
                # ------------------------------------------------

                if isinstance(
                    transcript,
                    dict,
                ):

                    if transcript.get(
                        "success",
                        True,
                    ):

                        result.transcript = (
                            transcript.get(
                                "transcript"
                            )
                            or transcript.get(
                                "text"
                            )
                        )

                    else:

                        result.transcript = None

                # ------------------------------------------------
                # Handle tools returning plain string
                # ------------------------------------------------

                else:

                    raw = str(transcript)

                    # Tool returns "Transcript unavailable: ..."
                    # when it fails — detect this
                    if raw.lower().startswith(
                        "transcript unavailable"
                    ) or raw.lower().startswith(
                        "transcript parsing failed"
                    ):
                        result.transcript = None
                    else:
                        result.transcript = raw

                # ------------------------------------------------
                # Set transcript_available flag
                # ------------------------------------------------

                if result.transcript and result.transcript.strip():

                    result.transcript_available = True

                    # Try to extract language tag [Language: en]
                    if result.transcript.startswith("[Language:"):
                        lang_end = result.transcript.find("]")
                        if lang_end != -1:
                            lang_part = result.transcript[10:lang_end].strip()
                            result.transcript_language = lang_part

                    print(
                        f"[OK] Transcript fetched: "
                        f"{video_id}"
                    )

                else:

                    result.transcript = None
                    result.transcript_available = False

                    print(
                        f"[WARNING] No transcript "
                        f"available: {video_id}"
                    )

            except Exception as e:

                print(
                    f"[WARNING] No transcript "
                    f"available: {video_id}: {e}"
                )

                result.transcript = None
                result.transcript_available = False

        # ====================================================
        # VALIDATE VIDEO
        # ====================================================

        result = YouTubeVideoResult.model_validate(
            result.model_dump()
        )

        results.append(
            result
        )

    return results


# ============================================================
# AGENT 1
# ============================================================

async def youtube_research_agent(
    user_query: str,
    num_videos: int = 3,
) -> YouTubeResearchResult:

    # ========================================================
    # VALIDATE INPUT
    # ========================================================

    if not user_query.strip():

        raise ValueError(
            "Research query cannot be empty."
        )

    if num_videos < 1:

        raise ValueError(
            "num_videos must be at least 1."
        )

    # ========================================================
    # STEP 1 — PLANNING
    # ========================================================

    print(
        "\n[1/3] Planning YouTube research..."
    )

    research_request = (
        await plan_youtube_research(
            user_query=user_query,
            num_videos=num_videos,
        )
    )

    print(
        f"Topic: "
        f"{research_request.topic}"
    )

    print(
        f"Videos requested: "
        f"{research_request.video_count}"
    )

    print(
        f"Transcript collection: "
        f"{research_request.get_transcript}"
    )

    # ========================================================
    # STEP 2 — SEARCH
    # ========================================================

    print(
        "\n[2/3] Searching YouTube..."
    )

    # ========================================================
    # STEP 3 — COLLECT
    # ========================================================

    print(
        "\n[3/3] Collecting video data..."
    )

    videos = await collect_video_data(
        research_request
    )

    print(
        f"\nCollected {len(videos)} videos."
    )

    # ========================================================
    # FINAL RESULT
    # ========================================================

    research_result = YouTubeResearchResult(
        research_request=research_request,
        videos=videos,
    )

    # ========================================================
    # FINAL VALIDATION
    # ========================================================

    return YouTubeResearchResult.model_validate(
        research_result.model_dump()
    )