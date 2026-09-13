"""
app.routes.auth — Authentication routes package.

Assembles the unified auth router from modular sub-routers.
"""

# pyrefly: ignore [missing-import]
import structlog

from fastapi import APIRouter

from app.routes.auth.local_routes import router as local_router
from app.routes.auth.google_routes import router as google_router
from app.routes.auth.profile_routes import router as profile_router


# ============================================================
# UNIFIED AUTH ROUTER
# ============================================================

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

router.include_router(local_router)
router.include_router(google_router)
router.include_router(profile_router)

_logger = structlog.get_logger("auth")
