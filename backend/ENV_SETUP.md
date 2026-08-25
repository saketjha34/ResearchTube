# ResearchTube — Backend Environment Setup

Complete guide to getting all API keys, configuring the `.env` file, and running the backend locally or on production.

## Table of Contents

- [Quick Start](#quick-start)
- [Environment Variables Reference](#environment-variables-reference)
- [Getting Each API Key](#getting-each-api-key)
  - [1. Google Gemini API Key](#1-google-gemini-api-key)
  - [2. YouTube Data API v3 Key](#2-youtube-data-api-v3-key)
  - [3. Google OAuth (Client ID + Secret)](#3-google-oauth-client-id--secret)
  - [4. Database URLs](#4-database-urls)
  - [5. JWT Secret Key](#5-jwt-secret-key)
  - [6. Proxy (Production Only)](#6-proxy-production-only)
- [Running Locally with Docker](#running-locally-with-docker)
- [Production (Google Cloud Run)](#production-google-cloud-run)
- [.env Template](#env-template)

## Quick Start

```bash
# 1. Copy the template
cp .env.example .env

# 2. Fill in your keys (see guide below)
# 3. Start the stack
docker compose up --build
```

The API will be live at **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Required | Google Gemini LLM + Embedding API key |
| `YOUTUBE_API_KEY` | ✅ Required | YouTube Data API v3 key (search + video metadata) |
| `DATABASE_URL` | ✅ Required | Local Docker PostgreSQL connection string |
| `ENVIRONMENT` | ✅ Required | `dev` (local Docker) or `prod` (Cloud Run + Supabase) |
| `JWT_SECRET_KEY` | ✅ Required | Secret for signing JWT tokens (any long random string) |
| `GOOGLE_CLIENT_ID` | ✅ Required | Google OAuth 2.0 client ID (for "Sign in with Google") |
| `GOOGLE_CLIENT_SECRET` | ✅ Required | Google OAuth 2.0 client secret |
| `PROD_DATABASE_URL` | ⚠️ Prod only | Supabase / hosted PostgreSQL URL |
| `FRONTEND_URL_PROD` | ⚠️ Prod only | Deployed frontend URL (for CORS) |
| `YOUTUBE_PROXY_URL` | ⚠️ Prod only | Proxy to bypass GCP IP blocks on YouTube transcript API |
| `WEBSHARE_PROXY_USERNAME` | ⚠️ Alt proxy | Webshare rotating residential proxy username |
| `WEBSHARE_PROXY_PASSWORD` | ⚠️ Alt proxy | Webshare rotating residential proxy password |
| `OPENAI_API_KEY` | ❌ Optional | Not currently used (reserved for future) |
| `EMBEDDING_MODEL` | ❌ Optional | Defaults to `gemini-embedding-001` |
| `JWT_ALGORITHM` | ❌ Optional | Defaults to `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | ❌ Optional | Defaults to `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | ❌ Optional | Defaults to `30` |
| `FRONTEND_URL_DEV` | ❌ Optional | Defaults to `http://localhost:5173` |

## Getting Each API Key

### 1. Google Gemini API Key

Used for: LLM inference (Agent 1, 2, 3) + text embeddings (RAG)

**Steps:**
1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **"Create API key"**
3. Select an existing Google Cloud project or create a new one
4. Copy the generated key

**Free tier:** 15 RPM / 1M tokens per day on `gemini-1.5-flash` — sufficient for personal use.

```env
GEMINI_API_KEY=AIza...your_key_here
```

> ⚠️ Do **not** use a key starting with `AQ.` — those are OAuth tokens, not API keys. API keys always start with `AIza`.

### 2. YouTube Data API v3 Key

Used for: Searching YouTube, fetching video metadata (title, views, likes, description)

**Steps:**
1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Select your project (or create one)
3. Navigate to **APIs & Services → Library**
4. Search for **"YouTube Data API v3"** → Enable it
5. Go to **APIs & Services → Credentials**
6. Click **"+ Create Credentials" → "API Key"**
7. (Recommended) Click **"Restrict Key"** → restrict to YouTube Data API v3

**Free quota:** 10,000 units/day. Each search costs 100 units, each video detail lookup costs 1 unit.

```env
YOUTUBE_API_KEY=AIza...your_key_here
```

### 3. Google OAuth (Client ID + Secret)

Used for: "Sign in with Google" OAuth 2.0 flow

**Steps:**
1. Go to [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Click **"+ Create Credentials" → "OAuth 2.0 Client ID"**
3. If prompted, configure the **OAuth Consent Screen** first:
   - User Type: **External**
   - App name: ResearchTube
   - Add your email as a test user
4. Back in credentials, create the OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Name: ResearchTube Backend
5. Add **Authorized Redirect URIs:**
   ```
   http://localhost:8000/auth/google/callback        ← local dev
   https://your-cloud-run-url.run.app/auth/google/callback   ← production
   ```
6. Click **Create** → copy the **Client ID** and **Client Secret**

```env
GOOGLE_CLIENT_ID=197336418001-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
```

### 4. Database URLs

#### Local Development (Docker)

The local database runs automatically via `docker compose`. No signup needed.

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/youtube_research
ENVIRONMENT=dev
```

The `postgres` hostname refers to the Docker service name in `docker-compose.yaml`.

#### Production (Supabase — free hosted PostgreSQL + pgvector)

1. Go to [https://supabase.com](https://supabase.com) → **New Project**
2. Set a **database password** (save it!)
3. Go to **Project Settings → Database**
4. Copy the **Connection String** (URI format):
   ```
   postgresql://postgres:[YOUR_PASSWORD]@db.xxxx.supabase.co:5432/postgres
   ```
5. Enable **pgvector** extension:
   - Go to **Database → Extensions**
   - Search for `vector` → Enable it

```env
PROD_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxx.supabase.co:5432/postgres
ENVIRONMENT=prod
```

> 🔑 URL-encode special characters in your password. For example `@` becomes `%40`, `#` becomes `%23`.

### 5. JWT Secret Key

Used for: Signing and verifying JWT access/refresh tokens

**Generate a secure random key:**

```bash
# Option 1: Python
python -c "import secrets; print(secrets.token_hex(32))"

# Option 2: OpenSSL
openssl rand -hex 32

# Option 3: Just use any long random string (32+ chars)
```

```env
JWT_SECRET_KEY=a1b2c3d4e5f6...your_64_char_hex_string
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
```

> ⚠️ Never share or commit this key. If compromised, all active sessions are invalidated when you rotate it.

### 6. Proxy (Production Only)

Used for: Bypassing YouTube's IP block on GCP Cloud Run when fetching video transcripts.

YouTube blocks all requests from known cloud provider IPs (GCP, AWS, Azure). A proxy routes the request through a residential or datacenter IP.

#### Option A — ScraperAPI (Free: 1,000 credits/month)

1. Sign up at [https://www.scraperapi.com](https://www.scraperapi.com)
2. Copy your **API Key** from the dashboard
3. Set:

```env
YOUTUBE_PROXY_URL=http://scraperapi:YOUR_API_KEY@proxy-server.scraperapi.com:8001
```

#### Option B — Webshare Free (10 datacenter proxies)

1. Sign up at [https://proxy.webshare.io](https://proxy.webshare.io)
2. Go to **Free → Proxy List** → note any Working proxy's address, port, username, password
3. Set:

```env
YOUTUBE_PROXY_URL=http://USERNAME:PASSWORD@PROXY_ADDRESS:PORT
```

#### Option C — Webshare Rotating Residential (paid, most reliable)

1. Sign up at [https://proxy.webshare.io](https://proxy.webshare.io)
2. Purchase **Rotating Residential** plan
3. Go to **API → Keys** to get your proxy credentials
4. Set:

```env
WEBSHARE_PROXY_USERNAME=your_api_username
WEBSHARE_PROXY_PASSWORD=your_api_password
```

> ℹ️ The backend checks `WEBSHARE_PROXY_USERNAME` first, then `YOUTUBE_PROXY_URL`, then falls back to no proxy (fine for local dev).

## Running Locally with Docker

```bash
# 1. Make sure Docker Desktop is running
# 2. Create and fill your .env (see template below)
# 3. Build and start
docker compose up --build

# Stop
docker compose down

# Stop and wipe database
docker compose down -v
```

**What starts:**
- `youtube_research_api` — FastAPI on port **8000**
- `youtube_research_postgres` — PostgreSQL 16 + pgvector on port **5432**

The database schema is created automatically on first startup via SQLAlchemy.

## Production (Google Cloud Run)

Set all required env vars in Cloud Run → **Edit & Deploy → Variables & Secrets**:

| Variable | Value |
|---|---|
| `ENVIRONMENT` | `prod` |
| `GEMINI_API_KEY` | Your Gemini key |
| `YOUTUBE_API_KEY` | Your YouTube Data API key |
| `GOOGLE_CLIENT_ID` | Your OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Your OAuth client secret |
| `PROD_DATABASE_URL` | Your Supabase connection URL |
| `JWT_SECRET_KEY` | Your generated secret |
| `FRONTEND_URL_PROD` | Your deployed frontend URL |
| `YOUTUBE_PROXY_URL` | Your proxy URL (ScraperAPI recommended) |

## .env Template

Copy this to `backend/.env` and fill in your values:

```env
# ============================================================
# API KEYS
# ============================================================

GEMINI_API_KEY=AIza...

YOUTUBE_API_KEY=AIza...

# Optional — not used yet
# OPENAI_API_KEY=sk-...


# ============================================================
# ENVIRONMENT
# ============================================================

# 'dev' = local Docker | 'prod' = Cloud Run + Supabase
ENVIRONMENT=dev


# ============================================================
# DATABASE
# ============================================================

# Local Docker PostgreSQL (used when ENVIRONMENT=dev)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/youtube_research

# Hosted Supabase PostgreSQL (used when ENVIRONMENT=prod)
# PROD_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxx.supabase.co:5432/postgres


# ============================================================
# RAG / EMBEDDINGS
# ============================================================

EMBEDDING_MODEL=gemini-embedding-001


# ============================================================
# JWT AUTH
# ============================================================

# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=your_random_64_char_hex_string_here

JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30


# ============================================================
# GOOGLE OAUTH
# ============================================================

GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx

# Dev frontend (default, no need to change for local dev)
FRONTEND_URL_DEV=http://localhost:5173

# Production frontend
# FRONTEND_URL_PROD=https://your-app.vercel.app


# ============================================================
# PROXY (Production only — bypasses YouTube GCP IP block)
# ============================================================

# Option A: ScraperAPI (recommended, 1000 free req/month)
# YOUTUBE_PROXY_URL=http://scraperapi:YOUR_API_KEY@proxy-server.scraperapi.com:8001

# Option B: Any generic proxy
# YOUTUBE_PROXY_URL=http://username:password@proxy.host:port

# Option C: Webshare rotating residential
# WEBSHARE_PROXY_USERNAME=your_webshare_api_username
# WEBSHARE_PROXY_PASSWORD=your_webshare_api_password
```
