# ResearchTube — Frontend Environment Setup

Complete guide to configuring the frontend `.env` file and running the React + Vite app locally or deploying to production.

---

## Table of Contents

- [Quick Start](#quick-start)
- [How Frontend Env Vars Work (Vite)](#how-frontend-env-vars-work-vite)
- [Environment Variables Reference](#environment-variables-reference)
- [Getting Each Value](#getting-each-value)
  - [1. VITE_API_URL_DEV](#1-vite_api_url_dev)
  - [2. VITE_API_URL_PROD](#2-vite_api_url_prod)
- [Running Locally](#running-locally)
- [Production Deployment (Vercel)](#production-deployment-vercel)
- [.env Template](#env-template)

---

## Quick Start

```bash
# 1. Copy the template
cp .env.example .env

# 2. Fill in your values (see guide below)

# 3. Install dependencies
npm install

# 4. Start the dev server
npm run dev
```

The app will be live at **http://localhost:5173**

---

## How Frontend Env Vars Work (Vite)

> Important: In a Vite project, only variables prefixed with `VITE_` are exposed to the browser. Any variable without the `VITE_` prefix is invisible at runtime.

The frontend reads env vars like this:
```ts
import.meta.env.VITE_API_URL_DEV     // local backend
import.meta.env.VITE_API_URL_PROD    // production backend
```

Vite automatically uses the correct file based on environment:

| File | When used |
|---|---|
| `.env` | Always (base, all environments) |
| `.env.local` | Always, overrides `.env` (git-ignored) |
| `.env.development` | Only during `npm run dev` |
| `.env.production` | Only during `npm run build` |

For this project, a single `.env` file is sufficient.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL_DEV` | Required | Backend URL used during local development |
| `VITE_API_URL_PROD` | Required | Backend URL used in the production build |

That is it — the frontend only needs 2 env vars.

The app automatically picks `VITE_API_URL_PROD` when built with `npm run build` and `VITE_API_URL_DEV` in dev mode.

---

## Getting Each Value

### 1. VITE_API_URL_DEV

This is the URL of your **locally running backend** (FastAPI).

If you are running the backend with Docker Compose:
```
http://localhost:8000
```

No signup or setup needed — just make sure the backend container is running:
```bash
# In the backend/ directory
docker compose up --build
```

```env
VITE_API_URL_DEV=http://localhost:8000
```

---

### 2. VITE_API_URL_PROD

This is the URL of your **deployed backend** on Google Cloud Run.

**To find your Cloud Run URL:**
1. Go to https://console.cloud.google.com/run
2. Click on your backend service (e.g. `youtube-research-api`)
3. Copy the URL shown at the top — it looks like:
   ```
   https://your-service-name-xxxxxxxxxx-region.run.app
   ```

```env
VITE_API_URL_PROD=https://your-service-name-xxxxxxxxxx.asia-south2.run.app
```

Do NOT add a trailing slash at the end of the URL — the frontend API client appends paths directly (e.g. `/auth/login`).

---

## Running Locally

### Option 1 — Node.js (Recommended for development)

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev
```

App runs at **http://localhost:5173**

### Option 2 — Docker Compose

```bash
docker compose up --build
```

App runs at **http://localhost:5173**

### Build for production (preview locally)

```bash
npm run build
npm run preview
```

Preview runs at **http://localhost:4173**

---

## Production Deployment (Vercel)

The frontend is a standard Vite + React SPA — deploy with one click on Vercel.

### Steps

1. Go to https://vercel.com and click **Add New Project**
2. Import your GitHub repository
3. Vercel auto-detects Vite — set the root directory to `frontend/` if your repo has both frontend and backend
4. Leave other build settings as default:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Go to **Settings → Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `VITE_API_URL_DEV` | `http://localhost:8000` |
   | `VITE_API_URL_PROD` | `https://your-cloud-run-url.run.app` |

6. Click **Deploy**

Your app will be live at `https://your-project.vercel.app`

---

### After deploying — update backend CORS

Once you have your Vercel URL, go to **backend `.env`** and update:

```env
FRONTEND_URL_PROD=https://your-project.vercel.app
```

Then redeploy the backend on Cloud Run with the new env var.

Also update **Google OAuth Authorized Redirect URIs** in GCP Console:
- `https://your-project.vercel.app/auth/callback`

And update **Google OAuth Authorized JavaScript Origins**:
- `https://your-project.vercel.app`

---

## .env Template

Copy this to `frontend/.env` and fill in your values:

```env
# ============================================================
# BACKEND API URLS
# ============================================================

# Local backend (Docker or direct Python run)
VITE_API_URL_DEV=http://localhost:8000

# Deployed backend (Google Cloud Run URL — no trailing slash)
VITE_API_URL_PROD=https://your-cloud-run-service-xxxxxxxxxx.run.app
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| API requests go to wrong URL | Check `VITE_API_URL_PROD` has no trailing slash |
| `import.meta.env.VITE_*` is undefined | Variable is not prefixed with `VITE_` |
| Changes to `.env` not picked up | Restart `npm run dev` — Vite does not hot-reload `.env` changes |
| CORS error from backend | Add your Vercel URL to `FRONTEND_URL_PROD` in backend and redeploy |
| Google OAuth redirect fails | Add the new frontend URL to Google OAuth authorized redirect URIs in GCP Console |
