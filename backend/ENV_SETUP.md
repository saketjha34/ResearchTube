# ResearchTube - Backend Environment Setup

Comprehensive reference guide to obtaining third-party API credentials, configuring local and production environment variables in `.env`, executing database migrations, and running the backend service.

### Related Documentation Links
* [Backend Architecture & API Documentation (README.md)](README.md) - Architectural design, database schemas, LangGraph multi-agent DAG, conversational RAG chat engine, and API routes.
* [Database Migrations Guide (MIGRATIONS.md)](MIGRATIONS.md) - Operational instructions for Alembic migrations, dual workmode execution (`-x env=dev` and `-x env=prod`), and Supabase connection poolers.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Environment Variables Reference](#environment-variables-reference)
- [Obtaining Required & Optional Credentials](#obtaining-required--optional-credentials)
  - [1. Google Gemini API Key (Required)](#1-google-gemini-api-key-required)
  - [2. YouTube Data API v3 Key (Required)](#2-youtube-data-api-v3-key-required)
  - [3. Google OAuth 2.0 Credentials (Required)](#3-google-oauth-20-credentials-required)
  - [4. Database Connection Strings (Required)](#4-database-connection-strings-required)
  - [5. JWT Secret Key (Required)](#5-jwt-secret-key-required)
  - [6. Email / SMTP Credentials (Forgot Password)](#6-email--smtp-credentials-forgot-password)
  - [7. OpenAI API Key (Recommended Primary LLM & Embeddings)](#7-openai-api-key-recommended-primary-llm--embeddings)
  - [8. E2B Sandbox & Firecrawl API Keys (Optional Tools)](#8-e2b-sandbox--firecrawl-api-keys-optional-tools)
  - [9. Proxy Configuration (Production Only)](#9-proxy-configuration-production-only)
- [Running Locally with Docker](#running-locally-with-docker)
- [Production Deployment (Google Cloud Run)](#production-deployment-google-cloud-run)
- [.env.example Configuration Template](#envexample-configuration-template)

---

## Quick Start

```bash
# 1. Copy the configuration template
cp .env.example .env

# 2. Populate your credentials in .env (see step-by-step guides below)
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
| `GEMINI_API_KEY` | **Required** | None | Google AI Studio API key for Gemini models & fallback embeddings |
| `YOUTUBE_API_KEY` | **Required** | None | YouTube Data API v3 key for search queries and video metadata |
| `DATABASE_URL` | **Required** | None | Local Docker PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `ENVIRONMENT` | **Required** | `dev` | Operational mode: `dev` (local Docker) or `prod` (cloud / Supabase) |
| `JWT_SECRET_KEY` | **Required** | None | 256-bit cryptographically secure hex secret for JWT signing |
| `GOOGLE_CLIENT_ID` | **Required** | None | Google Cloud OAuth 2.0 Web Client ID for social authentication |
| `GOOGLE_CLIENT_SECRET` | **Required** | None | Google Cloud OAuth 2.0 Client Secret |
| `PROD_DATABASE_URL` | **Prod only** | None | Remote PostgreSQL pooler URL (Supabase port `6543` or `5432`) |
| `FRONTEND_URL_PROD` | **Prod only** | None | Deployed frontend origin used for CORS & OAuth callbacks |
| `FRONTEND_URL_DEV` | Optional | `http://localhost:5173` | Local development frontend origin |
| `OPENAI_API_KEY` | Recommended | None | OpenAI API key for primary LLM & embeddings (falls back to Gemini) |
| `OPENAI_MODEL` | Optional | `gpt-5.4-mini` | Primary OpenAI chat/reasoning model |
| `GEMINI_MODEL` | Optional | `gemini-3.5-flash` | Google Gemini chat/reasoning model |
| `EMBEDDING_PROVIDER` | Optional | `openai` | Embedding provider preference (`openai` or `gemini`) |
| `OPENAI_EMBEDDING_MODEL` | Optional | `text-embedding-3-small` | OpenAI embedding model name |
| `EMBEDDING_MODEL` | Optional | `gemini-embedding-001` | Google Gemini embedding model name |
| `EMBEDDING_DIMENSION` | Optional | `768` | Dense vector dimension stored in PostgreSQL `pgvector` |
| `JWT_ALGORITHM` | Optional | `HS256` | Token signature cryptographic algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Optional | `1440` | JWT Access Token expiration duration in minutes (24 hours) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Optional | `7` | Sliding Refresh Token expiration window in days |
| `REFRESH_TOKEN_ROTATION_GRACE_PERIOD_SEC` | Optional | `30` | Multi-tab concurrency grace window for rotated refresh tokens |
| `EMAIL_PROVIDER` | Optional | `smtp` | Email delivery backend (`smtp`) |
| `EMAIL_FROM` | Optional | `ResearchTubeAI <...>` | Sender display name and address for password reset emails |
| `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES` | Optional | `15` | Password reset link validity in minutes |
| `SMTP_HOST` | Optional | `smtp.gmail.com` | Outbound SMTP relay hostname |
| `SMTP_PORT` | Optional | `587` | Outbound SMTP port (`587` for STARTTLS) |
| `SMTP_USER` | Optional | None | SMTP login username (e.g., your Gmail address) |
| `SMTP_PASSWORD` | Optional | None | SMTP password or 16-char Gmail App Password |
| `SMTP_USE_TLS` | Optional | `true` | Enable STARTTLS encryption for SMTP |
| `E2B_API_KEY` | Optional | None | E2B cloud micro-VM sandbox key for Python & C++ execution |
| `PYTHON_SANDBOX_TIMEOUT_SEC` | Optional | `60` | Max execution timeout for Python sandbox runs |
| `CPP_SANDBOX_TIMEOUT_SEC` | Optional | `60` | Max execution timeout for C++ sandbox runs |
| `CPP_DEFAULT_COMPILER_FLAGS` | Optional | `-std=c++20 -O2 -Wall -Wextra` | Default `g++` compiler flags in C++ sandbox |
| `FIRECRAWL_API_KEY` | Optional | None | Firecrawl API key for deep web page scraping |
| `FIRECRAWL_BASE_URL` | Optional | `https://api.firecrawl.dev/v1` | Firecrawl API base endpoint |
| `YOUTUBE_PROXY_URL` | Prod only | None | Generic or ScraperAPI proxy URL to prevent cloud IP bans |
| `WEBSHARE_PROXY_USERNAME` | Optional | None | Webshare rotating residential proxy username |
| `WEBSHARE_PROXY_PASSWORD` | Optional | None | Webshare rotating residential proxy password |

---

## Obtaining Required & Optional Credentials

### 1. Google Gemini API Key (Required)

Used for: Multi-agent LLM reasoning (fallback/primary) and Gemini 768-dim text embeddings.

**Steps:**
1. Open Google AI Studio: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **"Create API key"**.
3. Select an existing Google Cloud project or create a new one.
4. Copy the generated key (starts with `AIza`).

```env
GEMINI_API_KEY=AIza...your_key_here
```

> Note: Do not use OAuth access tokens starting with `AQ.` as they expire quickly.

---

### 2. YouTube Data API v3 Key (Required)

Used for: Searching YouTube for video tutorials and fetching views, likes, comments, and channel metadata.

**Steps:**
1. Open Google Cloud Console: [https://console.cloud.google.com](https://console.cloud.google.com)
2. Select or create your project.
3. Go to **APIs & Services -> Library**, search **"YouTube Data API v3"**, and click **Enable**.
4. Go to **APIs & Services -> Credentials** -> **"+ Create Credentials" -> "API Key"**.
5. *(Recommended)* Click **"Restrict Key"** and restrict it to **YouTube Data API v3**.

```env
YOUTUBE_API_KEY=AIza...your_key_here
```

> Default quota: 10,000 units/day (search = 100 units, video details = 1 unit).

---

### 3. Google OAuth 2.0 Credentials (Required)

Used for: "Continue with Google" OAuth 2.0 authentication.

**Steps:**
1. Open [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials).
2. If not configured yet, go to **OAuth Consent Screen**:
   - User Type: **External**, App Name: **ResearchTube**, and add your email under **Test users**.
3. Return to **Credentials** -> **"+ Create Credentials" -> "OAuth 2.0 Client ID"**:
   - Application Type: **Web application**
   - Name: **ResearchTube Backend**
4. Add **Authorized Redirect URIs**:
   ```text
   http://localhost:8000/auth/google/callback
   https://your-backend-domain.com/auth/google/callback
   ```
5. Click **Create** and copy the **Client ID** and **Client Secret**.

```env
GOOGLE_CLIENT_ID=197336418001-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
```

---

### 4. Database Connection Strings (Required)

ResearchTube uses PostgreSQL 16 with `pgvector` for 768-dim embeddings and `tsvector` full-text search. See [MIGRATIONS.md](MIGRATIONS.md) for migration commands.

#### Local Development (Docker PostgreSQL)
```env
ENVIRONMENT=dev
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/youtube_research
```
*(If running FastAPI directly on your host machine outside Docker, replace `@postgres:` with `@localhost:`.)*

#### Production Database (Supabase)
1. Create a project at [https://supabase.com](https://supabase.com) and set a strong database password.
2. In **Database -> Extensions**, enable `vector` (`pgvector`).
3. Click **Connect** (top bar) -> select **Transaction pooler** (port `6543`) or **Session pooler** (port `5432`) and copy the URI:
   ```env
   ENVIRONMENT=prod
   PROD_DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```
   > Important: Always copy the exact pooler shard (`aws-0-...` vs `aws-1-...`) from Supabase **Connect**, and URL-encode special characters in passwords (e.g., `@` → `%40`).

---

### 5. JWT Secret Key (Required)

Used for: Signing and verifying JWT access tokens.

**Steps:**
Run either command in your terminal to generate a 256-bit hex secret:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
# or
openssl rand -hex 32
```

```env
JWT_SECRET_KEY=replace_with_your_64_character_hex_secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7
REFRESH_TOKEN_ROTATION_GRACE_PERIOD_SEC=30
```

---

### 6. Email / SMTP Credentials (Forgot Password)

Used for: Sending password reset link emails (`/auth/forgot-password`).

**Steps (Using Gmail SMTP):**
1. Enable **2-Step Verification** on your Google Account ([https://myaccount.google.com/security](https://myaccount.google.com/security)).
2. Visit **App Passwords** ([https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
3. Create a new App Password named **ResearchTube** and copy the 16-character password (remove spaces).
4. Set `SMTP_USER` to your Gmail address and `SMTP_PASSWORD` to that 16-character App Password.

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM=ResearchTubeAI <you@gmail.com>
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=15
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your_16_char_app_password
SMTP_USE_TLS=true
```

---

### 7. OpenAI API Key (Recommended Primary LLM & Embeddings)

Used for: Primary `DualLLM` (`gpt-5.4-mini`) and `DualEmbeddingService` (`text-embedding-3-small` at 768 dims). Automatically falls back to Gemini if omitted or rate-limited.

**Steps:**
1. Sign in at [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Click **"Create new secret key"**, name it **ResearchTube**, and copy the `sk-proj-...` key.

```env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-5.4-mini
EMBEDDING_PROVIDER=openai
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

---

### 8. E2B Sandbox & Firecrawl API Keys (Optional Tools)

- **E2B Cloud Micro-VM (`E2B_API_KEY`):** Powers isolated Python (charts, PDF/CSV artifacts) and C++ execution in chat & `/sandbox/*`.
  1. Sign up at [https://e2b.dev](https://e2b.dev) and open the **Dashboard → API Keys**.
  2. Create and copy your `e2b_...` key.
- **Firecrawl (`FIRECRAWL_API_KEY`):** Powers deep web page scraping when Live Web Search is enabled in chat.
  1. Sign up at [https://www.firecrawl.dev](https://www.firecrawl.dev) and open **API Keys**.
  2. Copy your `fc-...` key.

```env
E2B_API_KEY=e2b_...
PYTHON_SANDBOX_TIMEOUT_SEC=60
CPP_SANDBOX_TIMEOUT_SEC=60
CPP_DEFAULT_COMPILER_FLAGS=-std=c++20 -O2 -Wall -Wextra

FIRECRAWL_API_KEY=fc-...
FIRECRAWL_BASE_URL=https://api.firecrawl.dev/v1
```

---

### 9. Proxy Configuration (Production Only)

YouTube blocks transcript requests from cloud datacenter IPs (Cloud Run, AWS, Render). Configure one of:
- **Option A — Webshare Rotating Residential (Recommended):** Register at [https://proxy.webshare.io](https://proxy.webshare.io), go to **Proxy → Residential**, and copy your username/password.
- **Option B — Generic HTTP Proxy / ScraperAPI:** Set `YOUTUBE_PROXY_URL`.

```env
WEBSHARE_PROXY_USERNAME=your_residential_username
WEBSHARE_PROXY_PASSWORD=your_residential_password
# or
YOUTUBE_PROXY_URL=http://scraperapi:YOUR_API_KEY@proxy-server.scraperapi.com:8001
```

---

## Running Locally with Docker

```bash
# 1. Build and launch services in background
docker compose up --build -d

# 2. Apply database migrations
docker compose exec api alembic -x env=dev upgrade head

# 3. View real-time container logs
docker compose logs -f api

# 4. Stop containers
docker compose down
```

---

## Production Deployment (Google Cloud Run)

Set these variables under **Edit & Deploy → Variables & Secrets**, and run `alembic -x env=prod upgrade head` before routing traffic:

| Variable | Value |
|---|---|
| `ENVIRONMENT` | `prod` |
| `GEMINI_API_KEY` | Your Google AI Studio key |
| `YOUTUBE_API_KEY` | Your Google Cloud YouTube Data API key |
| `GOOGLE_CLIENT_ID` | Your OAuth 2.0 Web Client ID |
| `GOOGLE_CLIENT_SECRET` | Your OAuth 2.0 Client Secret |
| `PROD_DATABASE_URL` | Your Supabase pooler URL (port `6543` or `5432`) |
| `JWT_SECRET_KEY` | Your 64-character random hex key |
| `FRONTEND_URL_PROD` | Your production frontend URL (e.g. `https://researchtube.vercel.app`) |
| `YOUTUBE_PROXY_URL` / `WEBSHARE_PROXY_*` | Your residential or ScraperAPI proxy credentials |

---

## `.env.example` Configuration Template

This matches [`backend/.env.example`](.env.example) with all compulsory fields and safe defaults pre-filled:

```env
# ============================================================
# 1. REQUIRED API KEYS
# ============================================================
GEMINI_API_KEY=AIzaSy_your_gemini_api_key_here
YOUTUBE_API_KEY=AIzaSy_your_youtube_data_api_v3_key_here

# Optional (Recommended): Primary LLM & embeddings provider (falls back to Gemini if omitted)
OPENAI_API_KEY=sk-proj-your_openai_api_key_here

# ============================================================
# 2. RUNTIME ENVIRONMENT & DATABASE
# ============================================================
# Use 'dev' for local Docker PostgreSQL, or 'prod' for Supabase / hosted PostgreSQL
ENVIRONMENT=dev

# Local Docker PostgreSQL (compulsory for dev)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/youtube_research

# Production Hosted PostgreSQL / Supabase Pooler (required when ENVIRONMENT=prod)
# PROD_DATABASE_URL=postgresql://postgres.<project_ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
PROD_DATABASE_URL=

# ============================================================
# 3. LLM & EMBEDDING MODELS (Pre-filled Defaults)
# ============================================================
OPENAI_MODEL=gpt-5.4-mini
GEMINI_MODEL=gemini-3.5-flash
EMBEDDING_PROVIDER=openai
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSION=768

# ============================================================
# 4. JWT AUTHENTICATION (Compulsory)
# ============================================================
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=replace_with_a_random_64_character_hex_secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7
REFRESH_TOKEN_ROTATION_GRACE_PERIOD_SEC=30

# ============================================================
# 5. GOOGLE OAUTH 2.0 & FRONTEND URLs
# ============================================================
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_google_client_secret
FRONTEND_URL_DEV=http://localhost:5173
# Required when ENVIRONMENT=prod
FRONTEND_URL_PROD=

# ============================================================
# 6. EMAIL / SMTP (Forgot & Reset Password)
# ============================================================
EMAIL_PROVIDER=smtp
EMAIL_FROM=ResearchTubeAI <you@gmail.com>
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=15
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your_16_char_gmail_app_password
SMTP_USE_TLS=true

# ============================================================
# 7. OPTIONAL EXTERNAL SERVICES (Sandbox & Web Scraping)
# ============================================================
# E2B Cloud Micro-VM Sandbox (Python & C++ execution)
E2B_API_KEY=e2b_your_api_key_here
PYTHON_SANDBOX_TIMEOUT_SEC=60
CPP_SANDBOX_TIMEOUT_SEC=60
CPP_DEFAULT_COMPILER_FLAGS=-std=c++20 -O2 -Wall -Wextra

# Firecrawl (Deep web page scraping)
FIRECRAWL_API_KEY=fc-your_api_key_here
FIRECRAWL_BASE_URL=https://api.firecrawl.dev/v1

# ============================================================
# 8. YOUTUBE TRANSCRIPT PROXIES (Production Only)
# ============================================================
# Option A: Webshare Rotating Residential Proxy (Recommended)
WEBSHARE_PROXY_USERNAME=
WEBSHARE_PROXY_PASSWORD=

# Option B: Generic HTTP/HTTPS Proxy or ScraperAPI
YOUTUBE_PROXY_URL=
```
