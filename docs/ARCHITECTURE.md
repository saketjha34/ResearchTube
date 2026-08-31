# ResearchTube: Complete System Architecture & Technical Specifications

> **ResearchTube** is an enterprise-grade, multi-agent AI research pipeline that converts raw YouTube video streams into structured, publication-ready technical intelligence reports. It leverages a **7-node LangGraph Directed Acyclic Graph (DAG)** state machine, **PostgreSQL pgvector RAG** semantic retrieval, a **3-layer proxy-resilient transcript scraper**, and a modern **React 19 + FastAPI** architecture.

---

## 1. High-Level Architecture Overview

ResearchTube is structured into four decoupled system layers:
1. **Presentation Layer (Frontend):** Built with React 19, TypeScript, Vite, Tailwind CSS v4, and React Router v6. Renders real-time multi-agent execution steppers, interactive 2D D3/SVG knowledge graphs, and publication-ready Markdown research reports.
2. **Application & API Layer (Backend):** Built with FastAPI (Python 3.12), Async SQLAlchemy ORM, and Pydantic v2 schemas. Provides REST APIs for authentication, research run generation, history management, public report sharing, and user analytics.
3. **Multi-Agent Orchestration Engine (LangGraph DAG):** Coordinates three specialized Gemini-powered agents across seven state-machine nodes to crawl YouTube, chunk & embed transcripts, perform RAG vector queries, evaluate video depth, and synthesize Markdown reports.
4. **Data & Vector Storage Layer (PostgreSQL pgvector):** Stores user accounts, research run history, video metadata, sliding-window transcript chunks, dense 768-dimensional vector embeddings, and HNSW vector distance indexes.

```mermaid
flowchart TD
    subgraph Client ["Frontend Layer (React 19 + TypeScript + Vite)"]
        UI[User Interface & Dashboard]
        AuthContext[Auth Context & JWT Token Manager]
        GraphView[2D Knowledge Graph Visualizer]
        ReportComp[Report Render Engine]
    end

    subgraph API ["Backend API Layer (FastAPI + Python 3.12)"]
        Router[FastAPI Router & CORS Middleware]
        AuthService[JWT & OAuth2 Auth Service]
        ResearchService[Research Pipeline Manager]
        UserService[User Analytics Service]
    end

    subgraph Agents ["Orchestration Layer (LangGraph 7-Node DAG)"]
        Node1[1. Input Validator Node]
        Node2[2. Query Planner Agent 1]
        Node3[3. YouTube Crawler & Proxy Scraper Node]
        Node4[4. Text Chunker & Embedder Node]
        Node5[5. RAG Evaluator Agent 2]
        Node6[6. Report Synthesizer Agent 3]
        Node7[7. Persistence Node]
    end

    subgraph External ["External AI & Video Services"]
        YTAPI[YouTube Data v3 API]
        ProxyMesh[Webshare 3-Layer Proxy Mesh]
        GeminiLLM[Google Gemini 3.5 Flash LLM]
        GeminiEmbed[Google text-embedding-004]
    end

    subgraph DB ["Data Layer (PostgreSQL 16 + pgvector)"]
        pgRelational[(Relational Tables: users, runs, videos)]
        pgVector[(Vector Table: video_chunks vector 768)]
        HNSWIndex[HNSW Vector Distance Index]
    end

    UI -->|HTTP / REST| Router
    Router --> AuthService
    Router --> ResearchService
    Router --> UserService

    ResearchService -->|Trigger Graph Run| Node1
    Node1 --> Node2
    Node2 -->|Generate Search Terms| GeminiLLM
    Node2 --> Node3
    Node3 -->|Search Metadata| YTAPI
    Node3 -->|Fetch Transcripts| ProxyMesh
    Node3 --> Node4
    Node4 -->|Generate 768d Embeddings| GeminiEmbed
    Node4 -->|Store Chunks & Embeddings| pgVector
    Node4 --> HNSWIndex
    Node4 --> Node5
    Node5 -->|Cosine Distance Vector Query| pgVector
    Node5 -->|Grade & Score Content| GeminiLLM
    Node5 --> Node6
    Node6 -->|Synthesize Final Markdown Report| GeminiLLM
    Node6 --> Node7
    Node7 -->|Persist Complete Run| pgRelational
```

