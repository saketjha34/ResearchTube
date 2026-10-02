"""
================================================================================
ResearchTube: Complete 5-Hour Video Research Workflow Execution Script
================================================================================

Description:
    Executes the end-to-end 7-node LangGraph multi-agent research pipeline on a
    comprehensive 5-hour 25-minute YouTube course:
    "DevOps Full Course for Beginners 2025 | Git, Docker, CI/CD, AWS, Kubernetes | Part 1"
    (Video URL: https://www.youtube.com/watch?v=Tq0vZU7Hp_M | Video ID: Tq0vZU7Hp_M).

Prerequisites & Setup Requirements:
    1. Python Environment:
       - Python 3.11+
       - Virtualenv activated: `c:\\Saket\\Projects\\ResearchTube\\backend\\venv\\Scripts\\activate`
       - Required packages: fastapi, sqlalchemy, asyncpg, pgvector, structlog,
         langgraph, langchain-core, langchain-openai, langchain-google-genai,
         youtube-transcript-api, google-api-python-client.

    2. Database & Vector Store:
       - PostgreSQL 16 with pgvector extension enabled.
       - Docker container `youtube_research_postgres` running on port 5432.
       - Connection URL in `.env`: `postgresql+asyncpg://postgres:postgres@localhost:5432/youtube_research`

    3. API Keys (.env):
       - OPENAI_API_KEY: sk-proj-... (Primary LLM: gpt-5.4-mini / gpt-5-mini, Embedding: text-embedding-3-small 768-dim)
       - GEMINI_API_KEY: AQ.Ab... (Fallback LLM: gemini-3.5-flash / gemini-2.5-flash, Embedding: gemini-embedding-001 768-dim)
       - YOUTUBE_API_KEY: AIzaSy... (YouTube Data API v3; with automatic unauthenticated oEmbed fallback)

    4. User Account & Permissions:
       - User: `user@example.com`
       - Password: `stringst`
       - The script automatically ensures this user and password exist in PostgreSQL
         and attaches all runs, videos, and chat sessions to this account.

Workflow Steps Executed (7-Node LangGraph Pipeline):
    - Node 1 (youtube_research): Agent 1 collects video metadata, statistics, and full transcript.
    - Node 2 (persist_research): Upserts video in `youtube_videos` and creates `research_videos` link.
    - Node 3 (ingest_transcripts): Chunks transcript (1000 chars, 200 overlap) into ~363 chunks,
      generates 768-dim embeddings via DualEmbeddingService, and saves to pgvector `transcript_chunks`.
    - Node 4 (context_analysis): Agent 2 retrieves top chunks via pgvector cosine distance,
      evaluates educational quality, coverage, relevance, and technical depth.
    - Node 5 (persist_analysis): Stores structured evaluation and ranking into `resource_evaluations`.
    - Node 6 (final_report): Agent 3 synthesizes executive summary, 10-step learning path, and limitations.
    - Node 7 (persist_final_report): Finalizes report and updates status to `completed`.
    - Step 8 (Official Chat Service Check): Verifies the official ChatService with chat_rag.txt
      and persists the first turn to `chat_sessions` and `chat_messages` in PostgreSQL.

Artifacts Output Folder:
    backend/scripts/output/Tq0vZU7Hp_M_research_run/
    ├── complete_transcript.txt    (The entire 286,518 character uninterrupted transcript)
    ├── transcript_chunks.json     (JSON array of all 363 chunks with indices and metadata)
    ├── transcript_chunks.txt      (Human-readable numbered chunks for heuristic check)
    ├── final_report.json          (Complete structured report JSON)
    ├── final_report.md            (Formatted markdown pedagogical report)
    ├── official_chat_session.json (Verified initial chat turn and citations)
    └── run_metadata.json          (ResearchRun metadata and timestamps)

Usage:
    python scripts/run_research_workflow.py
    docker exec youtube_research_api python scripts/run_research_workflow.py
================================================================================
"""

