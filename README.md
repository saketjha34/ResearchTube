# ResearchTube 🎥🤖

An automated, multi-agent AI research platform that crawls YouTube search listings, extracts and embeds video transcripts into a pgvector-enabled PostgreSQL database, evaluates relevancy using RAG (Retrieval-Augmented Generation), and synthesizes structured, technical markdown summaries alongside interactive semantic knowledge graphs.

---

## 🚀 Key Platform Features

*   **Multi-Agent LangGraph Workflow:** Employs a structured 7-node state machine separating concerns between:
    *   *Agent 1 (Researcher):* Keyword strategy planner, metadata crawler, and transcript scraper.
    *   *Agent 2 (RAG Evaluator):* Semantic context evaluator scoring technical depth, pros, cons, and takeaways.
    *   *Agent 3 (Synthesizer):* Technical report generator compiling technical markdown summaries.
*   **Hardened Scraping Pipeline:** Resilient multi-tier scraper with auto-rotating generic proxy configuration, Webshare credentials integration, and regional language variant translation fallback layers.
*   **Vector Search & pgvector:** Splitting transcript segments into overlapping chunks, generating dense embeddings with `text-embedding-004`, and executing Cosine Similarity search queries to extract semantic context.
*   **Decoupled Frontend SPA:** Sleek user dashboard built with React 19, TypeScript, Vite, and TailwindCSS v4.
*   **Robust Security & Performance:** High-speed API router built with FastAPI, incorporating token-bucket rate limiting via `slowapi` and GZip response compression to minimize payload sizes by ~70%.
*   **Full Observability:** Structured JSON logs configured with `structlog` for easy filtering (`run_id`, `node`, `agent`, `level`) in GCP Cloud Logging.

---

## 📂 Repository Layout

This repository is split into two primary components:

```
ResearchTube/
│
├── backend/                   # FastAPI and LangGraph Agent Engine
│   ├── app/                   # Core Python application code
│   ├── docker-compose.yaml    # Services container configuration
│   ├── Dockerfile             # Backend container definition
│   ├── requirements.txt       # Backend dependencies list
│   └── README.md              # Detailed backend architectural documentation
│
├── frontend/                  # React 19 and TailwindCSS UI
│   ├── src/                   # React app codebase
│   ├── docker-compose.yml     # Frontend container configuration
│   ├── Dockerfile             # UI container definition
│   ├── package.json           # Frontend dependencies list
│   └── README.md              # Detailed frontend component documentation
│
└── README.md                  # Project entry-point documentation (this file)
```

For modular, directory-specific documentation, refer directly to the submodules:
*   📖 **Backend Architectural Guide:** [`backend/README.md`](file:///c:/Saket/Projects/ResearchTube/backend/README.md)
*   📖 **Frontend UI Component Guide:** [`frontend/README.md`](file:///c:/Saket/Projects/ResearchTube/frontend/README.md)

---

## ⚙️ Environment Configuration

Before launching the application, you must configure authentication and API credentials.

The credential generation guides are separated by concern:
*   🔑 **Backend Credentials Generation (`GEMINI_API_KEY`, Google OAuth, YouTube Data API):** Detailed in [`backend/ENV_SETUP.md`](file:///c:/Saket/Projects/ResearchTube/backend/ENV_SETUP.md)
*   🔑 **Frontend Environment Mappings:** Detailed in [`frontend/ENV_SETUP.md`](file:///c:/Saket/Projects/ResearchTube/frontend/ENV_SETUP.md)

### Quick Variable Setup
Create `.env` files in both folders using the provided templates:
```bash
# Setup backend variables
cp backend/.env.example backend/.env

# Setup frontend variables
cp frontend/.env.example frontend/.env
```

---

## 🛠️ Quick Start Guide

The easiest way to run the entire platform locally is via Docker Compose.

### 1. Build and Launch Services
Spin up the database, vector store, backend API engine, and frontend development server simultaneously in detached mode:
```bash
# Run from the root directory:
docker compose -f backend/docker-compose.yaml -f frontend/docker-compose.yml up --build -d
```

### 2. Verify Containers
Confirm that all containers are online and running healthily:
```bash
docker ps
```
You should see:
*   `youtube_research_api` running at `http://localhost:8000` (FastAPI docs at `/docs`)
*   `youtube_research_postgres` running at `http://localhost:5432` (PostgreSQL Database)
*   `frontend` running at `http://localhost:5173` (React Application)

### 3. Stop Services
```bash
docker compose -f backend/docker-compose.yaml -f frontend/docker-compose.yml down
```
*(This gracefully stops the services while preserving your postgres database volume cache).*
