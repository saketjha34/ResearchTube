"""
Unit tests for app.external_services.e2b_sandbox.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.external_services.e2b_sandbox import (
    E2BSandboxService,
    SandboxExecutionResult,
    patch_fpdf_unicode_code,
)
from app.schema.sandbox import SandboxArtifact


def test_sandbox_execution_result_defaults():
    """Verify default fields of SandboxExecutionResult."""
    res = SandboxExecutionResult(success=True)
    assert res.success is True
    assert res.stdout == ""
    assert res.stderr == ""
    assert res.error is None
    assert res.results == []
    assert res.images == []
    assert res.artifacts == []
    assert res.duration_ms == 0.0
    assert res.packages_installed == []
    assert res.webhook_delivered is None


def test_patch_fpdf_unicode_character_replacements():
    """Verify typographic unicode characters are sanitized to ASCII equivalents."""
    raw_code = 'pdf.cell(text="Visualcoders \u2014 5 Steps \u201cDynamic Programming\u201d \u2192 kitten \u2022 done")'
    patched = patch_fpdf_unicode_code(raw_code)

    assert "\u2014" not in patched
    assert "-" in patched
    assert "\u201c" not in patched
    assert "\u201d" not in patched
    assert '"' in patched
    assert "\u2192" not in patched
    assert "->" in patched
    assert "\u2022" not in patched
    assert "*" in patched


def test_patch_fpdf_unicode_font_injection():
    """Verify DejaVu font registration is injected when FPDF is used."""
    code = """from fpdf import FPDF
pdf = FPDF()
pdf.add_page()
pdf.set_font('helvetica', size=12)
pdf.cell(text='Hello World')
"""
    patched = patch_fpdf_unicode_code(code)
    assert "DejaVu" in patched
    assert "DejaVuSans.ttf" in patched
    assert "pdf.add_font(" in patched


def test_execute_code_missing_api_key():
    """Verify sandbox execution gracefully fails when E2B_API_KEY is not configured."""
    async def _run():
        service = E2BSandboxService(api_key=None)
        with patch.object(service, "api_key", None):
            res = await service.execute_code("print('hello')")
            assert res.success is False
            assert "E2B_API_KEY is not configured" in (res.error or "")

    asyncio.run(_run())


def test_execute_code_successful_mock():
    """Verify successful execution flow with mocked E2B AsyncSandbox."""
    async def _run():
        service = E2BSandboxService(api_key="e2b_test_mock_key")

        mock_execution = MagicMock()
        mock_execution.logs.stdout = ["Hello from Sandbox\n"]
        mock_execution.logs.stderr = []
        mock_execution.error = None
        mock_execution.results = []

        mock_sbx = AsyncMock()
        mock_sbx.files.list = AsyncMock(return_value=[])
        mock_sbx.run_code = AsyncMock(return_value=mock_execution)

        mock_create = AsyncMock()
        mock_create.__aenter__.return_value = mock_sbx
        mock_create.__aexit__.return_value = None

        with patch("e2b_code_interpreter.AsyncSandbox.create", return_value=mock_create):
            res = await service.execute_code("print('Hello from Sandbox')")

            assert res.success is True
            assert "Hello from Sandbox" in res.stdout
            assert res.error is None
            assert res.duration_ms >= 0

    asyncio.run(_run())


def test_execute_code_captures_artifacts():
    """Verify newly created files are detected and encoded as SandboxArtifacts."""
    async def _run():
        service = E2BSandboxService(api_key="e2b_test_mock_key")

        mock_execution = MagicMock()
        mock_execution.logs.stdout = ["Generated report.pdf\n"]
        mock_execution.logs.stderr = []
        mock_execution.error = None
        mock_execution.results = []

        initial_item = MagicMock()
        initial_item.name = "existing_file.py"

        new_item = MagicMock()
        new_item.name = "report.pdf"

        mock_sbx = AsyncMock()
        mock_sbx.files.list = AsyncMock(side_effect=[[initial_item], [initial_item, new_item]])
        mock_sbx.files.read = AsyncMock(return_value=b"%PDF-1.4 mock pdf content")
        mock_sbx.run_code = AsyncMock(return_value=mock_execution)

        mock_create = AsyncMock()
        mock_create.__aenter__.return_value = mock_sbx
        mock_create.__aexit__.return_value = None

        with patch("e2b_code_interpreter.AsyncSandbox.create", return_value=mock_create):
            res = await service.execute_code("create_pdf()")

            assert res.success is True
            assert len(res.artifacts) == 1
            art = res.artifacts[0]
            assert art.filename == "report.pdf"
            assert art.mime_type == "application/pdf"
            assert art.data_url.startswith("data:application/pdf;base64,")

    asyncio.run(_run())


def test_execute_code_auto_installs_missing_module():
    """Verify ModuleNotFoundError triggers auto-installation and re-execution."""
    async def _run():
        service = E2BSandboxService(api_key="e2b_test_mock_key")

        error1 = MagicMock()
        error1.name = "ModuleNotFoundError"
        error1.value = "No module named 'scipy'"
        error1.traceback = ""

        mock_exec1 = MagicMock()
        mock_exec1.error = error1
        mock_exec1.logs.stdout = []
        mock_exec1.logs.stderr = ["ModuleNotFoundError: No module named 'scipy'\n"]
        mock_exec1.results = []

        mock_exec2 = MagicMock()
        mock_exec2.error = None
        mock_exec2.logs.stdout = ["Successfully imported scipy\n"]
        mock_exec2.logs.stderr = []
        mock_exec2.results = []

        cmd_result = MagicMock()
        cmd_result.exit_code = 0

        mock_sbx = AsyncMock()
        mock_sbx.files.list = AsyncMock(return_value=[])
        mock_sbx.commands.run = AsyncMock(return_value=cmd_result)
        mock_sbx.run_code = AsyncMock(side_effect=[mock_exec1, mock_exec2])

        mock_create = AsyncMock()
        mock_create.__aenter__.return_value = mock_sbx
        mock_create.__aexit__.return_value = None

        with patch("e2b_code_interpreter.AsyncSandbox.create", return_value=mock_create):
            res = await service.execute_code("import scipy", auto_install=True)

            assert "scipy" in res.packages_installed
            assert res.success is True
            assert "Successfully imported scipy" in res.stdout

    asyncio.run(_run())
