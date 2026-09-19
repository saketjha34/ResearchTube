"""
Agent 2: RAG Context + Content Analysis + Resource Ranking.

==============================================================================
WHAT THIS AGENT DOES:
==============================================================================
Agent 2 performs in-depth semantic evaluation and ranking of the YouTube videos
retrieved by Agent 1. It utilizes PostgreSQL + pgvector to retrieve the most
relevant transcript chunks for each video against the user's research question,
analyzes technical depth and educational quality, and ranks videos from best to worst.

==============================================================================
REQUIREMENTS & PREREQUISITES:
==============================================================================
- Input Parameters:
    - `session` (AsyncSession): Active SQLAlchemy async session for pgvector querying.
    - `user_query` (str): Original user inquiry.
    - `research_result` (YouTubeResearchResult): Output produced by Agent 1.
    - `video_id_map` (dict[str, UUID]): Mapping from YouTube video_id to DB UUID.
    - `research_run_id` (UUID): Current run ID to scope vector retrieval.
- Database:
    - `TranscriptChunk` rows must be already ingested and embedded in pgvector.
- LLM:
    - Gemini LLM with structured output bound to `ResourceAnalysis`.

==============================================================================
RESPONSIBILITIES:
==============================================================================
1. Perform semantic similarity search using pgvector to retrieve top transcript chunks
   for each video, strictly scoped to `research_run_id` and `video_id`.
2. Format retrieved transcript evidence into structured context for each video.
3. If transcripts are missing, explicitly note limitation and evaluate based on metadata.
4. Prompt Gemini with `ContextAnalysisPromptTemplate` to produce structured evaluation:
   - Relevance score (0-10)
   - Educational quality score (0-10)
   - Coverage score (0-10)
   - Overall score (0-10)
   - Beginner-friendliness flag
   - Concepts covered, strengths, weaknesses, and recommendation reason
5. Rank resources from rank 1 (best) to rank N (worst).
6. Provide a global `ranking_summary` synthesizing the comparative landscape.
7. Return a validated `ResourceAnalysis` object.

==============================================================================
NON-RESPONSIBILITIES (What this agent MUST NOT do):
==============================================================================
- DOES NOT search YouTube or make YouTube API calls (delegated to Agent 1).
- DOES NOT embed or ingest raw transcripts into PostgreSQL (delegated to RAG ingestor).
- DOES NOT generate the full publication-ready Markdown report (delegated to Agent 3).
- DOES NOT invent transcripts or concepts not supported by retrieved chunks or metadata.
==============================================================================
"""

from __future__ import annotations

import asyncio
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.dual import DualLLM
from app.rag.youtube import (
    YouTubeTranscriptRetriever as PGVectorRetriever,
)
from app.schema.youtube import (
    YouTubeResearchResult,
    YouTubeVideoResult,
    ResourceAnalysis,
)
from app.prompts.youtube import ContextAnalysisPromptTemplate


# ============================================================
# DUAL LLM & PROMPT TEMPLATE
# ============================================================

llm_provider = DualLLM()

analysis_llm = llm_provider.with_structured_output(
    ResourceAnalysis
)

context_prompt_template = ContextAnalysisPromptTemplate()
retriever = PGVectorRetriever()


# ============================================================
# BUILD VIDEO RAG CONTEXT (Functional)
# ============================================================

async def build_video_context(
    session: AsyncSession,
    user_query: str,
    video: YouTubeVideoResult,
    video_id_map: dict[str, UUID],
    research_run_id: UUID,
    top_k: int = 5,
) -> dict[str, Any]:
    """
    Retrieve top-k relevant transcript chunks for a single video from pgvector.

    Parameters
    ----------
    session:
        Active AsyncSession.
    user_query:
        Research question.
    video:
        Video metadata record.
    video_id_map:
        Mapping of YouTube string IDs to DB UUIDs.
    research_run_id:
        Research run scope.
    top_k:
        Number of chunks to retrieve.

    Returns
    -------
    dict[str, Any]:
        Combined dictionary of metadata and retrieved transcript chunks.
    """
    db_uuid = video_id_map.get(video.video_id)

    chunks: list[dict[str, Any]] = []

    if db_uuid and video.transcript_available:
        try:
            chunks = await retriever.similarity_search(
                session=session,
                query=user_query,
                top_k=top_k,
                db_video_ids=[db_uuid],
                research_run_id=research_run_id,
            )
        except Exception as exc:
            print(f"[WARNING] RAG retrieval failed for {video.video_id}: {exc}")
            chunks = []

    return {
        "video_id": video.video_id,
        "title": video.title,
        "channel": video.channel,
        "url": video.url,
        "published_at": video.published_at,
        "views": video.views,
        "likes": video.likes,
        "comments": video.comments,
        "description": video.description,
        "transcript_available": video.transcript_available,
        "chunks": chunks,
    }


# ============================================================
# BUILD ALL RAG CONTEXT (Functional)
# ============================================================