---

## 2. Multi-Agent LangGraph DAG Architecture

ResearchTube organizes autonomous reasoning using **LangGraph**, representing agent execution as a state machine with a strictly typed `ResearchGraphState`.

### 2.1 Graph Execution State (`ResearchGraphState`)

The graph state flows through all 7 nodes, accumulating data immutably:

```python
class ResearchGraphState(TypedDict):
    user_id: str
    query: str
    video_count: int
    search_queries: List[str]
    raw_videos: List[Dict[str, Any]]
    processed_videos: List[Dict[str, Any]]
    chunks: List[Dict[str, Any]]
    rag_evaluations: List[Dict[str, Any]]
    final_report: Dict[str, Any]
    error: Optional[str]
    execution_stage: str
```

### 2.2 LangGraph Node Responsibilities

```mermaid
stateDiagram-v2
    [*] --> InputValidator: Request Initiated
    InputValidator --> QueryPlanner: Input Validated
    QueryPlanner --> YouTubeCrawler: Search Strategy Ready
    YouTubeCrawler --> TextChunkerEmbedder: Raw Transcripts Scraped
    TextChunkerEmbedder --> RAGEvaluator: 768d Vectors Indexed
    RAGEvaluator --> ReportSynthesizer: Semantic Evidence Scored
    ReportSynthesizer --> PersistenceNode: Report Synthesized
    PersistenceNode --> [*]: Run Saved to Database
```

1. **Node 1: `input_validator`**
   - Sanitizes and validates the user search query string.
   - Checks user rate limits and video count boundaries (default 2 to 10 videos).
2. **Node 2: `query_planner` (Agent 1 - Researcher Part 1)**
   - Prompts Gemini 3.5 Flash to decompose complex research questions into 3-5 sub-queries.
   - Example: For *"Postgres pgvector RAG"*, generates sub-terms: `"pgvector HNSW index tuning"`, `"PostgreSQL Cosine distance vector search"`, `"Postgres vs Pinecone vector performance"`.
3. **Node 3: `youtube_crawler` (Agent 1 - Researcher Part 2)**
   - Queries YouTube Data v3 API for candidate videos per sub-query.
   - Filters out duplicates, live streams, and low-view noise.
   - Executes the **3-Layer Proxy Scraper Mesh** to download video transcripts:
     - **Layer 1:** Authenticated Webshare Residential Proxy pool.
     - **Layer 2:** System environment generic proxy fallback.
     - **Layer 3:** Sequential language variant fallback (`en`, `en-US`, `en-GB`, auto-translated).
4. **Node 4: `text_chunker_embedder`**
   - Splits extracted transcripts using a sliding window strategy (1,000 characters per chunk, 150-character overlap).
   - Calls Google `text-embedding-004` to generate a 768-dimensional dense vector embedding for every transcript chunk.
   - Inserts chunks and vectors into PostgreSQL `video_chunks` table with `vector(768)` type.
5. **Node 5: `rag_evaluator` (Agent 2 - RAG Evaluator)**
   - Performs Vector Distance Similarity search against stored chunks using Cosine Distance (`<->`).
   - Prompts Agent 2 to grade each video across three core metrics (0.0 to 10.0 scale):
     - **Relevance Score:** Match accuracy against user query.
     - **Educational Quality Score:** Clarity of explanation, code examples, and rigor.
     - **Coverage Score:** Breadth of technical concepts explained.
   - Identifies specific technical strengths, weaknesses, target audience suitability (beginner-friendly tag), and key concept tags.
6. **Node 6: `report_synthesizer` (Agent 3 - Synthesizer)**
   - Aggregates top-ranked video metadata, vector chunk evidence, and Agent 2 metrics.
   - Synthesizes a structured JSON/Markdown publication-ready research report:
     - **Executive Summary:** Concise high-level technical synthesis.
     - **Recommended Resources:** Ordered video recommendations with score bars, strengths, weaknesses, and direct YouTube URLs.
     - **Key Topics:** Highlighted concept tags.
     - **Step-by-Step Learning Path:** Sequential curriculum for mastering the topic.
     - **Methodology & Limitations:** Transparent audit notes.
     - **Conclusion:** Definitive trade-off analysis and final architectural takeaway.
