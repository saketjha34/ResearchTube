"""
app.routes.sandbox — Dedicated Sandbox & Code Interpreter Router Package.

Decomposed into dedicated sub-route modules:
- app.routes.sandbox.python: Python execution and SSE streaming endpoints
- app.routes.sandbox.cpp: C++20 compilation, execution, and SSE streaming endpoints
"""

from __future__ import annotations

from fastapi import APIRouter

from app.external_services.e2b_sandbox import e2b_sandbox_service

from app.routes.sandbox.python import (
    router as python_router,
    python_execute,
    python_stream,
    execute_python,
    execute_python_stream,
)
from app.routes.sandbox.cpp import (
    router as cpp_router,
    cpp_execute,
    cpp_stream,
    execute_cpp,
    execute_cpp_stream,
)

router = APIRouter(
    prefix="/sandbox",
    tags=["Sandbox"],
)

router.include_router(python_router)
router.include_router(cpp_router)

__all__ = [
    "router",
    "python_router",
    "cpp_router",
    "e2b_sandbox_service",
    "python_execute",
    "python_stream",
    "execute_python",
    "execute_python_stream",
    "cpp_execute",
    "cpp_stream",
    "execute_cpp",
    "execute_cpp_stream",
]
