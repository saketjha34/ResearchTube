# ResearchTube: Complete System Architecture & Technical Specifications

> **ResearchTube** is an enterprise-grade, multi-agent AI research pipeline that converts raw YouTube video streams into structured, publication-ready technical intelligence reports. It leverages a **7-node LangGraph Directed Acyclic Graph (DAG)** state machine, **PostgreSQL pgvector RAG** semantic retrieval, a **3-layer proxy-resilient transcript scraper**, and a modern **React 19 + FastAPI** architecture.


## 1. HIGH LEVEL SYSTEM DESIGN

![](static/images/hld.png)


## 2. Auth Service

```mermaid

flowchart TD
    Start(["User Visits ResearchTube"]) --> AuthChoice{"Choose Auth Path"}

    %% Local Registration
    AuthChoice -->|"Sign Up"| RegInput["Submit Email, Username, and Password"]
    RegInput --> RegCheck{"Email & Username Unique?"}
    RegCheck -->|"No"| RegErr["Return Conflict Error"]
    RegCheck -->|"Yes"| RegCreate["Create User Profile & Store Hashed Password"]
    RegCreate --> IssuePair["Issue JWT Access Token + Opaque Refresh Token"]

    %% Local Login
    AuthChoice -->|"Sign In"| LoginInput["Submit Email/Username + Password"]
    LoginInput --> LoginCheck{"Account Active & Password Valid?"}
    LoginCheck -->|"No"| LoginErr["Return 401 Unauthorized"]
    LoginCheck -->|"Yes"| IssuePair

    %% Google OAuth
    AuthChoice -->|"Continue with Google"| GoogleRedirect["Redirect to Google Consent Screen"]
    GoogleRedirect --> GoogleCallback["Receive Auth Code & Exchange for Google Profile"]
    GoogleCallback --> OAuthLookup{"Google Account Linked?"}
    OAuthLookup -->|"Yes"| FetchUser["Load Linked User"]
    OAuthLookup -->|"No"| EmailLookup{"User Exists with Same Email?"}
    EmailLookup -->|"Yes"| LinkAccount["Link Google Account & Mark Verified"]
    EmailLookup -->|"No"| CreateGoogleUser["Create Verified User & Link Google Account"]
    FetchUser --> IssuePair
    LinkAccount --> IssuePair
    CreateGoogleUser --> RedirectFE["Redirect to Frontend Callback with Tokens in URL Fragment"]
    RedirectFE --> Authenticated

    %% Forgot / Reset Password
    AuthChoice -->|"Forgot Password"| ResetReq["Submit Email or Username"]
    ResetReq --> GenReset["Invalidate Old Tokens, Store Hashed Reset Token, Send Email"]
    GenReset --> ResetLink["User Opens Reset Link & Submits New Password"]
    ResetLink --> VerifyReset{"Token Valid, Unused, Not Expired & User Matches?"}
    VerifyReset -->|"No"| ResetErr["Reject Reset Request"]
    VerifyReset -->|"Yes"| UpdatePass["Update Password Hash & Revoke All Refresh Sessions"]
    UpdatePass --> LoginInput

    %% Authenticated Session
    IssuePair --> Authenticated["User Authenticated"]
    Authenticated --> ApiCall["Call Protected API with Bearer JWT"]
    ApiCall --> JwtCheck{"JWT Valid & User Active?"}
    JwtCheck -->|"Yes"| AllowAccess["Serve Protected Resource"]
    JwtCheck -->|"Expired"| RefreshCall["Send Refresh Token"]

    RefreshCall --> RefreshCheck{"Refresh Token Valid & Not Expired?"}
    RefreshCheck -->|"No"| ForceLogin["Session Expired - Re-login Required"]
    RefreshCheck -->|"Revoked within 30s Grace Window"| GraceIssue["Issue New Access Token (Multi-Tab Safe)"]
    RefreshCheck -->|"Active"| RotateToken["Revoke Old Refresh Token & Issue New Token Pair"]
    GraceIssue --> AllowAccess
    RotateToken --> AllowAccess

    %% Logout
    Authenticated -->|"Logout"| RevokeSession["Mark Refresh Token Revoked"]
    RevokeSession --> LoggedOut(["Session Ended"])
```

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Browser
    participant FE as Frontend App
    participant API as Backend API
    participant DB as PostgreSQL
    participant Google as Google OAuth
    participant Email as Email Service

    rect rgba(255, 241, 118, 0.25)
        Note over User, DB: 1. Local Registration & Sign-In
        User->>FE: Enter credentials (Sign Up or Sign In)
        FE->>API: POST credentials
        API->>DB: Verify uniqueness / Check password hash
        DB-->>API: User record confirmed
        API->>DB: Store hashed Refresh Token (7-day expiry)
        API-->>FE: Return JWT Access Token + Refresh Token + User
        FE-->>User: Store session & enter app
    end

    rect rgba(255, 241, 118, 0.25)
        Note over User, Google: 2. Google OAuth2 Sign-In
        User->>FE: Click "Continue with Google"
        FE->>API: Request Google login redirect
        API-->>User: 302 Redirect to Google (with CSRF state in session)
        User->>Google: Authenticate & grant consent
        Google-->>API: Callback with authorization code
        API->>Google: Exchange code for access token & profile
        Google-->>API: Return Google ID, email, name, avatar
        API->>DB: Find OAuth link or match/create User by email
        DB-->>API: User record ready
        API->>DB: Store hashed Refresh Token
        API-->>FE: 302 Redirect to /auth/callback#tokens&user
        FE-->>User: Parse fragment & enter app
    end

    rect rgba(255, 241, 118, 0.25)
        Note over User, DB: 3. Protected Requests & Token Refresh
        User->>FE: Open protected page / action
        FE->>API: API request with Authorization: Bearer JWT
        alt JWT Valid
            API->>DB: Confirm user exists & is active
            API-->>FE: Return requested data
        else JWT Expired
            API-->>FE: 401 Token Expired
            FE->>API: Send Refresh Token
            API->>DB: Lookup hashed Refresh Token
            alt Active Refresh Token
                API->>DB: Revoke old token & save new Refresh Token
                API-->>FE: Return new JWT + new Refresh Token
            else Revoked within 30s Grace Window
                API-->>FE: Return new JWT (prevents multi-tab race failure)
            else Expired or Revoked
                API-->>FE: 401 Session Invalid (redirect to login)
            end
        end
    end

    rect rgba(255, 241, 118, 0.25)
        Note over User, Email: 4. Forgot Password & Reset
        User->>FE: Request password reset (email or username)
        FE->>API: Submit reset request
        API->>DB: Invalidate prior unused tokens & save hashed reset token
        API->>Email: Send reset link email
        API-->>FE: Generic confirmation (prevents user enumeration)
        User->>FE: Open reset link from email
        FE->>API: Validate reset token
        API->>DB: Check token hash, expiry, and unused status
        API-->>FE: Token valid + masked email
        User->>FE: Submit new password
        FE->>API: Confirm identity & update password
        API->>DB: Save new password hash, mark token used, revoke all refresh tokens
        API-->>FE: Password updated (prompt re-login)
    end

    rect rgba(255, 241, 118, 0.25)
        Note over User, DB: 5. Logout
        User->>FE: Click Logout
        FE->>API: Send Refresh Token to logout
        API->>DB: Mark Refresh Token as revoked
        API-->>FE: Logged out
        FE-->>User: Clear local tokens & return to login
    end
