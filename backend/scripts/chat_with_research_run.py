"""
================================================================================
ResearchTube: Official Chat with Research Run & Video Q&A Script
================================================================================

Description:
    Provides an interactive and automated question-answering verification shell
    against the 5-hour 25-minute DevOps Course research run (`Tq0vZU7Hp_M`) using
    ResearchTube's official production chat architecture:
    - Official ChatService (SessionService + MessagingService)
    - Official Jinja2 RAG Prompt Template: chat_rag.txt (app/prompts/templates/chat/chat_rag.txt)
    - Real Database Persistence: ChatSession & ChatMessage entities in PostgreSQL
    - Real RAG Retrieval: pgvector transcript chunks scoped to this video/research run
    - Real LLM Routing: DualLLM (OpenAI primary with automatic Gemini fallback)

Prerequisites & Setup Requirements:
    1. Python Environment:
       - Python 3.11+
       - Virtualenv activated: `c:\\Saket\\Projects\\ResearchTube\\backend\\venv\\Scripts\\activate`
       - Required packages: fastapi, sqlalchemy, asyncpg, pgvector, structlog,
         langchain-core, langchain-openai, langchain-google-genai.

    2. Database & Vector Store:
       - PostgreSQL 16 with pgvector running (docker container: `youtube_research_postgres`).
       - Research run and transcript chunks for `Tq0vZU7Hp_M` must be already ingested
         (run `scripts/run_research_flow.py` first).

    3. API Keys (.env):
       - OPENAI_API_KEY: sk-proj-... (Used for OpenAI text-embedding-3-small and gpt-5.4-mini)
       - GEMINI_API_KEY: AQ.Ab...    (Used for fallback Gemini embeddings and gemini-3.5-flash)

    4. Target User Credentials:
       - User: `user@example.com`
       - Password: `stringst`
       - All ChatSessions and ChatMessages created by this script belong to this user.

Linked Artifacts Folder:
    backend/scripts/output/Tq0vZU7Hp_M_research_run/
    ├── complete_transcript.txt         (Full raw transcript)
    ├── transcript_chunks.json          (Ingested chunks metadata)
    ├── transcript_chunks.txt           (Numbered chunks for inspection)
    ├── final_report.json               (Pedagogical report JSON)
    ├── final_report.md                 (Pedagogical report Markdown)
    ├── official_chat_session.json      (Latest interactive/single turn log)
    ├── heuristic_qa_results.json       (5-topic heuristic verification results)
    └── run_metadata.json               (Run & video metadata)

Usage Modes:
    1. Interactive Chat Shell (real-time chat with database persistence):
       python scripts/chat_with_research_run.py --interactive

    2. Single Question via Official ChatService:
       python scripts/chat_with_research_run.py --question "What Docker commands are covered?"

    3. Automated 5-Domain Heuristic Verification Suite:
       python scripts/chat_with_research_run.py --test-heuristic
================================================================================
"""

from __future__ import annotations

import argparse
import asyncio
import io
import json
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
from app.db.models.youtube import ResearchRun, YouTubeVideo, ResearchVideo
from app.schema.chat import CreateChatSessionRequest, SendMessageRequest
from app.services.chat.chat_service import ChatService
from app.utils.security_utils import hash_password, verify_password

# ==============================================================================
# CONFIGURATION
# ==============================================================================
TARGET_VIDEO_ID = "Tq0vZU7Hp_M"
TARGET_USER_EMAIL = "user@example.com"
TARGET_USER_PASSWORD = "stringst"

# Dedicated output directory linked across research run and chat scripts
OUTPUT_DIR = BACKEND_ROOT / "scripts" / "output" / f"{TARGET_VIDEO_ID}_research_run"


def print_banner(title: str, char: str = "=", width: int = 75):
    print("\n" + char * width)
    print(f" {title}")
    print(char * width)