from __future__ import annotations

import asyncio
import io
import json
import os
from pathlib import Path
import sys
import time

# Prevent pytest auto-discovery
__test__ = False

# Ensure UTF-8 output encoding on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure backend root is in sys.path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import select
from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.db.models.auth import AuthProvider, UserAuth
from app.db.models.chat import ChatMessage, ChatSession
from app.db.models.user import User
from app.db.models.youtube import ResearchRun, YouTubeVideo, TranscriptChunk, ResearchVideo
from app.graph.youtube.graph import create_research_graph
from app.graph.youtube.persistence import youtube_graph_persistence
from app.rag.chunker import chunk_text
from app.schema.chat import CreateChatSessionRequest, SendMessageRequest
from app.services.chat.chat_service import ChatService
from app.utils.security_utils import hash_password, verify_password

# ==============================================================================
# CONFIGURATION
# ==============================================================================
TARGET_URL = "https://www.youtube.com/watch?v=Kb-sw00KJ10"
TARGET_VIDEO_ID = "Kb-sw00KJ10"
TARGET_USER_EMAIL = "user@example.com"
TARGET_USER_PASSWORD = "stringst"

# Dedicated output directory linked across research run and chat scripts
OUTPUT_DIR = BACKEND_ROOT / "scripts" / "output" / f"{TARGET_VIDEO_ID}_research_run"


def print_banner(title: str, char: str = "=", width: int = 80):
    print("\n" + char * width)
    print(f" {title}")
    print(char * width)


async def ensure_target_user(session) -> User:
    """Ensure user@example.com exists with password stringst."""
    res = await session.execute(
        select(User).where(User.email == TARGET_USER_EMAIL)
    )
    user = res.scalar_one_or_none()

    if not user:
        user = User(
            email=TARGET_USER_EMAIL,
            username="testuser",
        )
        session.add(user)
        await session.flush()
        print(f"[+] Created target user '{TARGET_USER_EMAIL}' (ID: {user.id})")
    else:
        print(f"[+] Found target user '{TARGET_USER_EMAIL}' (ID: {user.id})")

    # Ensure UserAuth password is set to 'stringst'
    auth_res = await session.execute(
        select(UserAuth).where(UserAuth.user_id == user.id)
    )
    auth = auth_res.scalar_one_or_none()

    if not auth:
        auth = UserAuth(
            user_id=user.id,
            password_hash=hash_password(TARGET_USER_PASSWORD),
            provider=AuthProvider.LOCAL,
        )
        session.add(auth)
        await session.flush()
        print(f"[+] Set password to '{TARGET_USER_PASSWORD}' for {TARGET_USER_EMAIL}")
    elif not verify_password(TARGET_USER_PASSWORD, auth.password_hash):
        auth.password_hash = hash_password(TARGET_USER_PASSWORD)
        await session.flush()
        print(f"[+] Updated password to '{TARGET_USER_PASSWORD}' for {TARGET_USER_EMAIL}")

    await session.commit()
    return user