```

## 3. YouTube Research Service

`POST /youtube/research` creates a `research_runs` record and executes a **7-node linear LangGraph `StateGraph`** orchestrated by `YoutubeResearchService`:

1. **Node 1 — Agent 1 (Search & Collect):** Plans search parameters via DualLLM (OpenAI primary, Gemini fallback), queries YouTube Data API for videos/metadata, and fetches transcripts.
2. **Node 2 — Persist Research:** Upserts videos (`youtube_videos`, `research_videos`) and maps YouTube IDs to DB UUIDs.
3. **Node 3 — RAG Ingestion:** Chunks transcripts, generates 768-dim embeddings (OpenAI primary, Gemini fallback), and stores vectors in `pgvector` (`transcript_chunks`).
4. **Node 4 — Agent 2 (RAG Analysis & Ranking):** Runs `pgvector` similarity search per video (scoped to `research_run_id`), evaluates quality/depth/relevance via DualLLM, and ranks videos `1..N`.
5. **Node 5 — Persist Analysis:** Saves `resource_evaluations`, `resource_rankings`, and `ranked_resources`.
6. **Node 6 — Agent 3 (Final Report Synthesis):** Merges Agent 1 metadata + Agent 2 rankings (preserving scores) via DualLLM to generate the executive summary, learning path, and key topics.
7. **Node 7 — Persist Final Report:** Saves `final_reports` and marks the run `"completed"` (or `"failed"` on error).


```mermaid
sequenceDiagram
    autonumber
    actor User
    participant API as FastAPI / Service
    participant LG as LangGraph (7 Nodes)
    participant A1 as Agent 1 (Planner/Collector)
    participant YT as YouTube & Transcript APIs
    participant RAG as RAG Ingestor / pgvector
    participant A2 as Agent 2 (Evaluator/Ranker)
    participant A3 as Agent 3 (Report Synthesizer)
    participant LLM as DualLLM (OpenAI -> Gemini)
    participant DB as PostgreSQL

    User->>API: POST /youtube/research (query, video_count)
    API->>DB: Create research_runs row (status: pending)
    API->>LG: Invoke StateGraph with initial state

    rect rgba(255, 241, 118, 0.25)
        Note over LG, YT: Nodes 1 & 2 — Research & Persist Videos
        LG->>DB: Update status = "researching"
        LG->>A1: Run search & collection
        A1->>LLM: Plan search keywords & parameters
        LLM-->>A1: Structured search plan
        A1->>YT: Search videos, fetch metadata & transcripts
        YT-->>A1: Videos + transcripts
        A1-->>LG: Return research_result
        LG->>DB: Upsert youtube_videos & research_videos, build UUID map
    end

    rect rgba(255, 241, 118, 0.25)
        Note over LG, RAG: Node 3 — Chunk & Embed into pgvector
        LG->>DB: Update status = "ingesting"
        LG->>RAG: Chunk transcripts & generate 768-dim embeddings
        RAG->>DB: Insert transcript_chunks with vectors
    end

    rect rgba(255, 241, 118, 0.25)
        Note over LG, A2: Nodes 4 & 5 — RAG Evaluation, Ranking & Persist
        LG->>DB: Update status = "analyzing"
        LG->>A2: Evaluate & rank videos
        A2->>RAG: Similarity search top chunks per video (scoped to run)
        RAG-->>A2: Relevant transcript evidence
        A2->>LLM: Score depth, quality, relevance & rank 1..N
        LLM-->>A2: Structured ResourceAnalysis
        A2-->>LG: Return analysis
        LG->>DB: Save resource_evaluations, resource_rankings & ranked_resources
    end

    rect rgba(255, 241, 118, 0.25)
        Note over LG, A3: Nodes 6 & 7 — Final Report Synthesis & Complete
        LG->>DB: Update status = "reporting"
        LG->>A3: Synthesize report from Agent 1 + Agent 2 outputs
        A3->>LLM: Generate summary, learning path & key topics
        LLM-->>A3: Structured FinalReport
        A3-->>LG: Return final_report
        LG->>DB: Save final_reports & mark status = "completed"
    end

    LG-->>API: Return final state (report, research_result, analysis)
    API-->>User: 200 OK ResearchAPIResponse
