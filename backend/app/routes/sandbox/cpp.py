"""
app.routes.sandbox.cpp — C++ sandbox compilation, execution, and streaming endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
import structlog

from app.core.limiter import limiter
from app.external_services.e2b_sandbox import e2b_sandbox_service
from app.schema.sandbox import (
    ExecuteCPPRequest,
    ExecuteCPPResponse,
)

logger = structlog.get_logger("sandbox_routes.cpp")

router = APIRouter()


@router.post(
    "/cpp/execute",
    response_model=ExecuteCPPResponse,
    summary="Compile & execute C++ code in isolated sandbox",
)
@router.post(
    "/execute-cpp",
    response_model=ExecuteCPPResponse,
    include_in_schema=False,
)
@limiter.limit("30/minute")
async def cpp_execute(
    request: Request,
    payload: ExecuteCPPRequest,
) -> ExecuteCPPResponse:
    """
    Compile and execute arbitrary C++ code in an isolated E2B micro-VM sandbox.
    Compiles with g++ (C++20 by default), captures compiler warnings/errors,
    runs the binary with optional stdin, collects stdout/stderr, and generated artifacts.
    """
    logger.info("sandbox.cpp.route_request", code_len=len(payload.code))

    result = await e2b_sandbox_service.execute_cpp_code(
        code=payload.code,
        timeout_sec=payload.timeout,
        compiler_flags=payload.compiler_flags,
        stdin=payload.stdin,
    )

    return ExecuteCPPResponse(
        success=result.success,
        stdout=result.stdout,
        stderr=result.stderr,
        error=result.error,
        compile_output=result.compile_output,
        compile_time_ms=result.compile_time_ms,
        execution_time_ms=result.execution_time_ms,
        duration_ms=result.duration_ms,
        exit_code=result.exit_code,
        artifacts=result.artifacts,
    )


@router.post(
    "/cpp/stream",
    summary="Compile & execute C++ code with real-time SSE progression stream",
)
@router.post(
    "/stream-cpp",
    include_in_schema=False,
)
@limiter.limit("30/minute")
async def cpp_stream(
    request: Request,
    payload: ExecuteCPPRequest,
) -> StreamingResponse:
    """
    Compile and execute C++ code in an isolated E2B micro-VM sandbox with real-time SSE streaming.
    Streams continuous progression:
    - `event: status`: Real-time stage updates ("The sandbox is running: Booting micro-VM...", "The sandbox is running: Compiling C++20 with g++...", "The sandbox is running: Executing binary ./main...")
    - `event: stdout`: Chunks of printed output in real time
    - `event: stderr`: Error output in real time
    - `event: done`: Final structured execution payload
    - `event: error`: Fatal execution error
    """
    logger.info("sandbox.cpp.route_stream_request", code_len=len(payload.code))
    return StreamingResponse(
        e2b_sandbox_service.execute_cpp_stream(
            code=payload.code,
            timeout_sec=payload.timeout,
            compiler_flags=payload.compiler_flags,
            stdin=payload.stdin,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# Backward-compatible function aliases
execute_cpp = cpp_execute
execute_cpp_stream = cpp_stream
