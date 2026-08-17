"""
Agent 3 — Final Report Generator

Responsibilities:
    1. Receive Agent 1 research results.
    2. Receive Agent 2 analysis + ranking.
    3. Generate the final research report.
    4. Return validated FinalReport.

This agent does NOT:
    - Search YouTube
    - Fetch transcripts
    - Generate embeddings
    - Query pgvector
    - Perform RAG
    - Re-rank resources
"""

from __future__ import annotations

from app.llm.gemini import GeminiLLM

from app.schema.youtube import (
    YouTubeResearchResult,
    YouTubeVideoResult,
    ResourceAnalysis,
    ResourceEvaluation,
    FinalReport,
)

from app.prompts.youtube_prompts import get_final_report_prompt


# ============================================================
# GEMINI
# ============================================================

gemini = GeminiLLM()

report_llm = gemini.with_structured_output(
    FinalReport
)


# ============================================================
# AGENT 3
# ============================================================

async def final_report_agent(
    user_query: str,
    research_result: YouTubeResearchResult,
    analysis: ResourceAnalysis,
) -> FinalReport:

    # ========================================================
    # 1. VALIDATE INPUT
    # ========================================================

    if not user_query or not user_query.strip():

        raise ValueError(
            "User query cannot be empty."
        )

    research_result = (
        YouTubeResearchResult.model_validate(
            research_result
        )
    )

    analysis = (
        ResourceAnalysis.model_validate(
            analysis
        )
    )

    if not research_result.videos:

        raise ValueError(
            "No YouTube research results available."
        )

    if not analysis.evaluations:

        raise ValueError(
            "No resource analysis available from Agent 2."
        )

    # ========================================================
    # 2. CREATE VIDEO LOOKUP
    # ========================================================

    videos_by_id: dict[
        str,
        YouTubeVideoResult
    ] = {
        video.video_id: video
        for video in research_result.videos
    }

    # ========================================================
    # 3. CREATE FINAL REPORT CONTEXT
    # ========================================================

    report_context = []

    for evaluation in analysis.evaluations:

        video = videos_by_id.get(
            evaluation.video_id
        )

        if not video:
            continue

        report_context.append(
            {
                "rank": evaluation.rank,

                "video_id": video.video_id,

                "title": video.title,

                "description": video.description,

                "url": video.url,

                "channel": video.channel,

                "published_at": video.published_at,

                "views": video.views,

                "likes": video.likes,

                "comments": video.comments,

                "transcript_available": (
                    video.transcript_available
                ),

                "transcript_language": (
                    video.transcript_language
                ),

                "relevance_score": (
                    evaluation.relevance_score
                ),

                "educational_quality_score": (
                    evaluation.educational_quality_score
                ),

                "coverage_score": (
                    evaluation.coverage_score
                ),

                "overall_score": (
                    evaluation.overall_score
                ),

                "beginner_friendly": (
                    evaluation.beginner_friendly
                ),

                "concepts_covered": (
                    evaluation.concepts_covered
                ),

                "strengths": (
                    evaluation.strengths
                ),

                "weaknesses": (
                    evaluation.weaknesses
                ),

                "recommendation_reason": (
                    evaluation.recommendation_reason
                ),
            }
        )

    # ========================================================
    # 4. FORMAT CONTEXT
    # ========================================================

    context_text = ""

    for resource in report_context:

        context_text += f"""
============================================================
RESOURCE
============================================================

Rank:
{resource["rank"]}

Video ID:
{resource["video_id"]}

Title:
{resource["title"]}

Channel:
{resource["channel"]}

URL:
{resource["url"]}

Published:
{resource["published_at"]}

Views:
{resource["views"]}

Likes:
{resource["likes"]}

Comments:
{resource["comments"]}

Transcript Available:
{resource["transcript_available"]}

Transcript Language:
{resource["transcript_language"]}

Relevance Score:
{resource["relevance_score"]}/10

Educational Quality:
{resource["educational_quality_score"]}/10

Coverage:
{resource["coverage_score"]}/10

Overall Score:
{resource["overall_score"]}/10

Beginner Friendly:
{resource["beginner_friendly"]}

Concepts Covered:
{resource["concepts_covered"]}

Strengths:
{resource["strengths"]}

Weaknesses:
{resource["weaknesses"]}

Recommendation Reason:
{resource["recommendation_reason"]}

Description:
{resource["description"]}

"""

    # ========================================================
    # 5. PROMPT
    # ========================================================

    prompt = get_final_report_prompt(
        user_query=user_query,
        context_text=context_text,
    )

    # ========================================================
    # 6. GEMINI ASYNC INVOCATION
    # ========================================================

    print(
        "\n[Agent 3] Generating final report..."
    )

    raw_report = await report_llm.ainvoke(
        prompt
    )

    # ========================================================
    # 7. VALIDATE OUTPUT
    # ========================================================

    report = FinalReport.model_validate(
        raw_report
    )

    print(
        "[Agent 3] Final report generated."
    )

    return report