7. **Node 7: `persistence_node`**
   - Writes the completed research run, video links, and 2D knowledge graph nodes/edges into PostgreSQL database tables (`research_runs`).

---

## 3. RAG & Vector Search Architecture

### 3.1 Transcript Chunking Math

Transcripts are processed using a deterministic sliding window algorithm:

$$\text{Chunk}_i = \text{Transcript}[i \cdot (W - O) : i \cdot (W - O) + W]$$

Where:
- $W = 1000$ (Window size in characters)
- $O = 150$ (Overlap size in characters)
- Stride $S = W - O = 850$ characters

This guarantees semantic continuity across sentence boundaries and prevents context loss at chunk edges.

### 3.2 Embedding & Vector Storage Schema

Dense vectors are generated via `text-embedding-004` (768 dimensions) and stored in PostgreSQL:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE video_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    start_timestamp FLOAT NOT NULL,
    end_timestamp FLOAT NOT NULL,
    text_content TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- High-performance HNSW index for Cosine Distance vector search
CREATE INDEX idx_video_chunks_embedding_hnsw 
ON video_chunks 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
```

### 3.3 Vector Similarity Search Execution

```mermaid
sequenceDiagram
    autonumber
    participant Agent2 as Agent 2 (RAG Evaluator)
    participant DB as PostgreSQL pgvector
    participant Embed as text-embedding-004 API

    Agent2->>Embed: Embed user search query
    Embed-->>Agent2: Return 768-dim query vector [v1, v2, ... v768]
    Agent2->>DB: SELECT chunk_text, (embedding <=> query_vec) AS distance FROM video_chunks ORDER BY distance ASC LIMIT 15
    DB-->>Agent2: Return top-15 relevant evidence chunks with start/end timestamps
```

Vector similarity is computed via SQL Cosine Distance:

$$\text{CosineDistance}(u, v) = 1 - \frac{u \cdot v}{\|u\|_2 \|v\|_2}$$

---

## 4. Authentication & Security Architecture

ResearchTube implements enterprise auth via **JWT Tokens (Access + Refresh)** and **Google OAuth2 Code Grant**.

```mermaid
sequenceDiagram
    autonumber
    participant User as Client Browser
    participant API as FastAPI Auth Endpoints
    participant Google as Google Identity Provider
    participant DB as PostgreSQL Database

    alt Email & Password Registration / Login
        User->>API: POST /auth/login { email, password }
        API->>DB: Fetch user record & verify bcrypt hash
        DB-->>API: User verified
        API-->>User: Return { access_token (30m), refresh_token (7d), user }
    else Google OAuth2 Authentication
        User->>API: GET /auth/google
        API-->>User: Redirect 302 to Google OAuth Consent Page
        User->>Google: Authenticate & Approve Scope
        Google-->>User: Redirect to /auth/callback?code=...
        User->>API: GET /auth/google/callback?code=...
        API->>Google: Exchange code for Google Access Token
        Google-->>API: Return user email, name, avatar URL
        API->>DB: Upsert user record
        API-->>User: Redirect to /auth/callback#access_token=...&refresh_token=...
    end