def display_linked_output_files():
    """Display all artifact files present in the linked video output directory."""
    print_banner(f"LINKED ARTIFACTS IN: {OUTPUT_DIR.name}", "=")
    if not OUTPUT_DIR.exists():
        print("  [Notice] Output directory does not exist yet. Run scripts/run_research_flow.py first.")
        return

    files = sorted(OUTPUT_DIR.glob("*.*"))
    if not files:
        print("  [Notice] Directory is empty.")
        return

    for fpath in files:
        size_kb = fpath.stat().st_size / 1024
        print(f"  * {fpath.name:<32} | {size_kb:>8.2f} KB | {fpath}")
    print("-" * 75)


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
    elif not verify_password(TARGET_USER_PASSWORD, auth.password_hash):
        auth.password_hash = hash_password(TARGET_USER_PASSWORD)
        await session.flush()

    await session.commit()
    return user


async def resolve_target_context(session):
    """
    Resolve target user (user@example.com), researched YouTubeVideo, and active ResearchRun.
    Ensures research association exists so that the official ChatService can access it.
    """
    user = await ensure_target_user(session)

    # Find YouTubeVideo
    v_res = await session.execute(
        select(YouTubeVideo).where(YouTubeVideo.video_id == TARGET_VIDEO_ID)
    )
    video = v_res.scalar_one_or_none()
    if not video:
        raise RuntimeError(
            f"YouTubeVideo for '{TARGET_VIDEO_ID}' not found in DB. "
            "Please run scripts/run_research_flow.py first to collect and ingest the video."
        )

    # Find ResearchRun owned by this user
    r_res = await session.execute(
        select(ResearchRun)
        .where(ResearchRun.user_query.contains(TARGET_VIDEO_ID))
        .where(ResearchRun.user_id == user.id)
        .order_by(ResearchRun.created_at.desc())
    )
    run = r_res.scalars().first()

    # If run belongs to another user, adopt it for user@example.com
    if not run:
        any_run = (
            await session.execute(
                select(ResearchRun)
                .where(ResearchRun.user_query.contains(TARGET_VIDEO_ID))
                .order_by(ResearchRun.created_at.desc())
            )
        ).scalars().first()
        if any_run:
            any_run.user_id = user.id
            session.add(any_run)
            await session.commit()
            await session.refresh(any_run)
            run = any_run

    # Ensure ResearchVideo link exists
    if run and video:
        link_res = await session.execute(
            select(ResearchVideo).where(
                ResearchVideo.research_run_id == run.id,
                ResearchVideo.video_id == video.id,
            )
        )
        if not link_res.scalar_one_or_none():
            assoc = ResearchVideo(
                research_run_id=run.id,
                video_id=video.id,
                position=1,
                transcript_available=True,
                transcript_language="en",
            )
            session.add(assoc)
            await session.commit()

    return user, video, run


async def get_or_create_chat_session(session, user: User, video: YouTubeVideo, run: ResearchRun, title: str = "DevOps Course (5h 25m) Q&A") -> ChatSession:
    """Create or retrieve a persistent ChatSession scoped to this video for user@example.com."""
    chat_service = ChatService()

    # Check for existing active session for this video and user
    existing_stmt = (
        select(ChatSession)
        .where(
            ChatSession.user_id == user.id,
            ChatSession.video_id == video.id,
            ChatSession.is_archived == False,
        )
        .order_by(ChatSession.updated_at.desc())
        .limit(1)
    )
    existing_res = await session.execute(existing_stmt)
    existing_session = existing_res.scalar_one_or_none()

    if existing_session:
        return existing_session

    # Create new session via SessionService
    created_resp = await chat_service.create_session(
        session=session,
        user_id=user.id,
        payload=CreateChatSessionRequest(
            title=title,
            scope_mode="video",
            video_id=video.video_id,
            research_run_id=run.id if run else None,
        ),
    )
    db_session = await session.get(ChatSession, created_resp.id)
    return db_session


