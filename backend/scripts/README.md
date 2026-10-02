# ResearchTube: Scripts Documentation & Execution Guide

This directory provides scripts to execute the end-to-end multi-agent research pipeline and test the official chat message system on a complete 5-hour 25-minute course video:
- **Target Video URL:** `https://www.youtube.com/watch?v=Tq0vZU7Hp_M`
- **Target Video ID:** `Tq0vZU7Hp_M`
- **Title:** *DevOps Full Course for Beginners 2025 | Git, Docker, CI/CD, AWS, Kubernetes | Part 1*
- **Channel:** Sangam Mukherjee

---

## 1. Test Credentials

Both scripts use and authenticate as the default test user:
- **Email:** `user@example.com`
- **Password:** `stringst`

*Note: The scripts automatically verify/create this user in PostgreSQL and assign all `ResearchRun`, `YouTubeVideo`, `ChatSession`, and `ChatMessage` entities to this account, so they are immediately visible on your web frontend (`http://localhost:5173/history` and `http://localhost:5173/chat`).*

---

## 2. Prerequisites & Setup

1. **Python Environment:**
   ```powershell
   cd c:\Saket\Projects\ResearchTube\backend
   & ".\venv\Scripts\activate"
   ```

2. **Docker Containers Running:**
   Ensure `youtube_research_postgres` is running and healthy on port `5432`:
   ```powershell
   docker ps
   ```

3. **Environment Configuration (`backend/.env`):**
   - `OPENAI_API_KEY`: Primary LLM (`gpt-5.4-mini` / `gpt-5-mini`) & Embeddings (`text-embedding-3-small`, 768-dim)
   - `GEMINI_API_KEY`: Fallback LLM (`gemini-3.5-flash` / `gemini-2.5-flash`) & Embeddings (`gemini-embedding-001`, 768-dim)
   - `YOUTUBE_API_KEY`: YouTube Data API v3 (with automatic unauthenticated oEmbed fallback)
   - `DATABASE_URL`: `postgresql+asyncpg://postgres:postgres@localhost:5432/youtube_research`

---

## 3. Command 1: Run Research Flow (`run_research_flow.py`)

Executes the complete 7-node LangGraph multi-agent pipeline directly:
- **Agent 1:** Collects metadata and full 286,518-character transcript.
- **Node 2:** Persists video in PostgreSQL.
- **Node 3:** Chunks transcript into 363 chunks and embeds them in pgvector (768 dimensions).
- **Agent 2:** Performs RAG semantic retrieval and evaluates curriculum depth, coverage, and quality.
- **Node 5:** Persists evaluation and ranking.
- **Agent 3:** Synthesizes structured final report with 10-step learning path.
- **Node 7:** Completes research run.
- **Step 8:** Verifies official `ChatService` and saves the first turn to PostgreSQL.
- **Step 9 & 10:** Prints all 363 chunks and the complete raw transcript.

### Execution:
```powershell
# From backend directory with venv active:
python scripts/run_research_flow.py

# Or inside Docker:
docker exec youtube_research_api python scripts/run_research_flow.py
```

---

## 4. Command 2: Chat with Research Run (`chat_with_research_run.py`)

Interacts directly with the official ResearchTube Chat Message Architecture:
- Uses **`ChatService`** (`SessionService` + `MessagingService`).
- Formats prompts **strictly** with [`templates/chat/chat_rag.txt`](file:///c:/Saket/Projects/ResearchTube/backend/app/prompts/templates/chat/chat_rag.txt) via [`app/prompts/chat.py`](file:///c:/Saket/Projects/ResearchTube/backend/app/prompts/chat.py).
- Performs real-time **pgvector cosine distance retrieval** on the 363 transcript chunks.
- Persists all conversation turns (`ChatMessage` rows) with `sources` JSON to PostgreSQL.
- Outputs inline bracket citations (`[1]`, `[2]`).

### Execution Modes:

#### Mode A: Interactive Real-Time Shell
```powershell
python scripts/chat_with_research_run.py --interactive
```

#### Mode B: Ask a Single Question
```powershell
python scripts/chat_with_research_run.py --question "What Docker containerization concepts, commands, and workflows are explained?"
```

#### Mode C: Automated 5-Domain Heuristic Verification Suite
Runs 5 deep domain questions across the 5h 25m video (Curriculum, Git, Docker, CI/CD, AWS & Kubernetes) and saves the results:
```powershell
python scripts/chat_with_research_run.py --test-heuristic
```

---

## 5. Linked Video Artifacts Directory

Both scripts share and link to the same dedicated video output folder:
`backend/scripts/output/Tq0vZU7Hp_M_research_run/`

| File | Description |
| :--- | :--- |
| `complete_transcript.txt` | The full uninterrupted 286,518 character transcript across the 5h 25m video. |
| `transcript_chunks.json` | JSON array of all 363 chunks with chunk indices, lengths, and languages. |
| `transcript_chunks.txt` | Numbered, human-readable transcript chunks for manual inspection. |
| `final_report.json` | Complete pedagogical report JSON with executive summary, ranking, and scores. |
| `final_report.md` | Clean GitHub-flavored Markdown pedagogical report with 10-step learning path. |
| `official_chat_session.json` | Turn log of the latest question answered through the official ChatService. |
| `heuristic_qa_results.json` | Results and cited chunk evidence from the 5-domain heuristic test suite. |
| `run_metadata.json` | ResearchRun ID, YouTube metadata, and timestamp record. |
