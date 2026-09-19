"""
Agent 3: Synthesis + Learning Path + Final Report Generation.

==============================================================================
WHAT THIS AGENT DOES:
==============================================================================
Agent 3 is the terminal synthesis engine of the ResearchTube pipeline.
It takes the structured research results from Agent 1 and the RAG-backed evaluations
and rankings from Agent 2, and synthesizes a publication-ready, pedagogical research
report containing an executive summary, learning path, recommended resources,
key topics, methodology, limitations, and conclusion.

==============================================================================
REQUIREMENTS & PREREQUISITES:
==============================================================================
- Input Parameters:
    - `user_query` (str): Original user inquiry.
    - `research_result` (YouTubeResearchResult): Output produced by Agent 1.
    - `analysis` (ResourceAnalysis): Output produced by Agent 2 (ranked evaluations).
- LLM:
    - Gemini LLM with structured output bound to `FinalReport`.
- Prompt:
    - `FinalReportPromptTemplate` rendering the synthesis instructions.

==============================================================================
RESPONSIBILITIES:
==============================================================================
1. Merge video metadata from Agent 1 with evaluation scores and rankings from Agent 2.
2. Ensure strict preservation of Agent 2's rankings and scores (never recalculate).
3. Generate a structured FinalReport containing:
   - `research_question`: Exact user query.
   - `executive_summary`: High-level summary of domain and recommendations.
   - `recommended_resources`: Ranked list of resources with metadata and scores.
   - `learning_path`: Ordered pedagogical steps derived from evaluated concepts.
   - `key_topics`: Core concepts extracted across all analyzed resources.
   - `methodology`: Transparent description of the multi-agent research approach.
   - `limitations`: Identified constraints (e.g. missing transcripts, narrow search).
   - `conclusion`: Direct actionable recommendation.
4. Validate and return the final `FinalReport` object.

==============================================================================
NON-RESPONSIBILITIES (What this agent MUST NOT do):
==============================================================================
- DOES NOT search YouTube or fetch new videos (delegated to Agent 1).
- DOES NOT perform new RAG searches or re-query pgvector (delegated to Agent 2).
- DOES NOT re-rank or alter the quality scores determined by Agent 2.
- DOES NOT invent resources or citations not present in the input.
==============================================================================
"""

from __future__ import annotations

import asyncio
from typing import Any

from app.llm.dual import DualLLM
from app.schema.youtube import (
    YouTubeResearchResult,
    YouTubeVideoResult,
    ResourceAnalysis,
    ResourceEvaluation,
    FinalReport,
)
from app.prompts.youtube import FinalReportPromptTemplate


# ============================================================
# DUAL LLM & PROMPT TEMPLATE
# ============================================================

llm_provider = DualLLM()

report_llm = llm_provider.with_structured_output(
    FinalReport
)

report_prompt_template = FinalReportPromptTemplate()


# ============================================================
# BUILD FINAL REPORT CONTEXT (Functional)
# ============================================================

def build_final_report_context(
    research_result: YouTubeResearchResult,
    analysis: ResourceAnalysis,
) -> list[dict[str, Any]]:
    """
    Merge Agent 1 video metadata with Agent 2 evaluations, sorted by rank.
    """
    video_map: dict[str, YouTubeVideoResult] = {
        video.video_id: video for video in research_result.videos
    }

    report_context: list[dict[str, Any]] = []

    for eval_item in analysis.evaluations:
        video = video_map.get(eval_item.video_id)

        resource_data: dict[str, Any] = {
            "rank": eval_item.rank,
            "video_id": eval_item.video_id,
            "title": eval_item.title or (video.title if video else ""),
            "channel": video.channel if video else None,
            "url": video.url if video else None,
            "published_at": video.published_at if video else None,
            "views": video.views if video else None,
            "likes": video.likes if video else None,
            "comments": video.comments if video else None,
            "description": video.description if video else None,
            "relevance_score": eval_item.relevance_score,
            "educational_quality_score": eval_item.educational_quality_score,
            "coverage_score": eval_item.coverage_score,
            "overall_score": eval_item.overall_score,
            "beginner_friendly": eval_item.beginner_friendly,
            "concepts_covered": eval_item.concepts_covered,
            "strengths": eval_item.strengths,
            "weaknesses": eval_item.weaknesses,
            "recommendation_reason": eval_item.recommendation_reason,
        }

        report_context.append(resource_data)

    report_context.sort(key=lambda x: x["rank"])
    return report_context


# ============================================================
# FORMAT FINAL REPORT CONTEXT (Functional)
# ============================================================

def format_final_report_context(
    report_context: list[dict[str, Any]],
) -> str:
    """
    Format merged evaluation context into prompt text.
    """
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

Relevance Score:
{resource["relevance_score"]}/10

Educational Quality Score:
{resource["educational_quality_score"]}/10

Coverage Score:
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

    return context_text


# ============================================================
# AGENT 3 MAIN ENTRY POINT (Functional)
# ============================================================

async def final_report_agent(
    user_query: str,
    research_result: YouTubeResearchResult,
    analysis: ResourceAnalysis,
) -> FinalReport:
    """
    Main functional entry point for Agent 3.

    Requirements
    ------------
    - user_query: Non-empty string.
    - research_result: Validated output from Agent 1.
    - analysis: Validated output from Agent 2 with ranked evaluations.

    Responsibilities
    ----------------
    1. Validates inputs.
    2. Builds merged context linking video metadata with Agent 2 evaluations.
    3. Prompts Gemini with synthesis instructions and strict ranking fidelity.
    4. Validates and returns FinalReport.
    """
    if not user_query or not user_query.strip():
        raise ValueError("User query cannot be empty.")

    research_result = YouTubeResearchResult.model_validate(research_result)
    analysis = ResourceAnalysis.model_validate(analysis)

    if not analysis.evaluations:
        raise ValueError("Agent 2 resource evaluations cannot be empty.")

    report_context = build_final_report_context(
        research_result=research_result,
        analysis=analysis,
    )

    context_text = format_final_report_context(report_context)

    prompt = report_prompt_template.render(
        user_query=user_query,
        context_text=context_text,
    )

    print("\n[Agent 3: Final Report] Synthesizing final pedagogical report with Dual LLM...")
    raw_report = await asyncio.to_thread(
        report_llm.invoke,
        prompt,
    )

    final_report = FinalReport.model_validate(raw_report)
    print("[Agent 3] Final report successfully generated.")

    return final_report
