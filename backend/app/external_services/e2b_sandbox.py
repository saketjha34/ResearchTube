"""
app.external_services.e2b_sandbox — External E2B Cloud Micro-VM Sandbox Service.

Executes Python code in an isolated, secure E2B micro-VM sandbox with support for:
- Standard output (stdout) & error streams (stderr)
- Data science, ML & numerical math (NumPy, SciPy, Pandas, SymPy, Scikit-Learn, PyTorch)
- Plotting & Visual figures (Matplotlib, Seaborn, Plotly) converted into base64 images
- Dynamic on-the-fly dependency installation if missing modules are detected
- File artifact capture (PDF reports, CSV datasets, Excel sheets, text files)
"""

from __future__ import annotations

import asyncio
import base64
import json
import mimetypes
import os
import re
import time
from typing import Any, AsyncGenerator, List, Optional
from pydantic import BaseModel, Field

# Ensure standard cross-platform MIME types regardless of OS registry (e.g. Windows Excel mapping .csv to application/vnd.ms-excel)
mimetypes.add_type("text/csv", ".csv")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("text/markdown", ".md")
mimetypes.add_type("text/plain", ".txt")
mimetypes.add_type("application/pdf", ".pdf")

import structlog

from app.core.config import settings
from app.schema.sandbox import SandboxArtifact

logger = structlog.get_logger("e2b_sandbox")


class SandboxExecutionResult(BaseModel):
    """Result of running Python code inside the sandbox."""
    success: bool = True
    stdout: str = ""
    stderr: str = ""
    error: Optional[str] = None
    results: list[str] = Field(default_factory=list)
    images: list[str] = Field(default_factory=list)  # Data URLs (e.g. data:image/png;base64,...)
    artifacts: list[SandboxArtifact] = Field(default_factory=list)  # Generated files (PDF, CSV, etc.)
    duration_ms: float = 0.0
    packages_installed: list[str] = Field(default_factory=list)


class CPPSandboxExecutionResult(BaseModel):
    """Result of compiling and executing C++ code inside the E2B micro-VM sandbox."""
    success: bool = True
    stdout: str = ""
    stderr: str = ""
    error: Optional[str] = None
    compile_output: Optional[str] = None
    compile_time_ms: float = 0.0
    execution_time_ms: float = 0.0
    duration_ms: float = 0.0
    exit_code: Optional[int] = 0
    artifacts: list[SandboxArtifact] = Field(default_factory=list)


def patch_fpdf_unicode_code(code: str) -> str:
    """
    Self-heals Python code that generates PDFs via fpdf/fpdf2 when encountering:
    1. Unicode encoding limitations (FPDFUnicodeEncodingException) by mapping characters & loading DejaVu.
    2. Empty string line breaks causing 'Not enough horizontal space to render a single character' in multi_cell.
    """
    replacements = {
        '\u2014': '-',   # em-dash —
        '\u2013': '-',   # en-dash –
        '\u201c': '"',   # left double quote “
        '\u201d': '"',   # right double quote ”
        '\u2018': "'",   # left single quote ‘
        '\u2019': "'",   # right single quote ’
        '\u2022': '*',   # bullet •
        '\u2026': '...', # ellipsis …
        '\u2192': '->',  # right arrow →
        '\u2190': '<-',  # left arrow ←
        '\u21d2': '=>',  # right double arrow ⇒
        '\u2265': '>=',  # greater or equal ≥
        '\u2264': '<=',  # less or equal ≤
        '\u2260': '!=',  # not equal ≠
        '\u00a0': ' ',   # non-breaking space
        '\u2713': '[x]', # checkmark ✓
        '\u2714': '[x]', # heavy checkmark ✔
        '\u2717': '[ ]', # ballot X ✗
        '\u2718': '[ ]', # heavy ballot X ✘
        '\u25cf': '*',   # black circle ●
        '\u25cb': 'o',   # white circle ○
        '\u25aa': '-',   # black small square ▪
        '\u25b6': '>',   # black right-pointing triangle ▶
        '\u222b': 'integral ', # integral ∫
        '\u2211': 'sum ',      # summation ∑
        '\u220f': 'prod ',     # product ∏
        '\u221a': 'sqrt',      # square root √
        '\u221e': 'inf',       # infinity ∞
        '\u00b1': '+/-',       # plus-minus ±
        '\u00d7': '*',         # multiplication ×
        '\u00f7': '/',         # division ÷
        '\u2248': '~=',        # almost equal ≈
        '\u03c0': 'pi',        # pi π
        '\u03b8': 'theta',     # theta θ
        '\u03b1': 'alpha',     # alpha α
        '\u03b2': 'beta',      # beta β
        '\u03bb': 'lambda',    # lambda λ
    }
    patched = code
    for char, rep in replacements.items():
        patched = patched.replace(char, rep)

    if "FPDF" in patched or "fpdf" in patched:
        fpdf_patch = '''
# --- Safe fpdf2 runtime patch for Unicode & multi_cell layout ---
try:
    from fpdf import FPDF as _FPDF
    import os as _os

    # 1. Patch multi_cell to handle empty strings and margin resets
    _orig_multi_cell = _FPDF.multi_cell
    def _safe_multi_cell(self, w=0, h=None, text="", *args, **kwargs):
        if not text or not str(text).strip():
            line_h = h if h is not None else 8
            self.ln(line_h)
            self.set_x(self.l_margin)
            return
        if self.x >= (self.w - self.r_margin - 1):
            self.set_x(self.l_margin)
        if "new_x" not in kwargs:
            kwargs["new_x"] = "LMARGIN"
        if "new_y" not in kwargs:
            kwargs["new_y"] = "NEXT"
        try:
            return _orig_multi_cell(self, w, h, text, *args, **kwargs)
        except Exception as _err:
            if "Not enough horizontal space" in str(_err):
                self.set_x(self.l_margin)
                return _orig_multi_cell(self, 0, h, text, *args, **kwargs)
            raise
    _FPDF.multi_cell = _safe_multi_cell

    # 2. Automatically load DejaVu TrueType font if available
    _orig_init = _FPDF.__init__
    def _patched_init(self, *args, **kwargs):
        _orig_init(self, *args, **kwargs)
        _dj_reg = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        _dj_b = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if _os.path.exists(_dj_reg):
            try:
                self.add_font("DejaVu", "", _dj_reg)
                self.add_font("DejaVu", "B", _dj_b if _os.path.exists(_dj_b) else _dj_reg)
                self.set_font("DejaVu", size=10)
            except Exception:
                pass
    _FPDF.__init__ = _patched_init

    # 3. Transparently redirect Helvetica/Arial/Times to DejaVu Unicode font
    _orig_set_font = _FPDF.set_font
    def _patched_set_font(self, family=None, style="", size=0):
        if family and family.lower() in ("helvetica", "arial", "times"):
            if "dejavu" in getattr(self, "fonts", {}):
                family = "DejaVu"
        return _orig_set_font(self, family=family, style=style, size=size)
    _FPDF.set_font = _patched_set_font
except Exception:
    pass
# --- End of safe fpdf2 runtime patch ---
'''
        patched = fpdf_patch + "\n" + patched

    return patched