async def execute_chat_turn(session, chat_service: ChatService, user: User, chat_session: ChatSession, question: str):
    """
    Executes a single chat message turn through the official MessagingService.
    Uses chat_rag.txt, pgvector similarity search, and commits both user and assistant
    ChatMessage rows to PostgreSQL.
    """
    start_t = time.time()
    payload = SendMessageRequest(message=question)

    response = await chat_service.messaging.send_message(
        session=session,
        user_id=user.id,
        session_id=chat_session.id,
        payload=payload,
    )
    elapsed = time.time() - start_t

    user_msg = response.user_message
    asst_msg = response.assistant_message

    print(f"\n[Turn Completed in {elapsed:.2f}s]")
    print(f"Session ID:         {chat_session.id}")
    print(f"User Message ID:    {user_msg.id} (Saved to DB)")
    print(f"Assistant Msg ID:   {asst_msg.id} (Saved to DB)")
    print(f"Source Citations:   {len(asst_msg.sources or [])} chunks retrieved from pgvector\n")

    print_banner("ASSISTANT RESPONSE (from templates/chat/chat_rag.txt)", "-")
    print(asst_msg.content)

    if asst_msg.sources:
        print("\n--- Cited Transcript Chunks ---")
        for idx, src in enumerate(asst_msg.sources, 1):
            chunk_ref = src.chunk_id or f"chunk_{src.index}"
            snippet = (src.text_snippet or "").replace("\n", " ")[:140]
            sim = f" (sim: {src.similarity:.3f})" if src.similarity else ""
            print(f"  [{idx}] {chunk_ref}{sim}: {snippet}...")

    # Save to linked output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    turn_file = OUTPUT_DIR / "official_chat_session.json"
    with open(turn_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "session_id": str(chat_session.id),
                "user_id": str(user.id),
                "user_email": user.email,
                "user_message_id": str(user_msg.id),
                "assistant_message_id": str(asst_msg.id),
                "question": question,
                "answer": asst_msg.content,
                "sources": [s.model_dump() for s in (asst_msg.sources or [])],
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
            f,
            indent=2,
            ensure_ascii=False,
        )

    return {
        "question": question,
        "answer": asst_msg.content,
        "sources": [s.model_dump() for s in (asst_msg.sources or [])],
        "user_message_id": str(user_msg.id),
        "assistant_message_id": str(asst_msg.id),
        "session_id": str(chat_session.id),
        "elapsed": elapsed,
    }


# 5 Core Heuristic Questions to test the official chat workflow across the 5h 25m video
HEURISTIC_TEST_QUESTIONS = [
    "What is the overall curriculum covered in this 5-hour DevOps video?",
    "How does the video explain Git commits, branching, and merge conflicts?",
    "What Docker containerization concepts, Dockerfile instructions, and CLI commands are taught?",
    "What CI/CD pipeline concepts and GitHub Actions steps are demonstrated?",
    "How does the course introduce AWS deployment and Kubernetes architecture?",
]


async def run_heuristic_test_suite():
    print_banner("OFFICIAL CHAT WITH RESEARCH RUN: 5-TOPIC HEURISTIC SUITE", "=")
    print("Testing official ChatService (chat_rag.txt + pgvector + PostgreSQL messages)...")

    chat_service = ChatService()
    results = []

    async with AsyncSessionLocal() as session:
        user, video, run = await resolve_target_context(session)
        print(f"[+] User Account:    {user.email} (Password: {TARGET_USER_PASSWORD})")
        print(f"[+] Researched Video:{video.title} (ID: {video.video_id})")
        print(f"[+] Research Run ID: {run.id if run else 'None'}")
        print(f"[+] Linked Output:   {OUTPUT_DIR}\n")

        # Create a clean dedicated test session
        session_title = f"DevOps Course Heuristic Test ({time.strftime('%Y-%m-%d %H:%M:%S')})"
        created_resp = await chat_service.create_session(
            session=session,
            user_id=user.id,
            payload=CreateChatSessionRequest(
                title=session_title,
                scope_mode="video",
                video_id=video.video_id,
                research_run_id=run.id if run else None,
            ),
        )
        chat_session = await session.get(ChatSession, created_resp.id)
        print(f"[+] Created Dedicated ChatSession: {chat_session.id} (Saved to PostgreSQL)\n")

        for idx, question in enumerate(HEURISTIC_TEST_QUESTIONS, 1):
            print_banner(f"TEST {idx}/5: {question}", "=")
            turn_data = await execute_chat_turn(
                session=session,
                chat_service=chat_service,
                user=user,
                chat_session=chat_session,
                question=question,
            )
            results.append(turn_data)

        # Save test run results in linked output directory
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        res_file = OUTPUT_DIR / "heuristic_qa_results.json"
        with open(res_file, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "session_id": str(chat_session.id),
                    "user_id": str(user.id),
                    "user_email": user.email,
                    "video_id": TARGET_VIDEO_ID,
                    "turns": results,
                },
                f,
                indent=2,
                ensure_ascii=False,
            )

        print_banner(f"HEURISTIC SUITE COMPLETE - ALL TURNS SAVED TO DATABASE & {res_file}", "=")
        display_linked_output_files()


