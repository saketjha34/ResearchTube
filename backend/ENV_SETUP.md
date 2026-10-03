# ResearchTube - Backend Environment Setup

Comprehensive reference guide to obtaining third-party API credentials, configuring local and production environment variables in `.env`, executing database migrations, and running the backend service.

### Related Documentation Links
* [Backend Architecture & API Documentation (README.md)](README.md) - Architectural design, database schemas, LangGraph multi-agent DAG, conversational RAG chat engine, and API routes.
* [Database Migrations Guide (MIGRATIONS.md)](MIGRATIONS.md) - Operational instructions for Alembic migrations, dual workmode execution (`-x env=dev` and `-x env=prod`), and Supabase connection poolers.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Environment Variables Reference](#environment-variables-reference)
- [Obtaining Required Credentials](#obtaining-required-credentials)
  - [1. Google Gemini API Key](#1-google-gemini-api-key)
  - [2. YouTube Data API v3 Key](#2-youtube-data-api-v3-key)
  - [3. Google OAuth 2.0 Credentials](#3-google-oauth-20-credentials)
  - [4. Database Connection Strings](#4-database-connection-strings)
  - [5. JWT Secret Key](#5-jwt-secret-key)
  - [6. Proxy Configuration (Production Only)](#6-proxy-configuration-production-only)
  - [7. Optional Services (OpenAI, Firecrawl, E2B)](#7-optional-services-openai-firecrawl-e2b)
- [Running Locally with Docker](#running-locally-with-docker)
- [Production Deployment (Google Cloud Run)](#production-deployment-google-cloud-run)
- [.env Configuration Template](#env-configuration-template)

---

## Quick Start

```bash
# 1. Copy the configuration template
cp .env.example .env

# 2. Populate your credentials in .env (see details below)
# 3. Start the application stack with Docker Compose
docker compose up --build -d

# 4. Verify database schema and run migrations
docker compose exec api alembic -x env=dev upgrade head
```

* API Server: **http://localhost:8000**
* Interactive Swagger Docs: **http://localhost:8000/docs**
* Health Status Endpoint: **http://localhost:8000/health**

---

## Environment Variables Reference

| Variable | Requirement | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Required | None | Google AI Studio API key for Gemini 3.5 Flash and embeddings |
| `YOUTUBE_API_KEY` | Required | None | YouTube Data API v3 key for search queries and video metadata |
| `DATABASE_URL` | Required | None | Local Docker PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `ENVIRONMENT` | Required | `dev` | Operational mode: `dev` (local Docker) or `prod` (cloud / Supabase) |
| `JWT_SECRET_KEY` | Required | None | 256-bit cryptographically secure secret for JWT signing |
| `GOOGLE_CLIENT_ID` | Required | None | Google Cloud OAuth 2.0 Web Client ID for social authentication |
| `GOOGLE_CLIENT_SECRET` | Required | None | Google Cloud OAuth 2.0 Client Secret |
| `PROD_DATABASE_URL` | Prod only | None | Remote PostgreSQL pooler connection URL (Supabase port 6543) |
| `FRONTEND_URL_PROD` | Prod only | None | Deployed frontend origin used for CORS whitelist enforcement |
| `FRONTEND_URL_DEV` | Optional | `http://localhost:5173` | Local development frontend origin |
| `OPENAI_API_KEY` | Optional | None | OpenAI API key for primary embeddings and model fallback |
| `EMBEDDING_PROVIDER` | Optional | `openai` | Embedding service provider: `openai` or `gemini` |
| `OPENAI_EMBEDDING_MODEL` | Optional | `text-embedding-3-small` | OpenAI embedding model name |
| `EMBEDDING_MODEL` | Optional | `gemini-embedding-001` | Google Gemini embedding model name |
| `EMBEDDING_DIMENSION` | Optional | `768` | Dense vector dimension stored in PostgreSQL pgvector |
| `JWT_ALGORITHM` | Optional | `HS256` | Token signature cryptographic algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Optional | `1440` | JWT Access Token expiration duration in minutes |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Optional | `7` | Sliding Refresh Token expiration window in days (7 to 10) |
| `YOUTUBE_PROXY_URL` | Prod only | None | Generic or ScraperAPI proxy URL to prevent cloud IP bans |
| `WEBSHARE_PROXY_USERNAME` | Optional | None | Webshare rotating residential proxy username |
| `WEBSHARE_PROXY_PASSWORD` | Optional | None | Webshare rotating residential proxy password |
| `FIRECRAWL_API_KEY` | Optional | None | Firecrawl API key for deep web documentation scraping |
| `E2B_API_KEY` | Optional | None | E2B cloud sandbox API key for Python and C++ code execution |

---

## Obtaining Required Credentials

### 1. Google Gemini API Key

Used for: Multi-agent LLM reasoning (Query Planner, RAG Evaluator, Report Synthesizer) and Gemini text embeddings.

**Procedure:**
1. Navigate to the Google AI Studio console: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Select **"Create API key"**.
3. Link an existing Google Cloud project or create a new dedicated project.
4. Copy the generated API key. Keys always begin with the `AIza` prefix.

```env
GEMINI_API_KEY=AIza...your_key_here
```

Note: Do not use service account tokens starting with `AQ.` as they are OAuth access tokens with short expiration windows.

---

### 2. YouTube Data API v3 Key

Used for: Searching YouTube for video tutorials, extracting view counts, like counts, and channel metadata.

**Procedure:**
1. Navigate to the Google Cloud Console: [https://console.cloud.google.com](https://console.cloud.google.com)
2. Select or create your Google Cloud project.
3. Open **APIs & Services -> Library**.
4. Search for **"YouTube Data API v3"** and click **Enable**.
5. Navigate to **APIs & Services -> Credentials**.
6. Click **"+ Create Credentials" -> "API Key"**.
7. (Recommended) Click **"Restrict Key"** and restrict usage specifically to the YouTube Data API v3.

```env
YOUTUBE_API_KEY=AIza...your_key_here
```

Default quota allocation: 10,000 units per day. Search operations consume 100 units; video metadata lookups consume 1 unit.

---

### 3. Google OAuth 2.0 Credentials

Used for: User authentication via "Sign in with Google" OAuth 2.0 flow.

**Procedure:**
1. Open the Google Cloud Console Credentials page: [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Click **"+ Create Credentials" -> "OAuth 2.0 Client ID"**.
3. If not previously configured, complete the **OAuth Consent Screen**:
   - User Type: **External**
   - Application Name: **ResearchTube**
   - Add your developer email address under test users.
4. Return to the Credentials creation tab:
   - Application Type: **Web application**
   - Name: **ResearchTube Backend Gateway**
5. Configure **Authorized Redirect URIs**:
   ```
   http://localhost:8000/auth/google/callback
   https://your-backend-domain.com/auth/google/callback
   ```
6. Click **Create** and record both the **Client ID** and **Client Secret**.

```env
GOOGLE_CLIENT_ID=197336418001-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
```

---

### 4. Database Connection Strings

ResearchTube utilizes PostgreSQL with the `pgvector` extension for storing 768-dimensional dense vector embeddings alongside `tsvector` full-text lexical search indices.

For schema migrations, refer to the [Database Migrations Guide (MIGRATIONS.md)](MIGRATIONS.md).

#### Local Development (Docker PostgreSQL)
When developing locally with Docker Compose, PostgreSQL is automatically launched and managed:

```env
ENVIRONMENT=dev
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/youtube_research
```

Note: If running the FastAPI application outside Docker on your host machine while PostgreSQL runs in Docker, configure `DATABASE_URL` to point to `localhost:5432`:
```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/youtube_research
```

#### Production Database (Supabase / Hosted PostgreSQL)
1. Register a PostgreSQL project at [https://supabase.com](https://supabase.com).
2. Set a secure database master password.
3. Open **Database -> Extensions**, search for `vector`, and enable the `pgvector` extension.
4. Navigate to **Project Settings -> Database** and locate the **Connection Pooling** configuration.
5. Use the Transaction Mode pooler on port `6543`:
   ```
   postgresql://postgres.[project-ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
6. Assign this URL to `PROD_DATABASE_URL` and configure `ENVIRONMENT=prod`:

```env
ENVIRONMENT=prod
PROD_DATABASE_URL=postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

Important: If your database password includes special characters (such as `@`, `#`, or `/`), they must be URL-encoded (e.g., `@` becomes `%40`).

---

### 5. JWT Secret Key

Used for: Cryptographic signing and validation of JSON Web Tokens (access tokens and sliding refresh tokens).

**Generate a high-entropy 256-bit hexadecimal string:**

```bash
# Using Python
python -c "import secrets; print(secrets.token_hex(32))"

# Using OpenSSL
openssl rand -hex 32
```

```env
JWT_SECRET_KEY=9f83b2a1c0d4e5f6...your_64_character_hex_string
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7
```

Warning: Never commit this secret to version control. If this key is rotated or replaced, all currently active user sessions will be invalidated.

---

### 6. Proxy Configuration (Production Only)

Used for: Preventing IP-based request throttling from YouTube when running in cloud environments (such as Google Cloud Run, AWS ECS, or Render).

YouTube automatically blocks transcript requests originating from major cloud hosting IP ranges. A residential or rotating proxy routes outbound HTTP traffic through non-datacenter IP addresses.

#### Option A: Webshare Rotating Residential (Recommended)
1. Register at [https://proxy.webshare.io](https://proxy.webshare.io).
2. Generate API credentials under **Proxy -> Residential**.
3. Populate credentials in `.env`:

```env
WEBSHARE_PROXY_USERNAME=your_residential_username
WEBSHARE_PROXY_PASSWORD=your_residential_password
```

#### Option B: Generic HTTP Proxy or ScraperAPI
Configure the proxy endpoint URL directly:

```env
# ScraperAPI
YOUTUBE_PROXY_URL=http://scraperapi:YOUR_API_KEY@proxy-server.scraperapi.com:8001

# Custom Authenticated HTTP/HTTPS Proxy
YOUTUBE_PROXY_URL=http://username:password@proxy.example.com:8080
```

Priority resolution: The scraper subsystem evaluates `WEBSHARE_PROXY_USERNAME` first, then falls back to `YOUTUBE_PROXY_URL`, and finally connects directly if neither is present (standard behavior for local development).

---

### 7. Optional Services (OpenAI, Firecrawl, E2B)

* **OpenAI API Key (`OPENAI_API_KEY`):** Provides access to `text-embedding-3-small` for the `DualEmbeddingService` and GPT-4o-mini as an alternate LLM provider.
* **Firecrawl API Key (`FIRECRAWL_API_KEY`):** Enables the deep documentation crawler tool to extract engineering tutorials and reference pages.
* **E2B API Key (`E2B_API_KEY`):** Powers the secure sandboxed Python and C++ code interpreter environments.

```env
OPENAI_API_KEY=sk-proj-...
FIRECRAWL_API_KEY=fc-...
E2B_API_KEY=e2b_...
```

---

## Running Locally with Docker

```bash
# 1. Ensure Docker Desktop is installed and running
# 2. Build and launch services in background
docker compose up --build -d

# 3. Apply database migrations
docker compose exec api alembic -x env=dev upgrade head

# 4. View real-time container log output
docker compose logs -f api

# 5. Stop running containers
docker compose down

# 6. Stop and wipe persistent PostgreSQL volume
docker compose down -v
```

Containers initialized:
* `youtube_research_api`: FastAPI application server exposed on port **8000**
* `youtube_research_postgres`: PostgreSQL 16 database with pgvector exposed on port **5432**

---

## Production Deployment (Google Cloud Run)

When deploying the backend container to Google Cloud Run, set the following environment variables under **Edit & Deploy -> Variables & Secrets**:

| Variable | Value |
|---|---|
| `ENVIRONMENT` | `prod` |
| `GEMINI_API_KEY` | Your Google AI Studio key |
| `YOUTUBE_API_KEY` | Your Google Cloud YouTube Data API key |
| `GOOGLE_CLIENT_ID` | Your OAuth 2.0 Web Client ID |
| `GOOGLE_CLIENT_SECRET` | Your OAuth 2.0 Client Secret |
| `PROD_DATABASE_URL` | Your Supabase connection pooler URL (port 6543) |
| `JWT_SECRET_KEY` | Your 64-character random hexadecimal key |
| `FRONTEND_URL_PROD` | Your production frontend URL (e.g. `https://researchtube.vercel.app`) |
| `YOUTUBE_PROXY_URL` | Your residential or ScraperAPI proxy endpoint |

Before traffic redirection, execute production migrations against `PROD_DATABASE_URL`:
```bash
alembic -x env=prod upgrade head
```

---

## .env Configuration Template

Copy the block below into `backend/.env` and replace the placeholder values:

```env
# ============================================================
# API KEYS
# ============================================================

GEMINI_API_KEY=AIzaSy...your_gemini_key_here
YOUTUBE_API_KEY=AIzaSy...your_youtube_key_here

# Optional: Enables OpenAI text-embedding-3-small and GPT models
# OPENAI_API_KEY=sk-proj-...

# Optional: Deep documentation search and code sandbox execution
# FIRECRAWL_API_KEY=fc-...
# E2B_API_KEY=e2b_...


# ============================================================
# ENVIRONMENT
# ============================================================

# Use 'dev' for local Docker development; 'prod' for cloud deployment
ENVIRONMENT=dev


# ============================================================
# DATABASE
# ============================================================

# Local Docker PostgreSQL container (used when ENVIRONMENT=dev)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/youtube_research

# Hosted PostgreSQL / Supabase pooler (used when ENVIRONMENT=prod)
# PROD_DATABASE_URL=postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres


# ============================================================
# RAG / EMBEDDINGS
# ============================================================

EMBEDDING_PROVIDER=openai
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSION=768


# ============================================================
# JWT AUTHENTICATION
# ============================================================

# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=replace_with_your_64_character_hexadecimal_secret_string

JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7


# ============================================================
# GOOGLE OAUTH
# ============================================================

GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_google_client_secret

FRONTEND_URL_DEV=http://localhost:5173
# FRONTEND_URL_PROD=https://your-production-domain.com


# ============================================================
# PROXY CONFIGURATION (Production only)
# ============================================================

# Option A: Webshare rotating residential proxy
# WEBSHARE_PROXY_USERNAME=your_webshare_username
# WEBSHARE_PROXY_PASSWORD=your_webshare_password

# Option B: Generic HTTP/HTTPS proxy or ScraperAPI
# YOUTUBE_PROXY_URL=http://scraperapi:YOUR_API_KEY@proxy-server.scraperapi.com:8001
```
