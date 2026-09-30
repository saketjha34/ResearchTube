"""
Unit tests for the C++ sandbox LangChain tool (app.tools.cpp_sandbox).
"""

import asyncio
from unittest.mock import AsyncMock, patch
import pytest

from app.external_services.e2b_sandbox import CPPSandboxExecutionResult
from app.schema.sandbox import SandboxArtifact
from app.tools.cpp_sandbox import (
    execute_cpp_code,
    execute_cpp_code_async,
    format_cpp_sandbox_result_for_llm,
)


def test_format_cpp_sandbox_result_empty():
    """Verify empty/zero output formatting for successful exit."""
    res = CPPSandboxExecutionResult(success=True, duration_ms=25.0)
    formatted = format_cpp_sandbox_result_for_llm(res)
    assert "[C++ code compiled and executed successfully with exit code 0" in formatted
    assert "25.0ms" in formatted


def test_format_cpp_sandbox_result_with_outputs():
    """Verify stdout, stderr, compile output and metrics are formatted cleanly."""
    res = CPPSandboxExecutionResult(
        success=True,
        stdout="Hello World\n42\n",
        stderr="Note: optimization enabled\n",
        compile_output="main.cpp: warning: unused variable",
        compile_time_ms=120.5,
        execution_time_ms=15.2,
        duration_ms=135.7,
        exit_code=0,
    )
    formatted = format_cpp_sandbox_result_for_llm(res)
    assert "[COMPILER OUTPUT (120.5ms)]" in formatted
    assert "unused variable" in formatted
    assert "[STDOUT (15.2ms)]" in formatted
    assert "Hello World" in formatted
    assert "[STDERR]" in formatted
    assert "Note: optimization enabled" in formatted


def test_format_cpp_sandbox_result_compilation_error():
    """Verify compiler diagnostics and error messages are emphasized."""
    res = CPPSandboxExecutionResult(
        success=False,
        error="Compilation Error",
        compile_output="main.cpp:5:1: error: expected ';' before 'return'",
        exit_code=1,
    )
    formatted = format_cpp_sandbox_result_for_llm(res)
    assert "[ERROR]\nCompilation Error" in formatted
    assert "expected ';'" in formatted
    assert "[EXIT CODE]\n1" in formatted


def test_format_cpp_sandbox_result_with_artifacts():
    """Verify generated artifacts (CSVs, binary data) are described."""
    res = CPPSandboxExecutionResult(
        success=True,
        stdout="Benchmark complete\n",
        artifacts=[
            SandboxArtifact(
                filename="benchmark.csv",
                mime_type="text/csv",
                size_bytes=1024,
                data_url="data:text/csv;base64,YWJj",
            )
        ],
    )
    formatted = format_cpp_sandbox_result_for_llm(res)
    assert "1 file artifact(s) created" in formatted
    assert "benchmark.csv (1024 bytes)" in formatted


def test_execute_cpp_code_async_delegation():
    """Verify async runner properly delegates to e2b_sandbox_service.execute_cpp_code."""
    mock_res = CPPSandboxExecutionResult(
        success=True,
        stdout="computed 500\n",
        compile_time_ms=50.0,
        execution_time_ms=10.0,
        duration_ms=60.0,
    )

    async def _test():
        with patch(
            "app.tools.cpp_sandbox.e2b_sandbox_service.execute_cpp_code",
            new_callable=AsyncMock,
            return_value=mock_res,
        ) as mock_exec:
            text, res_obj = await execute_cpp_code_async(
                code="int main() {}",
                compiler_flags="-std=c++20",
                stdin="10 20",
            )
            assert res_obj.success is True
            assert "computed 500" in text
            mock_exec.assert_called_once()
            _, kwargs = mock_exec.call_args
            assert kwargs["code"] == "int main() {}"
            assert kwargs["compiler_flags"] == "-std=c++20"
            assert kwargs["stdin"] == "10 20"

    asyncio.run(_test())


def test_execute_cpp_code_langchain_tool():
    """Verify synchronous LangChain tool wrapper correctly executes and returns text."""
    mock_res = CPPSandboxExecutionResult(
        success=True,
        stdout="Result from LangChain tool: 42\n",
        duration_ms=45.0,
    )

    with patch(
        "app.tools.cpp_sandbox.e2b_sandbox_service.execute_cpp_code",
        new_callable=AsyncMock,
        return_value=mock_res,
    ):
        output = execute_cpp_code.invoke({"code": "int main() {}"})
        assert "Result from LangChain tool: 42" in output