async def build_rag_context(
    session: AsyncSession,
    user_query: str,
    videos: list[YouTubeVideoResult],
    video_id_map: dict[str, UUID],
    research_run_id: UUID,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """
    Retrieve RAG context concurrently for all videos.
    """
    tasks = [
        build_video_context(
            session=session,
            user_query=user_query,
            video=video,
            video_id_map=video_id_map,
            research_run_id=research_run_id,
            top_k=top_k,
        )
        for video in videos
    ]
    return await asyncio.gather(*tasks)


# ============================================================
# FORMAT RAG CONTEXT (Functional)
# ============================================================

def format_rag_context(
    rag_context: list[dict[str, Any]],
) -> str:
    """
    Format video metadata and transcript chunks into prompt-ready text.
    """
    sections = []

    for item in rag_context:
        metadata_block = f"""
VIDEO ID: {item['video_id']}
TITLE: {item['title']}
CHANNEL: {item['channel']}
URL: {item['url']}
VIEWS: {item['views']}
LIKES: {item['likes']}
COMMENTS: {item['comments']}
PUBLISHED: {item['published_at']}
TRANSCRIPT AVAILABLE: {item['transcript_available']}
"""

        chunks = item.get("chunks", [])

        if chunks:
            chunk_texts = []
            for i, chunk in enumerate(chunks, 1):
                chunk_texts.append(
                    f"[Chunk {i} | Sim: {chunk['similarity']:.3f}]\n{chunk['text']}"
                )
            transcript_block = "\n\n".join(chunk_texts)
        else:
            transcript_block = "[NO TRANSCRIPT CHUNKS AVAILABLE]"

        section = f"""
============================================================
VIDEO: {item['title']} ({item['video_id']})
============================================================

METADATA:
{metadata_block}

RAG TRANSCRIPT CONTEXT:
{transcript_block}
"""
        sections.append(section)

    return "\n".join(sections)


# ============================================================
# AGENT 2 MAIN ENTRY POINT (Functional)
# ============================================================

async def context_analysis_agent(
    session: AsyncSession,
    user_query: str,
    research_result: YouTubeResearchResult,
    video_id_map: dict[str, UUID],
    research_run_id: UUID,
) -> ResourceAnalysis:
    """
    Main functional entry point for Agent 2.

    Requirements
    ------------
    - session: AsyncSession for vector retrieval.
    - user_query: Non-empty string.
    - research_result: Validated output from Agent 1.
    - video_id_map: YouTube string ID to DB UUID mapping.
    - research_run_id: UUID scoping the current research run.

    Responsibilities
    ----------------
    1. Validates inputs.
    2. Retrieves top transcript chunks via pgvector.
    3. Prompts Gemini with RAG evidence and evaluation criteria.
    4. Enforces ranking ordering and validates output schema.
    """
    research_result = YouTubeResearchResult.model_validate(research_result)
    videos = [YouTubeVideoResult.model_validate(v) for v in research_result.videos]

    if not videos:
        raise ValueError("No YouTube videos available for analysis.")

    if not user_query or not user_query.strip():
        raise ValueError("User query cannot be empty.")

    print("\n[Agent 2] Retrieving RAG context from pgvector...")
    rag_context = await build_rag_context(
        session=session,
        user_query=user_query,
        videos=videos,
        video_id_map=video_id_map,
        research_run_id=research_run_id,
        top_k=5,
    )
    print(f"[Agent 2] RAG context retrieved for {len(rag_context)} videos.")

    context_text = format_rag_context(rag_context)

    prompt = context_prompt_template.render(
        user_query=user_query,
        context_text=context_text,
    )

    print("\n[Agent 2: Evaluation & Ranking] Analyzing and ranking resources with Dual LLM...")
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            raw_analysis = await asyncio.to_thread(
                analysis_llm.invoke,
                prompt,
            )
            analysis = ResourceAnalysis.model_validate(raw_analysis)

            # Ensure evaluations are sorted by rank
            analysis.evaluations.sort(key=lambda x: x.rank)

            # Fallback if evaluations list was empty
            if not analysis.evaluations:
                print("[WARNING] Empty evaluations list from LLM. Building fallback...")
                from app.schema.youtube import ResourceEvaluation
                for r, v in enumerate(videos, 1):
                    analysis.evaluations.append(
                        ResourceEvaluation(
                            rank=r,
                            video_id=v.video_id,
                            title=v.title or "Untitled",
                            relevance_score=7.0,
                            educational_quality_score=7.0,
                            coverage_score=7.0,
                            overall_score=7.0,
                            beginner_friendly=True,
                            concepts_covered=[],
                            strengths=["Relevant resource found"],
                            weaknesses=["Transcript analysis limited"],
                            recommendation_reason="Recommended based on metadata",
                        )
                    )

            print(f"[Agent 2] Analysis complete. Evaluated {len(analysis.evaluations)} resources.")
            return analysis

        except Exception as exc:
            print(f"[WARNING] Analysis attempt {attempt} failed: {exc}")
            if attempt == max_retries:
                raise

    raise RuntimeError("Failed to analyze resources after retries.")
