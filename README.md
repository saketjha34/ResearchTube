# ResearchTube 🎓🤖

> **Automated Multi-Agent YouTube Research Platform**
> Transform raw YouTube video streams into structured, publication-grade research reports using **LangGraph autonomous agents**, **PostgreSQL pgvector RAG**, and **Google Gemini 3.5**.

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/Frontend-React_19-61DAFB.svg)](https://react.dev/)
[![LangGraph](https://img.shields.io/badge/Orchestrator-LangGraph-purple.svg)](https://langchain-ai.github.io/langgraph/)
[![PostgreSQL](https://img.shields.io/badge/VectorDB-PostgreSQL_pgvector-blue.svg)](https://github.com/pgvector/pgvector)

---

## 🌟 Key Features

* **🤖 7-Node LangGraph DAG Orchestrator:** Coordinated state-machine execution across 3 specialized AI agents (Agent 1: YouTube Researcher, Agent 2: RAG Evaluator, Agent 3: Synthesizer).
* **⚡ PostgreSQL pgvector Semantic RAG:** Transcripts are chunked into 1,000-character windows, embedded into 768-dimensional dense vectors via `text-embedding-004`, and indexed using HNSW Cosine Distance (`<->`).
* **🛡️ 3-Layer Proxy-Resilient Scraper Mesh:** Webshare proxy pool authentication, environment proxy fallbacks, and sequential language tag scanning for zero transcript failure rates.
* **📊 Interactive 2D Knowledge Graph:** Visualizes relationships between research topics, video tutorials, and core technical concepts in real-time.
* **📄 Markdown & PDF Export:** One-click generation of publication-ready technical reports complete with score meters, learning paths, strengths/weaknesses, and timestamped video links.
* **🔗 Public Report Sharing:** Toggle public access on any research run to generate a shareable link.
* **📈 Profile Research Analytics:** Detailed activity analytics tracking total queries, videos analyzed, audience reach, average RAG scores, vector embeddings stored, and top discovered channels.
* **🔐 Enterprise Auth Security:** Short-lived JWT Access Tokens, Refresh Token rotation, bcrypt password hashing, and Google OAuth2 single sign-on.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Frontend ["React 19 + TypeScript + Vite"]
        UI[Dashboard & Search Interface]
        Graph[2D Knowledge Graph Visualizer]
        Report[Report Render Engine]
    end

    subgraph Backend ["FastAPI + Python 3.12"]
        API[FastAPI REST API Router]
        Auth[JWT & Google OAuth2 Auth Service]
        Pipeline[Research Pipeline Engine]
    end

    subgraph LangGraph ["LangGraph 7-Node DAG Engine"]
        N1[1. Input Validator] --> N2[2. Query Planner Agent 1]
        N2 --> N3[3. YouTube Crawler & Proxy Scraper]
        N3 --> N4[4. Text Chunker & Embedder]
        N4 --> N5[5. RAG Evaluator Agent 2]
        N5 --> N6[6. Report Synthesizer Agent 3]
        N6 --> N7[7. Persistence Node]
    end

    subgraph Data ["PostgreSQL 16 + pgvector"]
        Relational[(users, research_runs, videos)]
        VectorDB[(video_chunks vector 768 HNSW)]
    end

    UI -->|REST / HTTP| API
    API --> Auth
    API --> Pipeline
    Pipeline --> N1
    N4 -->|Insert Embeddings| VectorDB
    N5 -->|Cosine Distance Search| VectorDB
    N7 -->|Save Complete Run| Relational
```

> 📖 **Deep Technical Specs:** For comprehensive mathematical formulations, chunking algorithms, and sequence diagrams, refer to [docs/architecture.md](docs/architecture.md).

---

## 🛠️ Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript | High-performance SPA with strict typing |
| **Styling & Icons** | Tailwind CSS v4 + Lucide React | Modern dark mode glassmorphism UI |
| **Build System** | Vite | Lightning-fast module bundling |
| **Backend Framework** | FastAPI (Python 3.12) | High-performance asynchronous REST API |
| **Agent Orchestrator** | LangGraph | State-machine multi-agent graph DAG |
| **LLM & Embeddings** | Gemini 3.5 Flash & `text-embedding-004` | 768-dimensional dense vector embeddings |
| **Database** | PostgreSQL 16 + `pgvector` | Relational storage & HNSW Cosine Distance vector search |
| **Containerization** | Docker Compose | Multi-container orchestrated setup |

---

## 🚀 Quickstart Guide

### Prerequisites
- [Docker & Docker Compose](https://docs.docker.com/get-docker/) installed.
- [Google Gemini API Key](https://aistudio.google.com/) for LLM reasoning and embedding generation.
- [YouTube Data API Key](https://console.cloud.google.com/) for YouTube video metadata search.

### 1. Clone Repository & Setup Environment

```bash
git clone https://github.com/saketjha34/ResearchTube.git
cd ResearchTube
```

Create a `.env` file in `backend/`:

```env
# Database Configuration
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/youtube_research
POSTGRES_DB=youtube_research
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Secret Keys
SECRET_KEY=your_super_secret_jwt_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# API Keys
GEMINI_API_KEY=your_gemini_api_key
YOUTUBE_API_KEY=your_youtube_api_key

# Optional Proxy Configuration
WEBSHARE_PROXY_USERNAME=
WEBSHARE_PROXY_PASSWORD=
```

### 2. Launch Containers with Docker Compose

```bash
docker compose up --build
```

The services will spin up at:
- **Frontend Dashboard:** `http://localhost:5173`
- **Backend REST API:** `http://localhost:8000`
- **Interactive Swagger Docs:** `http://localhost:8000/docs`

---

## 🔌 API Endpoints Overview

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/auth/register` | Create a new user account | ❌ |
| `POST` | `/auth/login` | Authenticate & receive JWT access + refresh tokens | ❌ |
| `GET` | `/auth/google` | Initiate Google OAuth2 login flow | ❌ |
| `POST` | `/research/run` | Execute multi-agent research pipeline on a topic | ✅ |
| `GET` | `/research/history` | Retrieve user's past research runs | ✅ |
| `GET` | `/research/history/{run_id}` | Fetch detailed research run by ID | ✅ |
| `POST` | `/research/share/{run_id}` | Toggle public sharing link | ✅ |
| `GET` | `/research/public/{share_token}` | Access public research report | ❌ |
| `GET` | `/user/stats` | Retrieve user research analytics metrics | ✅ |
| `DELETE` | `/user/account` | Permanently wipe user account and data | ✅ |

---

## 📁 Repository Structure

```text
ResearchTube/
├── docs/
│   └── architecture.md       # Detailed technical architecture specs & diagrams
├── ARCHITECTURE.md           # Root architectural overview reference
├── README.md                 # Complete project documentation & setup guide
├── docker-compose.yaml       # Orchestrates PostgreSQL, FastAPI backend & React frontend
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI route handlers (auth, research, user)
│   │   ├── core/             # Config, DB initialization, JWT security utilities
│   │   ├── models/           # SQLAlchemy ORM models (User, ResearchRun, Video, Chunk)
│   │   ├── schemas/          # Pydantic data validation schemas
│   │   └── services/         # LangGraph agents, proxy scraper, vector RAG logic
│   ├── Dockerfile            # Python 3.12 Docker configuration
│   └── requirements.txt      # Python dependencies (FastAPI, LangGraph, pgvector, etc.)
└── frontend/
    ├── src/
    │   ├── api/              # Axios client API handlers & token interceptors
    │   ├── components/       # UI components (KnowledgeGraph, Sidebar, UserMenu, etc.)
    │   ├── context/          # React AuthContext & full-screen loading screen
    │   ├── layouts/          # Dashboard AppLayout with page transition keying
    │   └── pages/            # Research, Profile, Landing, Library, About, Auth pages
    └── Dockerfile            # Vite React 19 Docker configuration
```

---

## 👨‍💻 Author & Attribution

Designed and built by **Saket Jha**.
- **GitHub:** [@saketjha34](https://github.com/saketjha34)
- **Repository:** [https://github.com/saketjha34/ResearchTube](https://github.com/saketjha34/ResearchTube)

---

## 📜 License

This project is released under the [MIT License](LICENSE).