```


## 4. Chat Service

```mermiad
sequenceDiagram
    autonumber
    actor User as Client (React + SSE)
    participant API as FastAPI Chat Routes
    participant CS as Chat Service Facade
    participant DB as PostgreSQL + pgvector
    participant Web as DuckDuckGo & Firecrawl
    participant LLM as DualLLM (OpenAI -> Gemini)
    participant E2B as E2B Cloud Micro-VM

    %% ========================================================
    %% 1. SESSION MANAGEMENT & SCOPING
    %% ========================================================
    rect rgba(255, 241, 118, 0.25)
        Note over User, DB: 1. Session Lifecycle (SessionService & GreetingService)
        User->>API: Create / List / Get / Pin / Archive / Update Scope / Delete Session
        API->>CS: Forward authenticated user_id + payload
        CS->>DB: Validate video/run ownership (if scoped) & mutate chat_sessions
        DB-->>CS: Session metadata & message history
        CS-->>User: Return ChatSessionResponse / DetailResponse
    end

    %% ========================================================
    %% 2. MESSAGING & STREAMING (ALL CASES)
    %% ========================================================
    rect rgba(255, 241, 118, 0.25)
        Note over User, E2B: 2. Send Message (SSE Stream / REST) — Scoping, RAG, Web, Tools & Cancel
        User->>API: POST /chat/sessions/{id}/messages/stream (message, scope, web_search)
        API->>CS: Start async SSE generator

        %% Validation & Atomic Scope Switch
        CS->>DB: Verify session ownership
        opt Atomic Scope Switch or Auto-Unarchive
            CS->>DB: Update scope_mode (none | video | all), video_id, is_archived=false
        end
        CS->>DB: Persist User ChatMessage
        CS-->>User: SSE event: user (saved user message)

        %% Parallel Context Gathering
        par Load History & Scope
            CS->>DB: Fetch recent conversation turns & scope description
        and Scoped RAG Retrieval
            alt scope_mode == "none"
                CS->>CS: Bypass pgvector search (empty context)
            else scope_mode == "video"
                CS->>DB: pgvector similarity search filtered by video_id (+ run_id)
            else scope_mode == "all"
                CS->>DB: pgvector similarity search across all user library videos
            end
        end
        DB-->>CS: History + top-k transcript chunks + source citations

        %% Dual-Mode Web Search
        opt Web Search Enabled OR Live-Query Keywords Detected
            CS-->>User: SSE event: status ("searching")
            CS->>Web: Search live web (top 5 results)
            Web-->>CS: Clean web sources (appended to citations)
            CS-->>User: SSE event: status ("scraping")
            CS->>Web: Scrape top 3 pages (Firecrawl / HTML)
            Web-->>CS: Scraped page content
        end

        %% LLM Streaming + Autonomous Sandbox Loop
        CS->>LLM: Stream prompt (RAG chunks + history + web context) with Python/C++ tools

        alt Case A: Direct Text Response (No Tool Calls)
            loop Token Stream
                LLM-->>CS: Text chunk
                CS-->>User: SSE event: delta ({"text": ...})
            end
        else Case B: Autonomous Code Sandbox Execution (up to 2 tool turns)
            LLM-->>CS: Tool call (execute_python_code or execute_cpp_code)
            CS-->>User: SSE event: status ("executing_code")
            CS->>E2B: Run Python / compile & run C++ in isolated micro-VM
            E2B-->>CS: stdout, stderr, base64 plots, file artifacts (PDF/CSV)
            CS-->>User: SSE event: status ("code_executed", duration, counts)
            CS-->>User: SSE event: status ("generating")
            CS->>LLM: Send ToolMessage results to synthesize final answer
            loop Synthesized Stream
                LLM-->>CS: Text token
                CS-->>User: SSE event: delta ({"text": ...})
            end
            opt Plots or File Artifacts Generated
                CS-->>User: SSE event: delta (Markdown charts & download links)
            end
        end

        %% Cancellation vs Completion
        alt Client Disconnected / Cancelled Mid-Stream
            CS->>DB: Delete persisted user message (clean rollback)
            CS-->>User: Abort stream
        else Stream Completed Normally
            CS->>DB: Persist Assistant ChatMessage (content + JSON sources) & increment message_count (+2)
            CS-->>User: SSE event: done (message_id, sources, sandbox_executed, counts)
        else Runtime Exception
            CS-->>User: SSE event: error ({"detail": ...})
        end
    end

    %% ========================================================
    %% 3. PUBLIC SHARING & FORKING
    %% ========================================================
    rect rgba(255, 241, 118, 0.25)
        Note over User, DB: 3. Sharing & Conversation Forking (ShareService)
        User->>API: POST /chat/sessions/{id}/share (or DELETE to revoke)
        API->>CS: Generate/activate share_token (or set is_shared=false)
        CS->>DB: Update chat_sessions
        CS-->>User: Return share_url (/share/chat/{token})

        User->>API: GET /chat/shared/{share_token} (Public, no auth)
        API->>CS: Lookup token (exact -> case-insensitive -> OCR 7/Z mistype tolerance)
        CS->>DB: Fetch shared session + messages
        CS-->>User: Return PublicSharedChatResponse

        User->>API: POST /chat/shared/{share_token}/fork (Authenticated)
        API->>CS: Clone shared session & all messages for current user
        CS->>DB: Insert new ChatSession + copied ChatMessages
        CS-->>User: Return ForkChatResponse (new session_id)
    end
