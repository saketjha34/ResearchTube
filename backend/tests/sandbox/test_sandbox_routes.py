"""
Unit tests for FastAPI sandbox routes (app.routes.sandbox) - Python & C++.
"""

from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from app.external_services.e2b_sandbox import (
    CPPSandboxExecutionResult,
    SandboxExecutionResult,
)
from app.main import app

client = TestClient(app, raise_server_exceptions=False)



def test_post_sandbox_execute_route():
    """Verify POST /sandbox/execute and /sandbox/python/execute execute code and return structured payload."""
    mock_res = SandboxExecutionResult(
        success=True,
        stdout="computed result = 100\n",
        duration_ms=45.2,
    )

    with patch(
        "app.routes.sandbox.e2b_sandbox_service.execute_python_code",
        new_callable=AsyncMock,
        return_value=mock_res,
    ):
        for path in ["/sandbox/execute", "/sandbox/python/execute", "/sandbox/execute-python"]:
            response = client.post(
                path,
                json={"code": "x = 10; print(f'computed result = {x**2}')", "timeout": 30},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "computed result = 100" in data["stdout"]
            assert data["duration_ms"] == 45.2


def test_post_cpp_execute_route_success():
    """Verify POST /sandbox/cpp/execute and alias /sandbox/execute-cpp execute C++ code."""
    mock_res = CPPSandboxExecutionResult(
        success=True,
        stdout="Hello C++20\n",
        compile_time_ms=105.0,
        execution_time_ms=12.0,
        duration_ms=117.0,
        exit_code=0,
    )

    with patch(
        "app.routes.sandbox.e2b_sandbox_service.execute_cpp_code",
        new_callable=AsyncMock,
        return_value=mock_res,
    ) as mock_exec:
        for path in ["/sandbox/cpp/execute", "/sandbox/execute-cpp"]:
            response = client.post(
                path,
                json={
                    "code": "#include <iostream>\nint main() { std::cout << \"Hello C++20\\n\"; }",
                    "stdin": "123",
                    "compiler_flags": "-std=c++20 -O2",
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "Hello C++20" in data["stdout"]
            assert data["exit_code"] == 0
            assert data["compile_time_ms"] == 105.0


def test_post_cpp_execute_route_compilation_error():
    """Verify POST /sandbox/cpp/execute correctly returns compilation diagnostics."""
    mock_res = CPPSandboxExecutionResult(
        success=False,
        error="Compilation Error",
        compile_output="main.cpp:2:1: error: expected unqualified-id",
        exit_code=1,
    )

    with patch(
        "app.routes.sandbox.e2b_sandbox_service.execute_cpp_code",
        new_callable=AsyncMock,
        return_value=mock_res,
    ):
        response = client.post(
            "/sandbox/cpp/execute",
            json={"code": "bad cpp code"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["error"] == "Compilation Error"
        assert "expected unqualified-id" in data["compile_output"]
        assert data["exit_code"] == 1


def test_post_cpp_stream_route():
    """Verify POST /sandbox/cpp/stream streams SSE events."""
    async def mock_stream_gen(*args, **kwargs):
        yield 'event: status\ndata: {"step": "booting", "message": "Booting VM..."}\n\n'
        yield 'event: stdout\ndata: {"text": "streamed output\\n"}\n\n'
        yield 'event: done\ndata: {"success": true, "stdout": "streamed output\\n"}\n\n'

    with patch(
        "app.routes.sandbox.e2b_sandbox_service.execute_cpp_stream",
        side_effect=mock_stream_gen,
    ):
        response = client.post(
            "/sandbox/cpp/stream",
            json={"code": 'int main() {}'},
        )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        body = response.text
        assert "event: status" in body
        assert "event: stdout" in body
        assert "streamed output" in body
        assert "event: done" in body


def test_post_python_stream_route():
    """Verify POST /sandbox/python/stream streams Python SSE events."""
    async def mock_py_stream(*args, **kwargs):
        yield 'event: status\ndata: {"step": "executing", "message": "Running code..."}\n\n'
        yield 'event: stdout\ndata: {"text": "hello python stream\\n"}\n\n'
        yield 'event: done\ndata: {"success": true, "stdout": "hello python stream\\n"}\n\n'

    with patch(
        "app.routes.sandbox.e2b_sandbox_service.execute_python_stream",
        side_effect=mock_py_stream,
    ):
        for path in ["/sandbox/stream", "/sandbox/python/stream"]:
            response = client.post(
                path,
                json={"code": 'print("hello python stream")'},
            )
            assert response.status_code == 200
            assert "text/event-stream" in response.headers["content-type"]
            body = response.text
            assert "hello python stream" in body
            assert "event: done" in body