async def run_single_question(question: str):
    print_banner(f"SINGLE QUESTION VIA OFFICIAL CHAT SERVICE: {question}", "=")
    chat_service = ChatService()

    async with AsyncSessionLocal() as session:
        user, video, run = await resolve_target_context(session)
        print(f"[+] User Account:    {user.email} (Password: {TARGET_USER_PASSWORD})")
        print(f"[+] Researched Video:{video.title} (ID: {video.video_id})")
        print(f"[+] Linked Output:   {OUTPUT_DIR}\n")

        chat_session = await get_or_create_chat_session(session, user, video, run)

        await execute_chat_turn(
            session=session,
            chat_service=chat_service,
            user=user,
            chat_session=chat_session,
            question=question,
        )

        display_linked_output_files()


async def run_interactive_mode():
    print_banner("INTERACTIVE SHELL: OFFICIAL CHAT WITH RESEARCH RUN", "=")
    print("Messages are saved to PostgreSQL in real-time and visible in frontend web UI.")
    print("Type your questions below (or 'exit' / 'quit' to exit).\n")

    chat_service = ChatService()

    async with AsyncSessionLocal() as session:
        user, video, run = await resolve_target_context(session)
        chat_session = await get_or_create_chat_session(session, user, video, run)
        print(f"[+] Active ChatSession ID: {chat_session.id}")
        print(f"[+] User Account: {user.email} (Password: {TARGET_USER_PASSWORD})")
        print(f"[+] Video Scope:  '{video.title[:45]}...'")
        print(f"[+] Linked Output:{OUTPUT_DIR}")

        while True:
            try:
                user_q = input("\nResearchTube Chat > ").strip()
                if not user_q:
                    continue
                if user_q.lower() in ("exit", "quit", "q"):
                    print("Exiting interactive chat. Goodbye!")
                    break

                await execute_chat_turn(
                    session=session,
                    chat_service=chat_service,
                    user=user,
                    chat_session=chat_session,
                    question=user_q,
                )
            except (KeyboardInterrupt, EOFError):
                break

        display_linked_output_files()


def main():
    parser = argparse.ArgumentParser(description="Query 5-hour video research run using official ResearchTube ChatService.")
    parser.add_argument("--interactive", "-i", action="store_true", help="Launch interactive chat session")
    parser.add_argument("--question", "-q", type=str, help="Send a single question through the chat message service")
    parser.add_argument("--test-heuristic", "-t", action="store_true", help="Run 5 automated heuristic test turns")

    args = parser.parse_args()

    if args.interactive:
        asyncio.run(run_interactive_mode())
    elif args.question:
        asyncio.run(run_single_question(args.question))
    elif args.test_heuristic:
        asyncio.run(run_heuristic_test_suite())
    else:
        # Default to single question demonstration
        asyncio.run(
            run_single_question("What Docker containerization concepts, commands, and workflows are explained in this video?")
        )


if __name__ == "__main__":
    main()