```


## 5. RAG Architecture

### RAG Architecture Diagram

```mermaid
flowchart LR
    subgraph Ingest["1. Ingestion Pipeline"]
        Raw["Video Transcripts (Agent 1)"] --> Chunker["LangChain RecursiveCharacterTextSplitter (size=1000, overlap=200)"]
        Chunker --> DualEmb["DualEmbeddingService (OpenAI text-embedding-3-small -> Gemini fallback, 768-dim)"]
    end

    subgraph Storage["2. PostgreSQL + pgvector Storage"]
        DB[("transcript_chunks table: text, start_time, end_time, run_id, video_id, embedding Vector(768)")]
    end

    DualEmb -->|"Persist chunks + 768-dim vectors"| DB

    subgraph Retrieval["3. Hybrid Retrieval Engine"]
        Query["User / Agent 2 Query"] --> Dense["Dense Vector Search (pgvector cosine_distance)"]
        Query --> BM25["Sparse Lexical Search (PostgreSQL to_tsvector + ts_rank_cd)"]
        DB -->|"Top candidate_k"| Dense
        DB -->|"Top candidate_k"| BM25
        Dense --> RRF["Reciprocal Rank Fusion (RRF k=60) + Score Calibration"]
        BM25 --> RRF
    end

    RRF -->|"Top-K Ranked Chunks + Citations"| Consumers["Agent 2 (Evaluation/Ranking) & Chat Service (RAG + SSE)"]