class E2BSandboxService:
    """Client for E2B Code Interpreter micro-VMs."""

    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or settings.E2B_API_KEY
        if self.api_key:
            os.environ["E2B_API_KEY"] = self.api_key

    async def execute_python_code(
        self,
        code: str,
        timeout_sec: Optional[int] = None,
        auto_install: bool = True,
    ) -> SandboxExecutionResult:
        """
        Execute arbitrary Python code in an isolated E2B micro-VM.

        Parameters
        ----------
        code : str
            Python code to execute.
        timeout_sec : int, optional
            Execution timeout in seconds (default from settings).
        auto_install : bool, default True
            If True, automatically installs missing packages upon ModuleNotFoundError.

        Returns
        -------
        SandboxExecutionResult
        """
        if not self.api_key:
            return SandboxExecutionResult(
                success=False,
                error="E2B_API_KEY is not configured in environment.",
                stdout="",
                stderr="",
            )

        timeout = timeout_sec or settings.PYTHON_SANDBOX_TIMEOUT_SEC
        start_time = time.perf_counter()
        installed_packages: list[str] = []

        try:
            from e2b_code_interpreter import AsyncSandbox
        except ImportError:
            return SandboxExecutionResult(
                success=False,
                error="e2b-code-interpreter library is not installed.",
                stdout="",
                stderr="",
            )

        try:
            async with await AsyncSandbox.create(timeout=timeout) as sbx:
                # Track initial directory files
                initial_files: set[str] = set()
                try:
                    initial_listing = await sbx.files.list(".")
                    initial_files = {f.name for f in initial_listing}
                except Exception:
                    pass

                effective_code = patch_fpdf_unicode_code(code)
                execution = await sbx.run_code(effective_code)

                # Automatic package installation on missing module error
                if auto_install and execution.error and (
                    execution.error.name == "ModuleNotFoundError"
                    or "No module named" in str(execution.error.value)
                ):
                    missing_match = re.search(r"No module named ['\"]([^'\"]+)['\"]", str(execution.error.value))
                    if missing_match:
                        pkg_name = missing_match.group(1).split(".")[0]
                        pkg_map = {
                            "sklearn": "scikit-learn",
                            "cv2": "opencv-python-headless",
                            "PIL": "pillow",
                            "yaml": "pyyaml",
                            "fitz": "pymupdf",
                            "docx": "python-docx",
                            "pptx": "python-pptx",
                            "fpdf": "fpdf2",
                            "bs4": "beautifulsoup4",
                            "dateutil": "python-dateutil",
                        }
                        install_target = pkg_map.get(pkg_name, pkg_name)
                        logger.info("sandbox.auto_install", package=install_target)
                        cmd = await sbx.commands.run(f"pip install {install_target}")
                        if cmd.exit_code == 0:
                            installed_packages.append(install_target)
                            # Re-run after installation with fpdf unicode/layout patch applied
                            effective_code = patch_fpdf_unicode_code(code)
                            execution = await sbx.run_code(effective_code)

                # Automatic font/Unicode/layout self-healing for PDF generation (FPDFUnicodeEncodingException / FPDFException)
                if execution.error and (
                    "FPDFUnicodeEncodingException" in str(execution.error.name)
                    or "outside the range of characters supported" in str(execution.error.value)
                    or "UnicodeEncodeError" in str(execution.error.name)
                    or "latin-1" in str(execution.error.value)
                    or "Not enough horizontal space" in str(execution.error.value)
                    or "FPDFException" in str(execution.error.name)
                ):
                    logger.info("sandbox.auto_heal_fpdf", error_name=execution.error.name)
                    patched_code = patch_fpdf_unicode_code(code)
                    execution = await sbx.run_code(patched_code)

                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

                stdout_text = "".join(execution.logs.stdout)
                stderr_text = "".join(execution.logs.stderr)

                text_results: list[str] = []
                image_results: list[str] = []

                for r in execution.results:
                    if getattr(r, "png", None):
                        image_results.append(f"data:image/png;base64,{r.png}")
                    elif getattr(r, "jpeg", None):
                        image_results.append(f"data:image/jpeg;base64,{r.jpeg}")
                    elif getattr(r, "svg", None):
                        image_results.append(f"data:image/svg+xml;utf8,{r.svg}")

                    if getattr(r, "text", None):
                        text_results.append(str(r.text))

                # Discover any newly generated files (PDFs, CSVs, Excel, etc.)
                artifacts: list[SandboxArtifact] = []
                try:
                    current_listing = await sbx.files.list(".")
                    for item in current_listing:
                        if item.name not in initial_files and not item.name.startswith("."):
                            try:
                                raw_bytes = await sbx.files.read(item.name, format="bytes")
                                mime, _ = mimetypes.guess_type(item.name)
                                mime = mime or "application/octet-stream"
                                b64 = base64.b64encode(raw_bytes).decode("ascii")
                                artifacts.append(
                                    SandboxArtifact(
                                        filename=item.name,
                                        mime_type=mime,
                                        size_bytes=len(raw_bytes),
                                        data_url=f"data:{mime};base64,{b64}",
                                    )
                                )
                            except Exception as f_err:
                                logger.warning("sandbox.read_file_failed", filename=item.name, error=str(f_err))
                except Exception as list_err:
                    logger.warning("sandbox.list_files_failed", error=str(list_err))

                error_msg = None
                if execution.error:
                    error_msg = f"{execution.error.name}: {execution.error.value}"
                    if execution.error.traceback:
                        error_msg += f"\n{execution.error.traceback}"

                success = execution.error is None

                logger.info(
                    "sandbox.execution_complete",
                    success=success,
                    duration_ms=duration_ms,
                    images_count=len(image_results),
                    artifacts_count=len(artifacts),
                    stdout_len=len(stdout_text),
                )

                return SandboxExecutionResult(
                    success=success,
                    stdout=stdout_text,
                    stderr=stderr_text,
                    error=error_msg,
                    results=text_results,
                    images=image_results,
                    artifacts=artifacts,
                    duration_ms=duration_ms,
                    packages_installed=installed_packages,
                )

        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error("sandbox.execution_failed", exc=str(exc))
            return SandboxExecutionResult(
                success=False,
                error=f"Sandbox Execution Error: {str(exc)}",
                stdout="",
                stderr="",
                duration_ms=duration_ms,
            )

    # Alias for backward compatibility
    async def execute_code(
        self,
        code: str,
        timeout_sec: Optional[int] = None,
        auto_install: bool = True,
    ) -> SandboxExecutionResult:
        return await self.execute_python_code(
            code=code,
            timeout_sec=timeout_sec,
            auto_install=auto_install,
        )

    async def execute_python_stream(
        self,
        code: str,
        timeout_sec: Optional[int] = None,
        auto_install: bool = True,
    ) -> AsyncGenerator[str, None]:
        """
        Execute arbitrary Python code in an isolated E2B micro-VM and yield SSE events in real time:
        - `event: status`: Real-time status update string ("The sandbox is running...")
        - `event: stdout`: Real-time streamed line of printed output
        - `event: stderr`: Real-time stderr line
        - `event: figure`: Base64 chart image as soon as generated
        - `event: done`: Complete execution summary payload
        - `event: error`: Fatal setup/runtime failure
        """
        yield f"event: status\ndata: {json.dumps({'step': 'init', 'message': 'The sandbox is running: Initializing environment...'})}\n\n"

        if not self.api_key:
            err_msg = "E2B_API_KEY is not configured in environment."
            yield f"event: error\ndata: {json.dumps({'error': err_msg})}\n\n"
            return

        timeout = timeout_sec or settings.PYTHON_SANDBOX_TIMEOUT_SEC
        start_time = time.perf_counter()
        installed_packages: list[str] = []

        try:
            from e2b_code_interpreter import AsyncSandbox
        except ImportError:
            yield f"event: error\ndata: {json.dumps({'error': 'e2b-code-interpreter library is not installed.'})}\n\n"
            return

        try:
            yield f"event: status\ndata: {json.dumps({'step': 'booting', 'message': 'The sandbox is running: Booting isolated micro-VM...'})}\n\n"
            async with await AsyncSandbox.create(timeout=timeout) as sbx:
                # Track initial directory files
                initial_files: set[str] = set()
                try:
                    initial_listing = await sbx.files.list(".")
                    initial_files = {f.name for f in initial_listing}
                except Exception:
                    pass

                yield f"event: status\ndata: {json.dumps({'step': 'executing', 'message': 'The sandbox is running: Executing Python code...'})}\n\n"

                queue: asyncio.Queue[tuple[str, Any]] = asyncio.Queue()

                def on_stdout(msg: Any) -> None:
                    line = getattr(msg, "line", str(msg))
                    queue.put_nowait(("stdout", line))

                def on_stderr(msg: Any) -> None:
                    line = getattr(msg, "line", str(msg))
                    queue.put_nowait(("stderr", line))

                def on_result(res: Any) -> None:
                    if getattr(res, "png", None):
                        queue.put_nowait(("figure", f"data:image/png;base64,{res.png}"))
                    elif getattr(res, "jpeg", None):
                        queue.put_nowait(("figure", f"data:image/jpeg;base64,{res.jpeg}"))
                    elif getattr(res, "svg", None):
                        queue.put_nowait(("figure", f"data:image/svg+xml;utf8,{res.svg}"))
                    if getattr(res, "text", None):
                        queue.put_nowait(("result_text", str(res.text)))

                effective_code = patch_fpdf_unicode_code(code)
                run_task = asyncio.create_task(
                    sbx.run_code(
                        effective_code,
                        on_stdout=on_stdout,
                        on_stderr=on_stderr,
                        on_result=on_result,
                    )
                )

                while not run_task.done() or not queue.empty():
                    try:
                        evt_type, val = await asyncio.wait_for(queue.get(), timeout=0.1)
                        if evt_type == "stdout":
                            yield f"event: stdout\ndata: {json.dumps({'text': val + chr(10) if not val.endswith(chr(10)) else val})}\n\n"
                        elif evt_type == "stderr":
                            yield f"event: stderr\ndata: {json.dumps({'text': val + chr(10) if not val.endswith(chr(10)) else val})}\n\n"
                        elif evt_type == "figure":
                            yield f"event: figure\ndata: {json.dumps({'image': val})}\n\n"
                    except asyncio.TimeoutError:
                        pass

                execution = await run_task

                # Automatic package installation on missing module error
                if auto_install and execution.error and (
                    execution.error.name == "ModuleNotFoundError"
                    or "No module named" in str(execution.error.value)
                ):
                    missing_match = re.search(r"No module named ['\"]([^'\"]+)['\"]", str(execution.error.value))
                    if missing_match:
                        pkg_name = missing_match.group(1).split(".")[0]
                        pkg_map = {
                            "sklearn": "scikit-learn",
                            "cv2": "opencv-python-headless",
                            "PIL": "pillow",
                            "yaml": "pyyaml",
                            "fitz": "pymupdf",
                            "docx": "python-docx",
                            "pptx": "python-pptx",
                            "fpdf": "fpdf2",
                            "bs4": "beautifulsoup4",
                            "dateutil": "python-dateutil",
                        }
                        install_target = pkg_map.get(pkg_name, pkg_name)
                        yield f"event: status\ndata: {json.dumps({'step': 'installing', 'message': f'The sandbox is running: Installing missing package {install_target}...'})}\n\n"
                        logger.info("sandbox.auto_install", package=install_target)
                        cmd = await sbx.commands.run(f"pip install {install_target}")
                        if cmd.exit_code == 0:
                            installed_packages.append(install_target)
                            yield f"event: status\ndata: {json.dumps({'step': 're-executing', 'message': 'The sandbox is running: Re-executing Python code...'})}\n\n"
                            effective_code = patch_fpdf_unicode_code(code)
                            run_task = asyncio.create_task(
                                sbx.run_code(
                                    effective_code,
                                    on_stdout=on_stdout,
                                    on_stderr=on_stderr,
                                    on_result=on_result,
                                )
                            )
                            while not run_task.done() or not queue.empty():
                                try:
                                    evt_type, val = await asyncio.wait_for(queue.get(), timeout=0.1)
                                    if evt_type == "stdout":
                                        yield f"event: stdout\ndata: {json.dumps({'text': val + chr(10) if not val.endswith(chr(10)) else val})}\n\n"
                                    elif evt_type == "stderr":
                                        yield f"event: stderr\ndata: {json.dumps({'text': val + chr(10) if not val.endswith(chr(10)) else val})}\n\n"
                                    elif evt_type == "figure":
                                        yield f"event: figure\ndata: {json.dumps({'image': val})}\n\n"
                                except asyncio.TimeoutError:
                                    pass
                            execution = await run_task

                # Automatic font/Unicode/layout self-healing for PDF generation (FPDFUnicodeEncodingException / FPDFException)
                if execution.error and (
                    "FPDFUnicodeEncodingException" in str(execution.error.name)
                    or "outside the range of characters supported" in str(execution.error.value)
                    or "UnicodeEncodeError" in str(execution.error.name)
                    or "latin-1" in str(execution.error.value)
                    or "Not enough horizontal space" in str(execution.error.value)
                    or "FPDFException" in str(execution.error.name)
                ):
                    yield f"event: status\ndata: {json.dumps({'step': 'healing', 'message': 'The sandbox is running: Applying PDF Unicode & layout self-healing...'})}\n\n"
                    logger.info("sandbox.auto_heal_fpdf", error_name=execution.error.name)
                    patched_code = patch_fpdf_unicode_code(code)
                    run_task = asyncio.create_task(
                        sbx.run_code(
                            patched_code,
                            on_stdout=on_stdout,
                            on_stderr=on_stderr,
                            on_result=on_result,
                        )
                    )
                    while not run_task.done() or not queue.empty():
                        try:
                            evt_type, val = await asyncio.wait_for(queue.get(), timeout=0.1)
                            if evt_type == "stdout":
                                yield f"event: stdout\ndata: {json.dumps({'text': val + chr(10) if not val.endswith(chr(10)) else val})}\n\n"
                            elif evt_type == "stderr":
                                yield f"event: stderr\ndata: {json.dumps({'text': val + chr(10) if not val.endswith(chr(10)) else val})}\n\n"
                            elif evt_type == "figure":
                                yield f"event: figure\ndata: {json.dumps({'image': val})}\n\n"
                        except asyncio.TimeoutError:
                            pass
                    execution = await run_task

                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

                stdout_text = "".join(execution.logs.stdout)
                stderr_text = "".join(execution.logs.stderr)

                text_results: list[str] = []
                image_results: list[str] = []

                for r in execution.results:
                    if getattr(r, "png", None):
                        image_results.append(f"data:image/png;base64,{r.png}")
                    elif getattr(r, "jpeg", None):
                        image_results.append(f"data:image/jpeg;base64,{r.jpeg}")
                    elif getattr(r, "svg", None):
                        image_results.append(f"data:image/svg+xml;utf8,{r.svg}")

                    if getattr(r, "text", None):
                        text_results.append(str(r.text))

                # Discover any newly generated files (PDFs, CSVs, Excel, etc.)
                artifacts: list[SandboxArtifact] = []
                yield f"event: status\ndata: {json.dumps({'step': 'artifacts', 'message': 'The sandbox is running: Collecting generated outputs...'})}\n\n"
                try:
                    current_listing = await sbx.files.list(".")
                    for item in current_listing:
                        if item.name not in initial_files and not item.name.startswith("."):
                            try:
                                raw_bytes = await sbx.files.read(item.name, format="bytes")
                                mime, _ = mimetypes.guess_type(item.name)
                                mime = mime or "application/octet-stream"
                                b64 = base64.b64encode(raw_bytes).decode("ascii")
                                artifacts.append(
                                    SandboxArtifact(
                                        filename=item.name,
                                        mime_type=mime,
                                        size_bytes=len(raw_bytes),
                                        data_url=f"data:{mime};base64,{b64}",
                                    )
                                )
                            except Exception as f_err:
                                logger.warning("sandbox.read_file_failed", filename=item.name, error=str(f_err))
                except Exception as list_err:
                    logger.warning("sandbox.list_files_failed", error=str(list_err))

                error_msg = None
                if execution.error:
                    error_msg = f"{execution.error.name}: {execution.error.value}"
                    if execution.error.traceback:
                        error_msg += f"\n{execution.error.traceback}"

                success = execution.error is None

                final_payload = {
                    "success": success,
                    "stdout": stdout_text,
                    "stderr": stderr_text,
                    "error": error_msg,
                    "results": text_results,
                    "images": image_results,
                    "artifacts": [a.model_dump() for a in artifacts],
                    "duration_ms": duration_ms,
                    "packages_installed": installed_packages,
                }
                yield f"event: done\ndata: {json.dumps(final_payload)}\n\n"

        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error("sandbox.execution_failed", exc=str(exc))
            err_payload = {
                "success": False,
                "stdout": "",
                "stderr": "",
                "error": f"Sandbox Execution Error: {str(exc)}",
                "results": [],
                "images": [],
                "artifacts": [],
                "duration_ms": duration_ms,
                "packages_installed": [],
            }
            yield f"event: done\ndata: {json.dumps(err_payload)}\n\n"

    # Alias for backward compatibility
    def execute_code_stream(
        self,
        code: str,
        timeout_sec: Optional[int] = None,
        auto_install: bool = True,
    ) -> AsyncGenerator[str, None]:
        return self.execute_python_stream(
            code=code,
            timeout_sec=timeout_sec,
            auto_install=auto_install,
        )

    # =========================================================================
    # C++ Sandbox Execution Methods
    # =========================================================================

    async def execute_cpp_code(
        self,
        code: str,
        timeout_sec: Optional[int] = None,
        compiler_flags: Optional[str] = None,
        stdin: Optional[str] = None,
    ) -> CPPSandboxExecutionResult:
        """
        Compile and execute C++ code in an isolated E2B micro-VM sandbox.

        Parameters
        ----------
        code : str
            C++ source code.
        timeout_sec : int, optional
            Timeout for compilation and execution in seconds.
        compiler_flags : str, optional
            g++ compiler flags (defaults to settings.CPP_DEFAULT_COMPILER_FLAGS).
        stdin : str, optional
            Optional standard input string to pipe into the binary.

        Returns
        -------
        CPPSandboxExecutionResult
        """
        if not self.api_key:
            return CPPSandboxExecutionResult(
                success=False,
                error="E2B_API_KEY is not configured in environment.",
                stdout="",
                stderr="",
            )

        timeout = timeout_sec or settings.CPP_SANDBOX_TIMEOUT_SEC
        flags = compiler_flags or getattr(settings, "CPP_DEFAULT_COMPILER_FLAGS", "-std=c++20 -O2 -Wall -Wextra")
        total_start = time.perf_counter()

        try:
            from e2b_code_interpreter import AsyncSandbox
        except ImportError:
            return CPPSandboxExecutionResult(
                success=False,
                error="e2b-code-interpreter library is not installed.",
                stdout="",
                stderr="",
            )

        try:
            async with await AsyncSandbox.create(timeout=timeout) as sbx:
                # Track initial directory files
                initial_files: set[str] = set()
                try:
                    initial_listing = await sbx.files.list(".")
                    initial_files = {f.name for f in initial_listing}
                except Exception:
                    pass

                # Step 1: Write C++ source file
                await sbx.files.write("main.cpp", code)

                # Step 2: Compile with g++
                compile_start = time.perf_counter()
                try:
                    comp_res = await sbx.commands.run(f"g++ {flags} main.cpp -o main", timeout=timeout)
                    compile_time_ms = round((time.perf_counter() - compile_start) * 1000, 2)
                    compile_output = (comp_res.stderr or comp_res.stdout or "").strip()
                    compile_exit_code = comp_res.exit_code
                except Exception as comp_err:
                    compile_time_ms = round((time.perf_counter() - compile_start) * 1000, 2)
                    compile_output = (getattr(comp_err, "stderr", None) or getattr(comp_err, "stdout", None) or str(comp_err)).strip()
                    compile_exit_code = getattr(comp_err, "exit_code", 1)

                if compile_exit_code != 0:
                    total_duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
                    err_msg = "Compilation Error"
                    logger.warning("sandbox.cpp.compile_failed", exit_code=compile_exit_code, output=compile_output[:300])

                    fail_res = CPPSandboxExecutionResult(
                        success=False,
                        stdout="",
                        stderr=compile_output,
                        error=err_msg,
                        compile_output=compile_output,
                        compile_time_ms=compile_time_ms,
                        execution_time_ms=0.0,
                        duration_ms=total_duration_ms,
                        exit_code=compile_exit_code,
                        artifacts=[],
                    )
                    return fail_res

                # Step 3: Execute compiled binary
                if stdin is not None:
                    await sbx.files.write("stdin.txt", stdin)
                    run_cmd = "bash -c './main < stdin.txt'"
                else:
                    run_cmd = "./main"

                exec_start = time.perf_counter()
                try:
                    exec_res = await sbx.commands.run(run_cmd, timeout=timeout)
                    stdout_text = exec_res.stdout or ""
                    stderr_text = exec_res.stderr or ""
                    exec_exit_code = exec_res.exit_code
                    exec_error = exec_res.error
                except Exception as exec_err:
                    stdout_text = getattr(exec_err, "stdout", "") or ""
                    stderr_text = getattr(exec_err, "stderr", "") or str(exec_err)
                    exec_exit_code = getattr(exec_err, "exit_code", 1)
                    exec_error = getattr(exec_err, "error", None) or f"Process exited with code {exec_exit_code}"

                execution_time_ms = round((time.perf_counter() - exec_start) * 1000, 2)
                total_duration_ms = round((time.perf_counter() - total_start) * 1000, 2)

                success = (exec_exit_code == 0)
                error_msg = None if success else f"Runtime Error (Exit Code {exec_exit_code})"
                if exec_error:
                    error_msg = str(exec_error)

                # Step 4: Discover any newly generated files
                artifacts: list[SandboxArtifact] = []
                system_cpp_files = {"main.cpp", "main", "stdin.txt"}
                try:
                    current_listing = await sbx.files.list(".")
                    for item in current_listing:
                        if (
                            item.name not in initial_files
                            and item.name not in system_cpp_files
                            and not item.name.startswith(".")
                        ):
                            try:
                                raw_bytes = await sbx.files.read(item.name, format="bytes")
                                mime, _ = mimetypes.guess_type(item.name)
                                mime = mime or "application/octet-stream"
                                b64 = base64.b64encode(raw_bytes).decode("ascii")
                                artifacts.append(
                                    SandboxArtifact(
                                        filename=item.name,
                                        mime_type=mime,
                                        size_bytes=len(raw_bytes),
                                        data_url=f"data:{mime};base64,{b64}",
                                    )
                                )
                            except Exception as f_err:
                                logger.warning("sandbox.cpp.read_file_failed", filename=item.name, error=str(f_err))
                except Exception as list_err:
                    logger.warning("sandbox.cpp.list_files_failed", error=str(list_err))

                logger.info(
                    "sandbox.cpp.execution_complete",
                    success=success,
                    compile_time_ms=compile_time_ms,
                    execution_time_ms=execution_time_ms,
                    duration_ms=total_duration_ms,
                    artifacts_count=len(artifacts),
                    stdout_len=len(stdout_text),
                )

                return CPPSandboxExecutionResult(
                    success=success,
                    stdout=stdout_text,
                    stderr=stderr_text,
                    error=error_msg,
                    compile_output=compile_output,
                    compile_time_ms=compile_time_ms,
                    execution_time_ms=execution_time_ms,
                    duration_ms=total_duration_ms,
                    exit_code=exec_exit_code,
                    artifacts=artifacts,
                )

        except Exception as exc:
            total_duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            logger.error("sandbox.cpp.execution_failed", exc=str(exc))
            return CPPSandboxExecutionResult(
                success=False,
                error=f"Sandbox Execution Error: {str(exc)}",
                stdout="",
                stderr="",
                duration_ms=total_duration_ms,
            )

    async def execute_cpp_stream(
        self,
        code: str,
        timeout_sec: Optional[int] = None,
        compiler_flags: Optional[str] = None,
        stdin: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Compile and execute C++ code in an isolated E2B micro-VM and yield SSE events in real time:
        - `event: status`: Real-time status update ("The sandbox is running: Booting micro-VM...", "The sandbox is running: Compiling C++20 with g++...", "The sandbox is running: Executing binary ./main...")
        - `event: stdout`: Chunks of stdout output in real time
        - `event: stderr`: Error output in real time
        - `event: done`: Final structured execution payload
        - `event: error`: Fatal setup/runtime failure
        """
        yield f"event: status\ndata: {json.dumps({'step': 'init', 'message': 'The sandbox is running: Initializing environment...'})}\n\n"

        if not self.api_key:
            err_msg = "E2B_API_KEY is not configured in environment."
            yield f"event: error\ndata: {json.dumps({'error': err_msg})}\n\n"
            return

        timeout = timeout_sec or settings.CPP_SANDBOX_TIMEOUT_SEC
        flags = compiler_flags or getattr(settings, "CPP_DEFAULT_COMPILER_FLAGS", "-std=c++20 -O2 -Wall -Wextra")
        total_start = time.perf_counter()

        try:
            from e2b_code_interpreter import AsyncSandbox
        except ImportError:
            yield f"event: error\ndata: {json.dumps({'error': 'e2b-code-interpreter library is not installed.'})}\n\n"
            return

        try:
            yield f"event: status\ndata: {json.dumps({'step': 'booting', 'message': 'The sandbox is running: Booting isolated micro-VM...'})}\n\n"
            async with await AsyncSandbox.create(timeout=timeout) as sbx:
                # Track initial directory files
                initial_files: set[str] = set()
                try:
                    initial_listing = await sbx.files.list(".")
                    initial_files = {f.name for f in initial_listing}
                except Exception:
                    pass

                # Step 1: Write C++ source
                await sbx.files.write("main.cpp", code)

                # Step 2: Compile with g++
                yield f"event: status\ndata: {json.dumps({'step': 'compiling', 'message': 'The sandbox is running: Compiling C++20 with g++...'})}\n\n"
                compile_start = time.perf_counter()
                try:
                    comp_res = await sbx.commands.run(f"g++ {flags} main.cpp -o main", timeout=timeout)
                    compile_time_ms = round((time.perf_counter() - compile_start) * 1000, 2)
                    compile_output = (comp_res.stderr or comp_res.stdout or "").strip()
                    compile_exit_code = comp_res.exit_code
                except Exception as comp_err:
                    compile_time_ms = round((time.perf_counter() - compile_start) * 1000, 2)
                    compile_output = (getattr(comp_err, "stderr", None) or getattr(comp_err, "stdout", None) or str(comp_err)).strip()
                    compile_exit_code = getattr(comp_err, "exit_code", 1)

                if compile_exit_code != 0:
                    total_duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
                    logger.warning("sandbox.cpp.compile_failed", exit_code=compile_exit_code, output=compile_output[:300])
                    # Stream compiler errors to stderr event
                    if compile_output:
                        yield f"event: stderr\ndata: {json.dumps({'text': compile_output + chr(10)})}\n\n"

                    fail_payload = {
                        "success": False,
                        "stdout": "",
                        "stderr": compile_output,
                        "error": "Compilation Error",
                        "compile_output": compile_output,
                        "compile_time_ms": compile_time_ms,
                        "execution_time_ms": 0.0,
                        "duration_ms": total_duration_ms,
                        "exit_code": compile_exit_code,
                        "artifacts": [],
                    }

                    yield f"event: done\ndata: {json.dumps(fail_payload)}\n\n"
                    return

                # Step 3: Run compiled binary with live streaming
                yield f"event: status\ndata: {json.dumps({'step': 'executing', 'message': 'The sandbox is running: Executing binary ./main...'})}\n\n"

                if stdin is not None:
                    await sbx.files.write("stdin.txt", stdin)
                    run_cmd = "bash -c './main < stdin.txt'"
                else:
                    run_cmd = "./main"

                queue: asyncio.Queue[tuple[str, str]] = asyncio.Queue()

                def on_stdout(line: str) -> None:
                    queue.put_nowait(("stdout", line))

                def on_stderr(line: str) -> None:
                    queue.put_nowait(("stderr", line))

                exec_start = time.perf_counter()
                run_task = asyncio.create_task(
                    sbx.commands.run(
                        run_cmd,
                        on_stdout=on_stdout,
                        on_stderr=on_stderr,
                        timeout=timeout,
                    )
                )

                while not run_task.done() or not queue.empty():
                    try:
                        evt_type, val = await asyncio.wait_for(queue.get(), timeout=0.1)
                        if evt_type == "stdout":
                            yield f"event: stdout\ndata: {json.dumps({'text': val + chr(10) if not val.endswith(chr(10)) else val})}\n\n"
                        elif evt_type == "stderr":
                            yield f"event: stderr\ndata: {json.dumps({'text': val + chr(10) if not val.endswith(chr(10)) else val})}\n\n"
                    except asyncio.TimeoutError:
                        pass

                try:
                    exec_res = await run_task
                    stdout_text = exec_res.stdout or ""
                    stderr_text = exec_res.stderr or ""
                    exec_exit_code = exec_res.exit_code
                    exec_error = exec_res.error
                except Exception as exec_err:
                    stdout_text = getattr(exec_err, "stdout", "") or ""
                    stderr_text = getattr(exec_err, "stderr", "") or str(exec_err)
                    exec_exit_code = getattr(exec_err, "exit_code", 1)
                    exec_error = getattr(exec_err, "error", None) or f"Process exited with code {exec_exit_code}"

                execution_time_ms = round((time.perf_counter() - exec_start) * 1000, 2)
                total_duration_ms = round((time.perf_counter() - total_start) * 1000, 2)

                success = (exec_exit_code == 0)
                error_msg = None if success else f"Runtime Error (Exit Code {exec_exit_code})"
                if exec_error:
                    error_msg = str(exec_error)

                # Step 4: Discover newly generated file artifacts
                artifacts: list[SandboxArtifact] = []
                system_cpp_files = {"main.cpp", "main", "stdin.txt"}
                yield f"event: status\ndata: {json.dumps({'step': 'artifacts', 'message': 'The sandbox is running: Collecting generated outputs...'})}\n\n"
                try:
                    current_listing = await sbx.files.list(".")
                    for item in current_listing:
                        if (
                            item.name not in initial_files
                            and item.name not in system_cpp_files
                            and not item.name.startswith(".")
                        ):
                            try:
                                raw_bytes = await sbx.files.read(item.name, format="bytes")
                                mime, _ = mimetypes.guess_type(item.name)
                                mime = mime or "application/octet-stream"
                                b64 = base64.b64encode(raw_bytes).decode("ascii")
                                artifacts.append(
                                    SandboxArtifact(
                                        filename=item.name,
                                        mime_type=mime,
                                        size_bytes=len(raw_bytes),
                                        data_url=f"data:{mime};base64,{b64}",
                                    )
                                )
                            except Exception as f_err:
                                logger.warning("sandbox.cpp.read_file_failed", filename=item.name, error=str(f_err))
                except Exception as list_err:
                    logger.warning("sandbox.cpp.list_files_failed", error=str(list_err))

                final_payload = {
                    "success": success,
                    "stdout": stdout_text,
                    "stderr": stderr_text,
                    "error": error_msg,
                    "compile_output": compile_output,
                    "compile_time_ms": compile_time_ms,
                    "execution_time_ms": execution_time_ms,
                    "duration_ms": total_duration_ms,
                    "exit_code": exec_exit_code,
                    "artifacts": [a.model_dump() for a in artifacts],
                }
                yield f"event: done\ndata: {json.dumps(final_payload)}\n\n"

        except Exception as exc:
            total_duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            logger.error("sandbox.cpp.execution_failed", exc=str(exc))
            err_payload = {
                "success": False,
                "stdout": "",
                "stderr": "",
                "error": f"Sandbox Execution Error: {str(exc)}",
                "compile_output": None,
                "compile_time_ms": 0.0,
                "execution_time_ms": 0.0,
                "duration_ms": total_duration_ms,
                "exit_code": -1,
                "artifacts": [],
            }
            yield f"event: done\ndata: {json.dumps(err_payload)}\n\n"


e2b_sandbox_service = E2BSandboxService()
