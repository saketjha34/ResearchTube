"""
app.routes.sandbox.python — Python sandbox execution and streaming endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
import structlog

from app.core.limiter import limiter
from app.external_services.e2b_sandbox import e2b_sandbox_service
from app.schema.sandbox import (
    ExecutePythonRequest,
    ExecutePythonResponse,
)

logger = structlog.get_logger("sandbox_routes.python")

router = APIRouter()


@router.post(
    "/python/execute",
    response_model=ExecutePythonResponse,
    summary="Execute Python code in isolated sandbox",
)
@router.post(
    "/execute",
    response_model=ExecutePythonResponse,
    include_in_schema=False,
)
@router.post(
    "/execute-python",
    response_model=ExecutePythonResponse,
    include_in_schema=False,
)
@limiter.limit("30/minute")
async def python_execute(
    request: Request,
    payload: ExecutePythonRequest,
) -> ExecutePythonResponse:
    """
    Run arbitrary Python code in an isolated E2B micro-VM sandbox.
    Captures stdout, stderr, errors, return values, generated visual charts,
    and newly created file artifacts (PDFs, CSVs, Excel).
    """
    logger.info("sandbox.python.route_request", code_len=len(payload.code))

    result = await e2b_sandbox_service.execute_python_code(
        code=payload.code,
        timeout_sec=payload.timeout,
    )

    return ExecutePythonResponse(
        success=result.success,
        stdout=result.stdout,
        stderr=result.stderr,
        error=result.error,
        results=result.results,
        images=result.images,
        artifacts=result.artifacts,
        duration_ms=result.duration_ms,
        packages_installed=result.packages_installed,
    )


@router.post(
    "/python/stream",
    summary="Execute Python code with real-time SSE progression stream",
)
@router.post(
    "/stream",
    include_in_schema=False,
)
@router.post(
    "/execute-stream",
    include_in_schema=False,
)
@limiter.limit("30/minute")
async def python_stream(
    request: Request,
    payload: ExecutePythonRequest,
) -> StreamingResponse:
    """
    Run arbitrary Python code in an isolated E2B micro-VM sandbox with real-time SSE streaming.
    Streams continuous progression:
    - `event: status`: Real-time stage updates ("The sandbox is running...")
    - `event: stdout`: Chunks of printed output in real time
    - `event: stderr`: Error output in real time
    - `event: figure`: Base64 chart figures as generated
    - `event: done`: Final structured execution payload
    - `event: error`: Fatal execution error
    """
    logger.info("sandbox.python.route_stream_request", code_len=len(payload.code))
    return StreamingResponse(
        e2b_sandbox_service.execute_python_stream(
            code=payload.code,
            timeout_sec=payload.timeout,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# Backward-compatible function aliases
execute_python = python_execute
execute_python_stream = python_stream