```


### End-to-End Ingestion & Hybrid Retrieval

```mermaid
flowchart TD
    %% INGESTION
    Start(["Start: Video Transcripts from Agent 1"]) --> CheckTrans{"Transcript Available & Non-Empty?"}
    CheckTrans -->|"No"| SkipVid["Skip Video (Log rag.skipped)"]
    CheckTrans -->|"Yes"| Split["Split Text: RecursiveCharacterTextSplitter (1000 chars, 200 overlap)"]
    Split --> EmbedDocs["DualEmbeddingService: Batch Embed (OpenAI batch 100 -> Gemini batch 50)"]
    EmbedDocs --> SaveDB["Insert TranscriptChunk Rows (run_id, video_id, chunk_index, text, Vector 768)"]

    %% RETRIEVAL
    SaveDB --> QueryIn(["Query Arrives (Agent 2 or Scoped Chat)"])
    QueryIn --> ScopeFilter["Apply Filters: research_run_id and/or db_video_ids"]
    ScopeFilter --> ParallelSearch["Run Parallel Searches (candidate_k = max(top_k * 2, 10))"]

    %% DENSE BRANCH
    ParallelSearch --> DenseEmb["Embed Query to 768-dim Vector"]
    DenseEmb --> CosineQuery["pgvector ORDER BY cosine_distance LIMIT candidate_k"]
    CosineQuery --> DenseSim["Compute similarity = 1.0 - distance"]

    %% BM25 BRANCH
    ParallelSearch --> FTSParse["Build English tsvector & websearch_to_tsquery (fallback: plainto_tsquery)"]
    FTSParse --> TSRank["Match @@ Operator & ORDER BY ts_rank_cd DESC LIMIT candidate_k"]

    %% FUSION
    DenseSim --> MergeCheck{"Both Lists Have Hits?"}
    TSRank --> MergeCheck
    MergeCheck -->|"BM25 Empty"| ReturnDense["Return Dense Results [:top_k]"]
    MergeCheck -->|"Dense Empty"| CalibrateBM25["Calibrate BM25 Similarity (0.50..0.85) & Return [:top_k]"]
    MergeCheck -->|"Both Present"| RRFCalc["Compute RRF Score: 1/(60+dense_rank) + 1/(60+bm25_rank)"]

    RRFCalc --> CalibrateHybrid["Calibrate Similarity: max(dense_sim, 0.70*dense_sim + 0.30*norm_rrf)"]
    CalibrateHybrid --> SortTopK["Sort by RRF Score DESC & Return Top-K Chunks"]
    ReturnDense --> Done(["Return Chunks + Timestamps + Similarity Citations"])
    CalibrateBM25 --> Done
    SortTopK --> Done