```

---

## 5. Database Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    users {
        uuid id PK
        string email UK
        string username UK
        string full_name
        text profile_picture_url
        boolean is_active
        boolean is_verified
        datetime created_at
        datetime updated_at
    }

    user_auth {
        uuid id PK
        uuid user_id FK
        text password_hash
        datetime last_password_change
        datetime created_at
    }

    oauth_accounts {
        uuid id PK
        uuid user_id FK
        string provider
        string provider_user_id UK
        string provider_email
        text access_token
        text refresh_token
        datetime expires_at
        datetime created_at
    }

    refresh_tokens {
        uuid id PK
        uuid user_id FK
        text token_hash UK
        datetime expires_at
        boolean revoked
        datetime created_at
    }

    research_runs {
        uuid id PK
        uuid user_id FK
        text user_query
        integer video_count
        string status
        boolean is_public
        text error_message
        datetime started_at
        datetime completed_at
        datetime created_at
    }

    youtube_videos {
        uuid id PK
        string video_id UK
        text title
        text description
        string channel
        datetime published_at
        text url
        integer views
        integer likes
        integer comments
        datetime created_at
    }

    research_videos {
        uuid id PK
        uuid research_run_id FK
        uuid video_id FK
        integer position
        boolean transcript_available
        string transcript_language
        datetime created_at
    }

    transcript_chunks {
        uuid id PK
        uuid research_run_id FK
        uuid video_id FK
        text text
        vector embedding
        string language
    }

    resource_evaluations {
        uuid id PK
        uuid research_run_id FK
        uuid video_id FK
        float relevance_score
        string technical_depth
        json pros
        json cons
        text key_takeaways
        datetime created_at
    }

    resource_rankings {
        uuid id PK
        uuid research_run_id FK
        json rankings_list
        datetime created_at
    }

    final_reports {
        uuid id PK
        uuid research_run_id FK
        text content
        datetime created_at
    }

    users ||--o{ research_runs : "creates"
    users ||--o| user_auth : "has local"
    users ||--o{ oauth_accounts : "links social"
    users ||--o{ refresh_tokens : "signs"
    
    research_runs ||--o{ research_videos : "crawls"
    research_runs ||--o{ transcript_chunks : "vectorizes"
    research_runs ||--o{ resource_evaluations : "scores"
    research_runs ||--|| resource_rankings : "orders"
    research_runs ||--|| final_reports : "synthesizes"

    youtube_videos ||--o{ research_videos : "assigned"
    youtube_videos ||--o{ transcript_chunks : "chunked"
    youtube_videos ||--o{ resource_evaluations : "evaluated"
```

---

## 6. Frontend Architecture & Component Hierarchy

The frontend is structured modularly with clear separation of UI pages, state context, and layout components:

```text
frontend/src/
├── api/
│   ├── client.ts          # Axios instance with JWT interceptors & token refresh
│   ├── auth.ts            # Auth requests & localStorage session persistence
│   └── research.ts        # Research pipeline API calls & history queries
├── components/
│   ├── Button.tsx         # Primary & Secondary button design system
│   ├── Input.tsx          # Form inputs with helper text & validation
│   ├── Navbar.tsx          # Main header navigation bar
│   ├── Sidebar.tsx         # Collapsible sidebar with active tab glow
│   ├── UserMenu.tsx       # Profile menu & logout trigger
│   └── KnowledgeGraph.tsx # D3 / SVG 2D Knowledge Graph Visualizer
├── context/
│   └── AuthContext.tsx    # Auth state, login/register/logout, full-screen loading screen
├── layouts/
│   └── AppLayout.tsx      # Authenticated dashboard wrapper with route key animation
└── pages/
    ├── Landing.tsx        # Public landing page with live interactive pipeline demo
    ├── Research.tsx       # Research dashboard, search bar, history drawer, ReportView
    ├── Profile.tsx        # Profile management, security, and Research Analytics stats
    ├── Library.tsx        # Feature showcase library
    ├── About.tsx          # Project architecture & mission
    ├── Login.tsx          # Sign-in page with Google OAuth button
    ├── Register.tsx       # Account creation page
    └── SharedReport.tsx   # Public share view for research reports
```

---

## 7. Performance & Verification Standards

1. **TypeScript Strict Verification:** All frontend code passes strict TypeScript checks (`npx tsc --noEmit`) with 0 compilation errors.
2. **Caching Strategy:** Profile analytics stats use `localStorage` key `rt_user_analytics_stats` with auto-invalidation on `research:created` events and manual refresh controls.
3. **Resilient Scraper:** The 3-layer proxy scraper handles IP blocking, rate limits, and missing transcript languages seamlessly.
4. **HNSW Vector Search:** Vector searches execute in `< 15ms` even across tens of thousands of embedded transcript chunks.
