from contextlib import asynccontextmanager
import time
import structlog

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.init_db import init_db
from app.core.limiter import limiter
from app.core.logging_config import configure_logging

from app.routes.auth import router as auth_router
from app.routes.test import router as test_router
from app.routes.youtube_research import router as research_router
from app.routes.user import router as user_router
from app.routes.chat import router as chat_router


# ============================================================
# APPLICATION LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    # Configure structured logging before anything else
    configure_logging(environment=settings.ENVIRONMENT)

    logger = structlog.get_logger()
    logger.info("db.init", environment=settings.ENVIRONMENT)

    await init_db()

    logger.info("db.ready")

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
# Particularly effective for /youtube/history (40-50KB payloads)
# NOTE: We skip SSE (text/event-stream) routes because GZip buffers the entire
# response before delivery, which breaks streaming. The custom middleware below
# bypasses GZip for streaming responses.

class SelectiveGZipMiddleware:
    """GZip middleware that skips Server-Sent Event (SSE) responses.
    
    GZipMiddleware buffers the entire response before compressing, which
    completely breaks streaming. We skip compression for any route that
    streams SSE (Content-Type: text/event-stream or paths ending in /stream).
    """
    def __init__(self, app: ASGIApp, minimum_size: int = 1000) -> None:
        self.app = app
        self.gzip_app = GZipMiddleware(app, minimum_size=minimum_size)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            path: str = scope.get("path", "")
            # Skip GZip for streaming endpoints
            if path.endswith("/stream") or path.endswith("/stream/"):
                await self.app(scope, receive, send)
                return
        await self.gzip_app(scope, receive, send)

app.add_middleware(SelectiveGZipMiddleware, minimum_size=1000)


# ============================================================
# CORS MIDDLEWARE
# ============================================================

# Strip trailing slashes from the runtime frontend URL for CORS matching.
# Browsers send the origin WITHOUT a trailing slash, so "https://foo.com/"
# would never match and every request would be rejected.
_frontend_origin = settings.runtime_frontend_url.rstrip("/")

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        _frontend_origin,
        "http://localhost:5173",
        "http://127.0.0.1:5173",

        "http://localhost:4173",
        "http://127.0.0.1:4173",

        "http://localhost:3000",
        "http://127.0.0.1:3000",

        "http://research-tube-ai.vercel.app",
        "https://research-tube-ai.vercel.app",
    ],

    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

    # Expose headers needed by the browser to read SSE responses
    expose_headers=["Content-Type", "X-Accel-Buffering", "Cache-Control"],
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

app.include_router(
    chat_router
)


# ============================================================
# HTTP REQUEST LOGGING MIDDLEWARE
# Logs every request with method, path, status, duration_ms
# ============================================================

_req_logger = structlog.get_logger("http")

@app.middleware("http")
async def log_requests(request: Request, call_next) -> Response:
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 1)

    # Skip noisy health / docs endpoints
    if request.url.path not in ("/health", "/", "/docs", "/openapi.json"):
        _req_logger.info(
            "request.completed",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
        )

    return response


# ROOT
@app.get("/")
def root():

    return {
        "message": "YouTube Research API is running"
    }


# HEALTH CHECK
@app.get("/health")
def health():

    return {
        "status": "healthy"
    }