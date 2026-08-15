from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import settings
from app.core.init_db import init_db

from app.routes.auth import router as auth_router
from app.routes.test import router as test_router

@asynccontextmanager
async def lifespan(app: FastAPI):

    print("Initializing database...")

    init_db()

    yield


app = FastAPI(
    title="YouTube Research API",
    version="1.0.0",
    lifespan=lifespan
)


# ============================================================
# CORS MIDDLEWARE
# Allows frontend preflight requests from local dev servers
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
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
    https_only=False
)


# ============================================================
# ROUTES
# ============================================================

app.include_router(
    auth_router
)
app.include_router(test_router)


@app.get("/")
def root():

    return {
        "message": "YouTube Research API is running"
    }


@app.get("/health")
def health():

    return {
        "status": "healthy"
    }