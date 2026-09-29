"""
Unit tests for app.tools.python_sandbox.
"""

import asyncio
from unittest.mock import AsyncMock, patch
import pytest

from app.external_services.e2b_sandbox import SandboxExecutionResult
from app.schema.sandbox import SandboxArtifact
from app.tools.python_sandbox import (
    execute_python_code,
    execute_python_code_async,
    format_sandbox_result_for_llm,
)


def test_format_sandbox_result_empty():
    """Verify empty execution result is formatted clearly."""
    res = SandboxExecutionResult(success=True)
    formatted = format_sandbox_result_for_llm(res)
    assert "[Code executed successfully with no printed output]" in formatted


def test_format_sandbox_result_with_outputs():
    """Verify stdout, stderr, images, and artifacts are included in report."""
    res = SandboxExecutionResult(
        success=True,
        stdout="Calculated: 42\n",
        stderr="Warning: low precision\n",
        images=["data:image/png;base64,iVBORw0KGgo="],
        artifacts=[
            SandboxArtifact(
                filename="data.csv",
                mime_type="text/csv",
                size_bytes=1024,
                data_url="data:text/csv;base64,Y29sMQ==",
            )
        ],
        packages_installed=["scipy"],
    )
    formatted = format_sandbox_result_for_llm(res)
    assert "[STDOUT]\nCalculated: 42" in formatted
    assert "[STDERR]\nWarning: low precision" in formatted
    assert "[1 chart/image(s) generated successfully and captured]" in formatted
    assert "[1 file artifact(s) created: data.csv (1024 bytes)]" in formatted
    assert "[PACKAGES INSTALLED]\nscipy" in formatted


def test_format_sandbox_result_error():
    """Verify errors are cleanly presented."""
    res = SandboxExecutionResult(
        success=False,
        error="ZeroDivisionError: division by zero",
    )
    formatted = format_sandbox_result_for_llm(res)
    assert "[ERROR]\nZeroDivisionError: division by zero" in formatted


def test_execute_python_code_async_delegation():
    """Verify async execution helper calls e2b_sandbox_service.execute_code."""
    async def _run():
        mock_res = SandboxExecutionResult(
            success=True,
            stdout="777",
        )
        with patch("app.tools.python_sandbox.e2b_sandbox_service.execute_code", new_callable=AsyncMock, return_value=mock_res):
            text, res = await execute_python_code_async(code="print(777)")
            assert res.success is True
            assert "[STDOUT]\n777" in text

    asyncio.run(_run())


def test_execute_python_code_langchain_tool():
    """Verify the synchronous LangChain @tool wrapper functions properly."""
    mock_res = SandboxExecutionResult(
        success=True,
        stdout="tool output test\n",
    )
    with patch("app.tools.python_sandbox.e2b_sandbox_service.execute_code", new_callable=AsyncMock, return_value=mock_res):
        output = execute_python_code.invoke({"code": "print('tool output test')"})
        assert "[STDOUT]\ntool output test" in output
