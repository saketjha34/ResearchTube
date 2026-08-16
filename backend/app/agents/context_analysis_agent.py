"""
Agent 2 — RAG Context + Content Analysis + Ranking

Responsibilities:
    1. Receive Agent 1 YouTube research.
    2. Retrieve relevant transcript chunks from pgvector.
    3. Build RAG context for every video.
    4. Analyze every YouTube resource.
    5. Rank resources.
    6. Return ResourceAnalysis.

This agent does NOT:
    - Search YouTube.
    - Fetch transcripts.
    - Generate transcripts.
    - Create the final report.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import (
    AsyncSession,
)

from app.llm.gemini import (
    GeminiLLM,
)

from app.rag.retriever import (
    PGVectorRetriever,
)

from app.schema.youtube import (
    YouTubeResearchResult,
    YouTubeVideoResult,
    ResourceAnalysis,
)


# ============================================================
# GEMINI
# ============================================================

gemini = GeminiLLM()

analysis_llm = (
    gemini.with_structured_output(
        ResourceAnalysis
    )
)


# ============================================================
# RAG RETRIEVER
# ============================================================

retriever = PGVectorRetriever()


# ============================================================
# BUILD VIDEO RAG CONTEXT
# ============================================================

async def build_video_context(
    session: AsyncSession,
    user_query: str,
    video: YouTubeVideoResult,
    db_video_uuid: UUID,
    research_run_id: UUID,
    top_k: int = 5,
) -> dict[str, Any]:
    """
    Retrieve transcript chunks for a single video
    using pgvector similarity search.

    Uses the DB UUID (not the YouTube string ID) for
    accurate chunk filtering.
    """

    chunks = await retriever.similarity_search(
        session=session,
        query=user_query,
        top_k=top_k,
        db_video_ids=[db_video_uuid],
        research_run_id=research_run_id,
    )

    return {

        "video": video.model_dump(),

        "retrieved_chunks": chunks,

    }


# ============================================================
# BUILD ALL RAG CONTEXT
# ============================================================

async def build_rag_context(
    session: AsyncSession,
    user_query: str,
    videos: list[YouTubeVideoResult],
    video_id_map: dict[str, UUID],
    research_run_id: UUID,
    chunks_per_video: int = 5,
) -> list[dict[str, Any]]:

    contexts = []

    for video in videos:

        db_uuid = video_id_map.get(video.video_id)

        if db_uuid is None:
            print(
                f"[Agent 2] No DB UUID for {video.video_id} "
                f"— using empty context."
            )
            contexts.append({
                "video": video.model_dump(),
                "retrieved_chunks": [],
            })
            continue

        context = await build_video_context(
            session=session,
            user_query=user_query,
            video=video,
            db_video_uuid=db_uuid,
            research_run_id=research_run_id,
            top_k=chunks_per_video,
        )

        contexts.append(
            context
        )

    return contexts


# ============================================================
# FORMAT RAG CONTEXT
# ============================================================

def format_rag_context(
    contexts: list[dict[str, Any]],
) -> str:

    output = []

    for index, context in enumerate(
        contexts,
        start=1,
    ):

        video = context["video"]

        chunks = context[
            "retrieved_chunks"
        ]

        output.append(
            f"""
============================================================
VIDEO {index}
============================================================

VIDEO ID:
{video.get("video_id")}

TITLE:
{video.get("title")}

CHANNEL:
{video.get("channel")}

URL:
{video.get("url")}

PUBLISHED:
{video.get("published_at")}

DESCRIPTION:
{video.get("description")}

VIEWS:
{video.get("views")}

LIKES:
{video.get("likes")}

COMMENTS:
{video.get("comments")}

TRANSCRIPT AVAILABLE:
{video.get("transcript_available")}

RAG TRANSCRIPT CONTEXT:
"""
        )

        if not chunks:

            output.append(
                "No relevant transcript chunks found."
            )

        else:

            for chunk_index, chunk in enumerate(
                chunks,
                start=1,
            ):

                output.append(
                    f"""
[Chunk {chunk_index}]
Similarity: {chunk["similarity"]:.4f}

