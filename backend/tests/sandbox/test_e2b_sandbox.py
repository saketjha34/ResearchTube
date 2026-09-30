"""
Unit tests for app.external_services.e2b_sandbox (Python & C++ execution).
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.external_services.e2b_sandbox import (
    E2BSandboxService,
    SandboxExecutionResult,
    CPPSandboxExecutionResult,
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


def test_cpp_sandbox_execution_result_defaults():
    """Verify default fields of CPPSandboxExecutionResult."""
    res = CPPSandboxExecutionResult(success=True)
    assert res.success is True
    assert res.stdout == ""
    assert res.stderr == ""
    assert res.error is None
    assert res.compile_output is None
    assert res.compile_time_ms == 0.0
    assert res.execution_time_ms == 0.0
    assert res.duration_ms == 0.0
    assert res.exit_code == 0
    assert res.artifacts == []


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
    """Verify DejaVu font registration and multi_cell layout patch is injected when FPDF is used."""
    code = """from fpdf import FPDF
pdf = FPDF()
pdf.add_page()
pdf.set_font('helvetica', size=12)
pdf.cell(text='Hello World')
"""
    patched = patch_fpdf_unicode_code(code)
    assert "DejaVu" in patched
    assert "DejaVuSans.ttf" in patched
    assert "add_font" in patched
    assert "_safe_multi_cell" in patched


def test_execute_code_missing_api_key():
    """Verify sandbox execution gracefully fails when E2B_API_KEY is not configured."""
    async def _run():
        service = E2BSandboxService(api_key=None)
        with patch.object(service, "api_key", None):
            res = await service.execute_code("print('hello')")
            assert res.success is False
            assert "E2B_API_KEY is not configured" in (res.error or "")

    asyncio.run(_run())


def test_execute_cpp_code_missing_api_key():
    """Verify C++ sandbox execution gracefully fails when E2B_API_KEY is not configured."""
    async def _run():
        service = E2BSandboxService(api_key=None)
        with patch.object(service, "api_key", None):
            res = await service.execute_cpp_code("int main() { return 0; }")
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


def test_execute_cpp_code_successful_mock():
    """Verify successful C++ compilation and execution with mocked E2B AsyncSandbox."""
    async def _run():
        service = E2BSandboxService(api_key="e2b_test_mock_key")

        mock_compile_res = MagicMock()
        mock_compile_res.exit_code = 0
        mock_compile_res.stdout = ""
        mock_compile_res.stderr = ""
        mock_compile_res.error = None

        mock_run_res = MagicMock()
        mock_run_res.exit_code = 0
        mock_run_res.stdout = "Hello from C++20 Sandbox!\n"
        mock_run_res.stderr = ""
        mock_run_res.error = None

        mock_sbx = AsyncMock()
        mock_sbx.files.write = AsyncMock()
        mock_sbx.files.list = AsyncMock(return_value=[])
        mock_sbx.commands.run = AsyncMock(side_effect=[mock_compile_res, mock_run_res])

        mock_create = AsyncMock()
        mock_create.__aenter__.return_value = mock_sbx
        mock_create.__aexit__.return_value = None

        with patch("e2b_code_interpreter.AsyncSandbox.create", return_value=mock_create):
            cpp_code = '#include <iostream>\nint main() { std::cout << "Hello from C++20 Sandbox!\\n"; return 0; }'
            res = await service.execute_cpp_code(cpp_code)

            assert res.success is True
            assert "Hello from C++20 Sandbox!" in res.stdout
            assert res.error is None
            assert res.exit_code == 0
            assert res.compile_time_ms >= 0
            assert res.execution_time_ms >= 0

    asyncio.run(_run())


def test_execute_cpp_code_compilation_error_mock():
    """Verify C++ compilation error handling with mocked compiler diagnostics."""
    async def _run():
        service = E2BSandboxService(api_key="e2b_test_mock_key")

        mock_compile_res = MagicMock()
        mock_compile_res.exit_code = 1
        mock_compile_res.stdout = ""
        mock_compile_res.stderr = "main.cpp:3:5: error: 'cout' was not declared in this scope\n"
        mock_compile_res.error = None

        mock_sbx = AsyncMock()
        mock_sbx.files.write = AsyncMock()
        mock_sbx.files.list = AsyncMock(return_value=[])
        mock_sbx.commands.run = AsyncMock(return_value=mock_compile_res)

        mock_create = AsyncMock()
        mock_create.__aenter__.return_value = mock_sbx
        mock_create.__aexit__.return_value = None

        with patch("e2b_code_interpreter.AsyncSandbox.create", return_value=mock_create):
            bad_cpp = 'int main() { cout << 123; return 0; }'
            res = await service.execute_cpp_code(bad_cpp)

            assert res.success is False
            assert res.error == "Compilation Error"
            assert "was not declared in this scope" in (res.compile_output or "")
            assert res.exit_code == 1

    asyncio.run(_run())


def test_execute_cpp_code_runtime_error_mock():
    """Verify C++ runtime error / non-zero exit code handling."""
    async def _run():
        service = E2BSandboxService(api_key="e2b_test_mock_key")

        mock_compile_res = MagicMock()
        mock_compile_res.exit_code = 0
        mock_compile_res.stdout = ""
        mock_compile_res.stderr = ""
        mock_compile_res.error = None

        mock_run_res = MagicMock()
        mock_run_res.exit_code = 139  # Segmentation fault exit code
        mock_run_res.stdout = ""
        mock_run_res.stderr = "Segmentation fault (core dumped)\n"
        mock_run_res.error = None

        mock_sbx = AsyncMock()
        mock_sbx.files.write = AsyncMock()
        mock_sbx.files.list = AsyncMock(return_value=[])
        mock_sbx.commands.run = AsyncMock(side_effect=[mock_compile_res, mock_run_res])

        mock_create = AsyncMock()
        mock_create.__aenter__.return_value = mock_sbx
        mock_create.__aexit__.return_value = None

        with patch("e2b_code_interpreter.AsyncSandbox.create", return_value=mock_create):
            segfault_cpp = 'int main() { int* p = nullptr; *p = 42; return 0; }'
            res = await service.execute_cpp_code(segfault_cpp)

            assert res.success is False
            assert res.exit_code == 139
            assert "Segmentation fault" in res.stderr
            assert "Runtime Error (Exit Code 139)" in (res.error or "")

    asyncio.run(_run())


def test_execute_cpp_code_with_stdin_mock():
    """Verify stdin is piped to binary execution when provided."""
    async def _run():
        service = E2BSandboxService(api_key="e2b_test_mock_key")

        mock_compile_res = MagicMock()
        mock_compile_res.exit_code = 0
        mock_compile_res.stdout = ""
        mock_compile_res.stderr = ""

        mock_run_res = MagicMock()
        mock_run_res.exit_code = 0
        mock_run_res.stdout = "Sum: 42\n"
        mock_run_res.stderr = ""

        mock_sbx = AsyncMock()
        mock_sbx.files.write = AsyncMock()
        mock_sbx.files.list = AsyncMock(return_value=[])
        mock_sbx.commands.run = AsyncMock(side_effect=[mock_compile_res, mock_run_res])

        mock_create = AsyncMock()
        mock_create.__aenter__.return_value = mock_sbx
        mock_create.__aexit__.return_value = None

        with patch("e2b_code_interpreter.AsyncSandbox.create", return_value=mock_create):
            cpp_code = '#include <iostream>\nint main() { int a, b; std::cin >> a >> b; std::cout << "Sum: " << a+b << "\\n"; }'
            res = await service.execute_cpp_code(cpp_code, stdin="20 22")

            assert res.success is True
            assert "Sum: 42" in res.stdout
            # Verify stdin was written to file
            mock_sbx.files.write.assert_any_call("stdin.txt", "20 22")

    asyncio.run(_run())


def test_execute_code_captures_artifacts():
    """Verify newly created files are detected and fetched as base64 artifacts."""
    async def _run():
        service = E2BSandboxService(api_key="e2b_test_mock_key")

        mock_execution = MagicMock()
        mock_execution.logs.stdout = ["CSV exported\n"]
        mock_execution.logs.stderr = []
        mock_execution.error = None
        mock_execution.results = []

        file_before = MagicMock()
        file_before.name = "input.txt"

        file_after_1 = MagicMock()
        file_after_1.name = "input.txt"
        file_after_2 = MagicMock()
        file_after_2.name = "output.csv"

        mock_sbx = AsyncMock()
        mock_sbx.files.list = AsyncMock(side_effect=[[file_before], [file_after_1, file_after_2]])
        mock_sbx.files.read = AsyncMock(return_value=b"col1,col2\n1,2\n")
        mock_sbx.run_code = AsyncMock(return_value=mock_execution)

        mock_create = AsyncMock()
        mock_create.__aenter__.return_value = mock_sbx
        mock_create.__aexit__.return_value = None

        with patch("e2b_code_interpreter.AsyncSandbox.create", return_value=mock_create):
            res = await service.execute_code("import pandas; ...")

            assert len(res.artifacts) == 1
            artifact = res.artifacts[0]
            assert artifact.filename == "output.csv"
            assert artifact.mime_type == "text/csv"
            assert "data:text/csv;base64," in artifact.data_url

    asyncio.run(_run())


def test_execute_cpp_code_captures_artifacts():
    """Verify C++ binary file generation produces downloadable SandboxArtifacts."""
    async def _run():
        service = E2BSandboxService(api_key="e2b_test_mock_key")

        mock_compile_res = MagicMock()
        mock_compile_res.exit_code = 0
        mock_compile_res.stdout = ""
        mock_compile_res.stderr = ""

        mock_run_res = MagicMock()
        mock_run_res.exit_code = 0
        mock_run_res.stdout = "File created\n"
        mock_run_res.stderr = ""

        file_before = MagicMock()
        file_before.name = "main.cpp"

        file_after_1 = MagicMock()
        file_after_1.name = "main.cpp"
        file_after_2 = MagicMock()
        file_after_2.name = "results.txt"

        mock_sbx = AsyncMock()
        mock_sbx.files.write = AsyncMock()
        mock_sbx.files.list = AsyncMock(side_effect=[[file_before], [file_after_1, file_after_2]])
        mock_sbx.files.read = AsyncMock(return_value=b"Benchmark: 1000 ops\n")
        mock_sbx.commands.run = AsyncMock(side_effect=[mock_compile_res, mock_run_res])

        mock_create = AsyncMock()
        mock_create.__aenter__.return_value = mock_sbx
        mock_create.__aexit__.return_value = None

        with patch("e2b_code_interpreter.AsyncSandbox.create", return_value=mock_create):
            res = await service.execute_cpp_code("int main() { ... }")

            assert len(res.artifacts) == 1
            assert res.artifacts[0].filename == "results.txt"
            assert "Benchmark: 1000 ops" in res.artifacts[0].data_url or res.artifacts[0].size_bytes > 0

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