async def run_research_flow():
    print_banner("RESEARCHTUBE: RUN RESEARCH FLOW (5-HOUR VIDEO WORKFLOW)", "=")
    print(f"Target Video URL:    {TARGET_URL}")
    print(f"Target Video ID:     {TARGET_VIDEO_ID}")
    print(f"Target User Account: {TARGET_USER_EMAIL} (password: {TARGET_USER_PASSWORD})")
    print(f"LLM Routing:         Primary OpenAI ({settings.OPENAI_MODEL}) -> Fallback Gemini ({settings.GEMINI_MODEL})")
    print(f"Embedding Provider:  Primary OpenAI ({settings.OPENAI_EMBEDDING_MODEL}) -> Fallback Gemini ({settings.EMBEDDING_MODEL}) [768-dim]")
    print(f"Output Directory:    {OUTPUT_DIR}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    start_time = time.time()

    async with AsyncSessionLocal() as session:
        # 1. Resolve and verify target user
        user = await ensure_target_user(session)

        # 2. Create ResearchRun in database
        print("\n[+] Creating ResearchRun record in PostgreSQL...")
        run = await youtube_graph_persistence.create_research_run(
            session=session,
            user_query=TARGET_URL,
            video_count=1,
            user_id=user.id,
        )
        await session.commit()
        run_id_str = str(run.id)
        print(f"[OK] ResearchRun created with ID: {run_id_str} (owned by {user.email})")

        # 3. Build & Compile 7-Node State Graph
        print("\n[+] Initializing LangGraph 7-Node Multi-Agent State Machine...")
        graph = create_research_graph(session)

        # 4. Execute Full Pipeline
        print("\n" + "-" * 75)
        print(">>> EXECUTING FULL PIPELINE INVOCATION (Node 1 -> Node 7)")
        print("-" * 75)

        pipeline_start = time.time()
        result = await graph.ainvoke(
            {
                "user_query": TARGET_URL,
                "video_count": 1,
                "research_run_id": run_id_str,
            }
        )
        pipeline_elapsed = time.time() - pipeline_start
        print(f"\n[OK] Pipeline completed execution in {pipeline_elapsed:.2f} seconds ({pipeline_elapsed/60:.2f} mins)!")

        # 5. Extract Artifacts from LangGraph State
        research_result = result.get("research_result")
        analysis = result.get("analysis")
        final_report = result.get("final_report")

        video = research_result.videos[0] if research_result and research_result.videos else None
        full_transcript = video.transcript if video else ""

        # 6. Retrieve Ingested Chunks from pgvector database
        print("\n[+] Verifying pgvector database transcript ingestion...")
        chunks_stmt = (
            select(TranscriptChunk)
            .where(TranscriptChunk.research_run_id == run.id)
            .order_by(TranscriptChunk.chunk_index)
        )
        chunks_res = await session.execute(chunks_stmt)
        db_chunks = chunks_res.scalars().all()
        print(f"[OK] Successfully retrieved {len(db_chunks)} chunks from pgvector database table 'transcript_chunks'!")

        # Format chunk data
        chunk_data = []
        if db_chunks:
            for c in db_chunks:
                chunk_data.append({
                    "chunk_index": c.chunk_index,
                    "length": len(c.text),
                    "text": c.text,
                    "language": c.language,
                })
        elif full_transcript:
            raw_chunks = chunk_text(full_transcript, chunk_size=1000, chunk_overlap=200)
            for idx, text in enumerate(raw_chunks):
                chunk_data.append({
                    "chunk_index": idx,
                    "length": len(text),
                    "text": text,
                    "language": getattr(video, "transcript_language", "en"),
                })

        # 7. Save Artifacts to Dedicated Output Directory
        print_banner("SAVING ARTIFACTS TO LINKED VIDEO DIRECTORY", "-")

        # 7a. Complete raw transcript
        transcript_file = OUTPUT_DIR / "complete_transcript.txt"
        with open(transcript_file, "w", encoding="utf-8") as f:
            f.write(full_transcript or "")
        print(f"[Saved] Complete Raw Transcript -> {transcript_file} ({len(full_transcript):,} chars)")

        # 7b. All chunks JSON
        chunks_json_file = OUTPUT_DIR / "transcript_chunks.json"
        with open(chunks_json_file, "w", encoding="utf-8") as f:
            json.dump(chunk_data, f, indent=2, ensure_ascii=False)
        print(f"[Saved] All Chunks JSON       -> {chunks_json_file} ({len(chunk_data)} chunks)")

        # 7c. All chunks human-readable text
        chunks_txt_file = OUTPUT_DIR / "transcript_chunks.txt"
        with open(chunks_txt_file, "w", encoding="utf-8") as f:
            for item in chunk_data:
                f.write(f"=== CHUNK {item['chunk_index']} [chars: {item['length']}] ===\n")
                f.write(item["text"] + "\n\n")
        print(f"[Saved] All Chunks Text       -> {chunks_txt_file}")

        # 7d. Final report JSON & Markdown
        if final_report:
            report_json_file = OUTPUT_DIR / "final_report.json"
            with open(report_json_file, "w", encoding="utf-8") as f:
                json.dump(final_report.model_dump(), f, indent=2, ensure_ascii=False)
            print(f"[Saved] Final Report JSON     -> {report_json_file}")

            report_md_file = OUTPUT_DIR / "final_report.md"
            with open(report_md_file, "w", encoding="utf-8") as f:
                f.write(f"# Research Report: {video.title if video else TARGET_URL}\n\n")
                f.write(f"**Research Run ID:** `{run_id_str}`\n\n")
                f.write(f"**Target User:** `{user.email}`\n\n")
                f.write(f"## Executive Summary\n{final_report.executive_summary}\n\n")
                f.write(f"## Conclusion\n{final_report.conclusion}\n\n")
                f.write(f"## Methodology\n{final_report.methodology}\n\n")
                f.write("## Key Topics Covered\n")
                for topic in final_report.key_topics:
                    f.write(f"- {topic}\n")
                f.write("\n## Recommended Learning Path\n")
                for step in final_report.learning_path:
                    f.write(f"- {step}\n")
                f.write("\n## Limitations & Caveats\n")
                for lim in final_report.limitations:
                    f.write(f"- {lim}\n")
            print(f"[Saved] Final Report Markdown -> {report_md_file}")

        # 7e. Run metadata
        metadata_file = OUTPUT_DIR / "run_metadata.json"
        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "run_id": run_id_str,
                    "video_id": TARGET_VIDEO_ID,
                    "user_id": str(user.id),
                    "user_email": user.email,
                    "title": video.title if video else None,
                    "channel": video.channel if video else None,
                    "views": video.views if video else None,
                    "likes": video.likes if video else None,
                    "transcript_length": len(full_transcript),
                    "chunk_count": len(chunk_data),
                    "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                },
                f,
                indent=2,
            )
        print(f"[Saved] Run Metadata JSON     -> {metadata_file}")

        # 8. TEST OFFICIAL CHAT SERVICE & MESSAGING SERVICE (chat_rag.txt + DB Persistence)
        print_banner("TESTING OFFICIAL CHAT INTERFACE & MESSAGING SERVICE", "=")
        print("Invoking ChatService with chat_rag_template (templates/chat/chat_rag.txt)...")
        chat_service = ChatService()
        chat_session_resp = await chat_service.create_session(
            session=session,
            user_id=user.id,
            payload=CreateChatSessionRequest(
                title=f"Chat: {video.title[:50] if video else 'DevOps Course'}",
                scope_mode="video",
                video_id=video.video_id if video else TARGET_VIDEO_ID,
                research_run_id=run.id,
            ),
        )
        print(f"[OK] ChatSession created: {chat_session_resp.id} (Saved to PostgreSQL)")

        sample_question = "What is the overall curriculum covered in this 5-hour DevOps video?"
        print(f"[+] Sending turn via ChatService: '{sample_question}'...")
        chat_msg_resp = await chat_service.messaging.send_message(
            session=session,
            user_id=user.id,
            session_id=chat_session_resp.id,
            payload=SendMessageRequest(message=sample_question),
        )
        print(f"[OK] User Message ID:      {chat_msg_resp.user_message.id} (Saved to PostgreSQL)")
        print(f"[OK] Assistant Message ID: {chat_msg_resp.assistant_message.id} (Saved to PostgreSQL)")
        print(f"[OK] Source Citations:     {len(chat_msg_resp.assistant_message.sources or [])} chunks retrieved and cited")

        # Save initial chat verification
        chat_file = OUTPUT_DIR / "official_chat_session.json"
        with open(chat_file, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "session_id": str(chat_session_resp.id),
                    "user_id": str(user.id),
                    "user_message": sample_question,
                    "assistant_response": chat_msg_resp.assistant_message.content,
                    "sources": [s.model_dump() for s in (chat_msg_resp.assistant_message.sources or [])],
                },
                f,
                indent=2,
                ensure_ascii=False,
            )
        print(f"[Saved] Official Chat Session -> {chat_file}")

        # 9. PRINT ALL TRANSCRIPT CHUNKS
        print_banner(f"PRINTING ALL {len(chunk_data)} TRANSCRIPT CHUNKS", "=")
        for item in chunk_data:
            print(f"\n>>> [CHUNK {item['chunk_index']:03d} | Length: {item['length']} chars]")
            print(item["text"])
            print("-" * 60)

        # 10. PRINT COMPLETE TRANSCRIPT
        print_banner("PRINTING COMPLETE RAW TRANSCRIPT", "=")
        print(full_transcript)
        print("=" * 80)

        # 11. DISPLAY ALL OUTPUT FILES CREATED
        print_banner("OUTPUT ARTIFACTS IN DEDICATED VIDEO DIRECTORY", "=")
        print(f"Directory: {OUTPUT_DIR}\n")
        output_files = list(OUTPUT_DIR.glob("*.*"))
        for fpath in sorted(output_files):
            size_kb = fpath.stat().st_size / 1024
            print(f"  * {fpath.name:<28} | {size_kb:>8.2f} KB | {fpath}")

        # 12. Workflow Summary
        total_time = time.time() - start_time
        print_banner("RUN RESEARCH FLOW EXECUTION SUMMARY", "=")
        print(f"Run ID:                {run_id_str}")
        print(f"User Email:            {user.email}")
        print(f"Video ID:              {TARGET_VIDEO_ID}")
        print(f"Title:                 {video.title if video else 'N/A'}")
        print(f"Channel:               {video.channel if video else 'N/A'}")
        print(f"Views:                 {video.views:,}" if video and video.views else "Views: N/A")
        print(f"Likes:                 {video.likes:,}" if video and video.likes else "Likes: N/A")
        print(f"Total Transcript Chars:{len(full_transcript):,}")
        print(f"Total Chunks Ingested: {len(chunk_data)}")
        print(f"Chat Session ID:       {chat_session_resp.id}")
        print(f"Execution Duration:    {total_time:.2f}s ({total_time/60:.2f} mins)")

        if analysis and analysis.evaluations:
            ev = analysis.evaluations[0]
            print("\n--- Agent 2 Evaluation Scores ---")
            print(f"  Overall Score:           {ev.overall_score} / 10")
            print(f"  Relevance Score:         {ev.relevance_score} / 10")
            print(f"  Educational Quality:     {ev.educational_quality_score} / 10")
            print(f"  Coverage Score:          {ev.coverage_score} / 10")
            print(f"  Beginner Friendly:       {ev.beginner_friendly}")
            print(f"  Recommendation Reason:   {ev.recommendation_reason}")

        if final_report:
            print("\n--- Agent 3 Final Report Summary ---")
            print(f"Executive Summary:\n  {final_report.executive_summary}\n")
            print(f"Conclusion:\n  {final_report.conclusion}\n")
            print(f"Key Topics ({len(final_report.key_topics)}):")
            for t in final_report.key_topics:
                print(f"  * {t}")
            print(f"\nLearning Path ({len(final_report.learning_path)} steps):")
            for step in final_report.learning_path:
                print(f"  * {step}")

        print("\n" + "=" * 80)
        print(f"[SUCCESS] Research run flow completed! Artifacts linked in: {OUTPUT_DIR}")
        print("=" * 80 + "\n")

        return {
            "run_id": run_id_str,
            "user_id": str(user.id),
            "video_id": TARGET_VIDEO_ID,
            "title": video.title if video else None,
            "total_chars": len(full_transcript),
            "chunk_count": len(chunk_data),
            "output_dir": str(OUTPUT_DIR),
        }


def main():
    asyncio.run(run_research_flow())


if __name__ == "__main__":
    main()
