"""
Test driver for Agent 2 — RAG + Context Analysis

Flow:

User Query
    ↓
Agent 1
    ↓
YouTubeResearchResult
    ↓
PostgreSQL + pgvector
    ↓
Agent 2
    ↓
ResourceAnalysis
"""

import asyncio
from pprint import pprint

from app.agents.youtube_research_agent import (
    youtube_research_agent,
)

from app.agents.context_analysis_agent import (
    context_analysis_agent,
)

from app.db.database import AsyncSessionLocal


# ============================================================
# AGENT 2 TEST
# ============================================================

async def test_agent_2():

    print()
    print("=" * 80)
    print("AGENT 2 — RAG + CONTEXT ANALYSIS TEST")
    print("=" * 80)

    # ========================================================
    # 1. USER INPUT
    # ========================================================

    query = input(
        "\nEnter research query: "
    ).strip()

    videos_input = input(
        "Number of videos [3]: "
    ).strip()

    num_videos = (
        int(videos_input)
        if videos_input
        else 3
    )

    if not query:
        raise ValueError(
            "Research query cannot be empty."
        )

    if num_videos < 1:
        raise ValueError(
            "Number of videos must be at least 1."
        )

    # ========================================================
    # 2. RUN AGENT 1
    # ========================================================

    print()
    print("=" * 80)
    print("[1/2] RUNNING AGENT 1")
    print("=" * 80)

    research_result = youtube_research_agent(
        user_query=query,
        num_videos=num_videos,
    )

    print()
    print(
        f"Agent 1 collected "
        f"{len(research_result.videos)} videos."
    )

    # ========================================================
    # 3. SHOW COLLECTED VIDEOS
    # ========================================================

    print()
    print("Collected videos:")
    print()

    for index, video in enumerate(
        research_result.videos,
        start=1,
    ):

        print(
            f"{index}. {video.title}"
        )

        print(
            f"   Video ID: {video.video_id}"
        )

        print(
            f"   Channel: {video.channel}"
        )

        print(
            f"   URL: {video.url}"
        )

        print(
            f"   Transcript available: "
            f"{video.transcript_available}"
        )

        print()

    # ========================================================
    # 4. CREATE DATABASE SESSION
    # ========================================================

    print("=" * 80)
    print("[2/2] RUNNING AGENT 2")
    print("=" * 80)

    async with AsyncSessionLocal() as session:

        try:

            analysis = await context_analysis_agent(

                session=session,

                user_query=query,

                research_result=research_result,
            )

        except Exception as e:

            print()
            print("=" * 80)
            print("AGENT 2 FAILED")
            print("=" * 80)

            print()
            print(
                f"Error type: {type(e).__name__}"
            )

            print(
                f"Error: {e}"
            )

            raise

    # ========================================================
    # 5. PRINT COMPLETE RESULT
    # ========================================================

    print()
    print("=" * 80)
    print("AGENT 2 COMPLETED")
    print("=" * 80)

    print()

    print(
        analysis.model_dump_json(
            indent=2
        )
    )

    # ========================================================
    # 6. PRINT HUMAN-READABLE SUMMARY
    # ========================================================

    print()
    print("=" * 80)
    print("RESOURCE ANALYSIS")
    print("=" * 80)

    print()

    for index, evaluation in enumerate(
        analysis.evaluations,
        start=1,
    ):

        print(
            f"{index}. {evaluation.title}"
        )

        print(
            f"   Video ID: "
            f"{evaluation.video_id}"
        )

        print(
            f"   Relevance: "
            f"{evaluation.relevance_score}/10"
        )

        print(
            f"   Educational Quality: "
            f"{evaluation.educational_quality_score}/10"
        )

        print(
            f"   Coverage: "
            f"{evaluation.coverage_score}/10"
        )

        print(
            f"   Beginner Friendly: "
            f"{evaluation.beginner_friendly}"
        )

        print()

        print(
            "   Concepts:"
        )

        for concept in evaluation.concepts_covered:

            print(
                f"      - {concept}"
            )

        print()

        print(
            "   Strengths:"
        )

        for strength in evaluation.strengths:

            print(
                f"      - {strength}"
            )

        print()

        print(
            "   Weaknesses:"
        )

        for weakness in evaluation.weaknesses:

            print(
                f"      - {weakness}"
            )

        print()

        print(
            "   Recommendation:"
        )

        print(
            f"      {evaluation.recommendation_reason}"
        )

        print()
        print("-" * 80)
        print()


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    asyncio.run(
        test_agent_2()
    )