{chunk["text"]}
"""
                )

    return "\n".join(output)


# ============================================================
# AGENT 2
# ============================================================

async def context_analysis_agent(
    session: AsyncSession,
    user_query: str,
    research_result: YouTubeResearchResult,
    video_id_map: dict[str, UUID],
    research_run_id: UUID,
) -> ResourceAnalysis:

    # ========================================================
    # 1. VALIDATE INPUT
    # ========================================================

    research_result = (
        YouTubeResearchResult.model_validate(
            research_result
        )
    )

    videos = [
        YouTubeVideoResult.model_validate(
            video
        )
        for video in research_result.videos
    ]

    if not videos:

        raise ValueError(
            "No YouTube videos available "
            "for analysis."
        )

    if not user_query:

        raise ValueError(
            "User query cannot be empty."
        )

    # ========================================================
    # 2. BUILD RAG CONTEXT
    # ========================================================

    print(
        "\n[Agent 2] Retrieving RAG context..."
    )

    rag_context = await build_rag_context(
        session=session,
        user_query=user_query,
        videos=videos,
        video_id_map=video_id_map,
        research_run_id=research_run_id,
        chunks_per_video=5,
    )

    print(
        "[Agent 2] RAG context retrieved."
    )

    # ========================================================
    # 3. FORMAT CONTEXT
    # ========================================================

    context_text = format_rag_context(
        rag_context
    )

    # ========================================================
    # 4. PROMPT
    # ========================================================

    prompt = f"""
You are Agent 2 of a YouTube research system.

You are responsible for:

1. RAG-based content analysis.
2. Educational evaluation.
3. Resource ranking.

USER RESEARCH QUESTION:

{user_query}


YouTube resources were collected by Agent 1.

The transcript chunks below were retrieved
from PostgreSQL using pgvector semantic search.

Use the retrieved transcript chunks as the
PRIMARY evidence for understanding the actual
content of each video.


============================================================
EVALUATION CRITERIA
============================================================

For EVERY video evaluate:

1. Relevance
2. Educational quality
3. Content coverage
4. Beginner friendliness
5. Technical depth
6. Practical usefulness


Give:

- relevance_score: 0-10
- educational_quality_score: 0-10
- coverage_score: 0-10
- overall_score: 0-10 (weighted average of the above)
- beginner_friendly
- concepts_covered
- strengths
- weaknesses
- recommendation_reason


============================================================
RANKING
============================================================

Rank the resources from BEST to WORST.

rank 1 = best resource.

Content quality is more important than popularity.

DO NOT rank a video purely based on:

- views
- likes
- comments

Popularity is only supporting metadata.

Prioritize:

1. Relevance
2. Educational quality
3. Coverage
4. Beginner friendliness
5. Technical depth
6. Practical usefulness


============================================================
RAG RULES
============================================================

The transcript chunks are the primary evidence.

Do NOT invent:

- concepts
- explanations
- topics
- technical details
- transcript content

If a video has no transcript chunks:

- acknowledge that transcript evidence is unavailable
- rely only on available metadata
- reduce educational-confidence appropriately
- mention the limitation in weaknesses


============================================================
IMPORTANT
============================================================

Analyze EVERY video.

Do not omit a video simply because
its transcript is unavailable.

Use the video metadata only for facts
such as:

- title
- channel
- URL
- date
- views
- likes
- comments

Use transcript RAG context for:

- concepts
- educational quality
- coverage
- technical depth
- practical usefulness


============================================================
RETRIEVED YOUTUBE + RAG CONTEXT
============================================================

{context_text}
"""

    # ========================================================
    # 5. GEMINI (async)
    # ========================================================

    print(
        "[Agent 2] Analyzing resources..."
    )

    raw_analysis = await analysis_llm.ainvoke(
        prompt
    )

    # ========================================================
    # 6. VALIDATE OUTPUT
    # ========================================================

    analysis = (
        ResourceAnalysis.model_validate(
            raw_analysis
        )
    )

    # ========================================================
    # 7. NORMALIZE RANKING
    # ========================================================

    # Sort by overall_score descending, then re-assign
    # deterministic 1-based ranks.

    evaluations = sorted(
        analysis.evaluations,
        key=lambda x: getattr(
            x,
            "overall_score",
            (
                x.relevance_score
                + x.educational_quality_score
                + x.coverage_score
            ) / 3,
        ),
        reverse=True,
    )

    for new_rank, evaluation in enumerate(
        evaluations,
        start=1,
    ):
        evaluation.rank = new_rank

    analysis.evaluations = evaluations

    print(
        "[Agent 2] Analysis completed."
    )

    return analysis