# ResearchTube 🎓🤖

> **Automated Multi-Agent YouTube Research Platform**
> Transform raw YouTube video streams into structured, publication-grade research reports using **LangGraph autonomous agents**, **PostgreSQL pgvector RAG**, and **Google Gemini 3.5**.

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/Frontend-React_19-61DAFB.svg)](https://react.dev/)
[![LangGraph](https://img.shields.io/badge/Orchestrator-LangGraph-purple.svg)](https://langchain-ai.github.io/langgraph/)
[![PostgreSQL](https://img.shields.io/badge/VectorDB-PostgreSQL_pgvector-blue.svg)](https://github.com/pgvector/pgvector)

---

## 📌 Project Overview & Mission

Technical YouTube content—including architecture lectures, conference talks, and deep-dive coding tutorials—contains invaluable engineering knowledge. However, accessing this knowledge manually presents major challenges:
- **Time Inefficiency:** Watching multiple 45-minute technical lectures to find specific code implementations is slow and tedious.
- **Low Signal-to-Noise Ratio:** Traditional keyword search cannot evaluate code quality, tutorial rigor, or technical accuracy.
- **Lack of Persistent Vector Indexing:** Notes taken manually lack semantic search indexes for instant evidence retrieval across hundreds of hours of video.

**ResearchTube** solves these problems by deploying an autonomous **Multi-Agent RAG Pipeline**:
1. **Agent 1 (YouTube Researcher):** Decomposes research topics into targeted sub-queries, crawls YouTube metadata, and extracts video transcripts via a 3-layer proxy mesh.
2. **Agent 2 (RAG Evaluator):** Slices transcripts into sliding-window chunks, generates 768-dimensional vector embeddings, performs Cosine Distance search (`<->`) against PostgreSQL `pgvector`, and grades content relevance and educational quality.
3. **Agent 3 (Synthesizer):** Synthesizes evidence chunks into publication-grade Markdown research reports complete with score meters, step-by-step learning paths, and interactive 2D knowledge graphs.

---

## ⚙️ Running Frontend & Backend (Setup Documentation)

For detailed installation instructions, environment variables configuration, local development setups, and subsystem architecture specs, refer to the respective subsystem documentation:

* ⚙️ **[Backend Documentation & Setup Guide](backend/README.md):** Complete guide for installing Python 3.12 dependencies, setting up `.env` secret keys, initializing PostgreSQL `pgvector` schemas, running FastAPI servers, and exploring interactive Swagger API docs.
* 🎨 **[Frontend Documentation & Setup Guide](frontend/README.md):** Complete guide for setting up React 19 SPA, Node.js dependencies, Vite build configurations, Tailwind CSS v4 styling, component hierarchy, and routing.

---

## 🏗️ System Architecture Flowchart

```mermaid
flowchart TB
    subgraph Clients ["🖥️ Client & Presentation Layer"]
        Browser["User Browser (React 19 SPA)"]
        AuthContext["Auth Context & Token Storage"]
        StateCache["Browser LocalStorage Cache"]
    end

    subgraph GatewayLayer ["🚪 API Gateway & Security Infrastructure"]
        APIGateway["FastAPI API Gateway / Nginx"]
        RateLimiter["Rate-Limiting Middleware"]
        JWTAuthFilter["JWT Bearer & Auth Filter"]
    end

    subgraph CoreServices ["⚙️ Core Application Services"]
        AuthService["Auth & Identity Service"]
        UserStatsService["User Analytics & Profile Service"]
        ResearchManager["Research Pipeline Orchestrator"]
        ShareService["Public Share Link Service"]
    end

    subgraph AgentEngine ["🤖 LangGraph Multi-Agent DAG (7-Node Engine)"]
        N1["1. Input Validator"] --> N2["2. Agent 1: Query Planner"]
        N2 --> N3["3. Agent 1: Scraper Mesh"]
        N3 --> N4["4. Text Chunker & Embedder"]
        N4 --> N5["5. Agent 2: RAG Evaluator"]
        N5 --> N6["6. Agent 3: Synthesizer"]
        N6 --> N7["7. Persistence Node"]
    end

    subgraph StorageLayer ["💾 PostgreSQL 16 + pgvector Infrastructure"]
        tblRelational[(Relational Tables: users, runs, videos)]
        tblVector[(Vector Engine: video_chunks HNSW Index)]
    end

    Browser --> APIGateway
    APIGateway --> RateLimiter --> JWTAuthFilter
    JWTAuthFilter --> AuthService & UserStatsService & ResearchManager & ShareService
    ResearchManager --> N1
    N4 -->|Store 768d Embeddings| tblVector
    N5 <-->|Cosine Similarity Search <->| tblVector
    N7 -->|Commit Run Data| tblRelational
```

> 📖 **Deep Technical Specs:** For comprehensive mathematical formulations, chunking algorithms, and sequence diagrams, refer to [docs/architecture.md](docs/architecture.md) and root [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 🛠️ Detailed Technology Stack

| Layer | Technology | Technical Purpose & Details |
| :--- | :--- | :--- |
| **Agent Orchestrator** | **LangGraph** | Manages multi-agent execution state machine across 7 nodes with typed state pass-through and cyclic reasoning capabilities. |
| **Vector RAG Engine** | **PostgreSQL 16 + pgvector** | Stores 768-dimensional dense vector embeddings in `video_chunks` table with HNSW Cosine Distance indexes (`m=16`, `ef_construction=64`). |
| **AI LLM & Embeddings** | **Google Gemini 3.5 & text-embedding-004** | Synthesizes technical reports, grades video depth/pros/cons, and generates 768-dimensional dense text embeddings. |
| **Backend REST Gateway** | **FastAPI (Python 3.12)** | Asynchronous Python backend utilizing Pydantic v2 schemas, async SQLAlchemy ORM, and JWT authentication. |
| **Frontend UI** | **React 19 + TypeScript + Vite** | High-performance Single Page Application using strict TypeScript, React Router v6, and Vite module bundling. |
| **Styling & Icons** | **Tailwind CSS v4 + Lucide React** | Modern dark glassmorphic design system with custom keyframe route animations and Space Grotesk typography. |
| **Proxy Scraper Mesh** | **Webshare Proxy Integration** | 3-layer anti-block scraper mesh using residential proxy authentication, system IP fallbacks, and sequential language tag scanning. |
| **Containerization** | **Docker & Docker Compose** | Multi-container orchestrated development and production setup connecting Frontend, Backend, and PostgreSQL database. |

---

## 🌟 Core System Capabilities

* **🤖 7-Node LangGraph DAG Orchestrator:** Coordinated state-machine execution across 3 specialized AI agents (Agent 1: YouTube Researcher, Agent 2: RAG Evaluator, Agent 3: Synthesizer).
* **⚡ PostgreSQL pgvector Semantic RAG:** Transcripts are chunked into 1,000-character windows, embedded into 768-dimensional dense vectors via `text-embedding-004`, and indexed using HNSW Cosine Distance (`<->`).
* **🛡️ 3-Layer Proxy-Resilient Scraper Mesh:** Webshare proxy pool authentication, environment proxy fallbacks, and sequential language tag scanning for zero transcript failure rates.
* **📊 Interactive 2D Knowledge Graph:** Visualizes relationships between research topics, video tutorials, and core technical concepts in real-time.
* **📄 Markdown & PDF Export:** One-click generation of publication-ready technical reports complete with score meters, learning paths, strengths/weaknesses, and timestamped video links.
* **🔗 Public Report Sharing:** Toggle public access on any research run to generate a shareable link.
* **📈 Profile Research Analytics:** Detailed activity analytics tracking total queries, videos analyzed, audience reach, average RAG scores, vector embeddings stored, and top discovered channels.
* **🔐 Enterprise Auth Security:** Short-lived JWT Access Tokens, Refresh Token rotation, bcrypt password hashing, and Google OAuth2 single sign-on.

---

## 📁 Repository Structure

```text
ResearchTube/
├── docs/
│   └── architecture.md       # Detailed technical architecture specs & diagrams
├── ARCHITECTURE.md           # Root architectural overview reference
├── README.md                 # Complete project overview & system design guide
├── docker-compose.yaml       # Orchestrates PostgreSQL, FastAPI backend & React frontend
├── backend/
│   ├── README.md             # Backend setup guide, API specs, and database docs
│   ├── app/                  # FastAPI routes, models, schemas, and LangGraph services
│   ├── Dockerfile            # Python 3.12 Docker configuration
│   └── requirements.txt      # Python dependencies
└── frontend/
    ├── README.md             # Frontend setup guide, component specs, and styling docs
    ├── src/                  # React 19 pages, components, context, and API handlers
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