```

### In-Depth Technical Details

#### Ingestion & pgvector Storage

1. **Transcript Filtering:** Videos without transcripts (`transcript_available=False`) or empty text are skipped cleanly.
2. **Semantic-Aware Chunking (`TextChunker`):** Uses LangChain's `RecursiveCharacterTextSplitter` (`chunk_size=1000`, `chunk_overlap=200`) with separator priority `["\n\n", "\n", " ", ""]` so sentences and paragraphs aren't sliced mid-word.
3. **Dual-Provider 768-dim Embeddings (`DualEmbeddingService`):**
   - **Primary:** OpenAI `text-embedding-3-small` with native dimensionality reduction to **768**, processed in batches of **100**.
   - **Fallback:** Google Gemini `gemini-embedding-001` (`output_dimensionality=768`), processed in batches of **50** if OpenAI fails or is unconfigured.
4. **PostgreSQL Storage (`transcript_chunks`):** Each chunk is stored with `research_run_id`, `video_id`, `chunk_index`, `text`, `language`, `start_time`, `end_time`, and `embedding Vector(768)`, enforced by unique constraint `uq_run_video_chunk` and composite index `ix_transcript_run_video_chunk`.

#### Hybrid Retrieval & Reciprocal Rank Fusion 

1. **Why Hybrid?**
   - **Dense Vector Search** understands paraphrasing and broad concepts.
   - **Sparse Lexical Search (BM25/FTS)** catches exact terms that embeddings often blur (CLI flags, library names, error codes, function names).
2. **Concurrent Candidate Fetching (`candidate_k = max(top_k * 2, 10)`):**
   - `dense_search`: Embeds the query → orders by `TranscriptChunk.embedding.cosine_distance(query_embedding)` → `similarity = 1.0 - distance`.
   - `bm25_search`: Uses PostgreSQL native Full-Text Search `to_tsvector('english', text) @@ websearch_to_tsquery('english', query)` (with automatic fallback to `plainto_tsquery` for tricky punctuation) → ranks by **`ts_rank_cd`** (Cover Density ranking).
   - Both queries are strictly scoped by `research_run_id` and/or `db_video_ids` to prevent cross-run or cross-user leakage.
3. **Reciprocal Rank Fusion (RRF, `k = 60`):**
   - Combines both ranked lists without needing raw score normalization:
     $$\text{RRF\_score}(d) = \frac{1}{60 + \text{dense\_rank}(d)} + \frac{1}{60 + \text{bm25\_rank}(d)}$$
4. **Score Calibration & Zero-Regression Fallbacks:**
   - Downstream filters (e.g., `min_similarity >= 0.40` in Chat) expect a `[0.0, 1.0]` similarity score, so RRF calibrates:
     - **Hybrid / Dense hit:** `max(dense_sim, 0.70 * dense_sim + 0.30 * norm_rrf)`
     - **BM25-only hit:** `0.50 + 0.35 * (1.0 - (bm25_rank - 1) / candidate_k)`
   - If `hybrid_search` fails for any reason, `similarity_search` seamlessly falls back to pure `dense_search`.