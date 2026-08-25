from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
# pyrefly: ignore [missing-import]
from slowapi import _rate_limit_exceeded_handler
# pyrefly: ignore [missing-import]
from slowapi.errors import RateLimitExceeded
# pyrefly: ignore [missing-import]
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.init_db import init_db
from app.core.limiter import limiter

from app.routes.auth import router as auth_router
from app.routes.test import router as test_router
from app.routes.youtube_research import router as research_router
from app.routes.user import router as user_router


# ============================================================
# APPLICATION LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    print("Initializing database...")

    await init_db()

    yield


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="YouTube Research API",
    version="1.0.0",
    lifespan=lifespan,
)

# Wire slowapi into the app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# GZip compression — ~70% size reduction for responses > 1KB
# Particularly effective for /youtube/history (40–50KB payloads)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ============================================================
# CORS MIDDLEWARE
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        settings.runtime_frontend_url,
        "http://localhost:5173",
        "http://127.0.0.1:5173",

        "http://localhost:4173",
        "http://127.0.0.1:4173",

        "http://localhost:3000",
        "http://127.0.0.1:3000",

        "http://research-tube-ai.vercel.app",
        "https://research-tube-ai.vercel.app",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# ============================================================
# SESSION MIDDLEWARE
# Required by Authlib for Google OAuth
# ============================================================

app.add_middleware(
    SessionMiddleware,

    secret_key=settings.JWT_SECRET_KEY,

    max_age=600,

    same_site="lax",

    https_only=False,
)


# ============================================================
# ROUTES
# ============================================================

app.include_router(
    auth_router
)

app.include_router(
    test_router
)

app.include_router(
    research_router
)

app.include_router(
    user_router
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message": "YouTube Research API is running"
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy"
    }