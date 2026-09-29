"""
app.external_services.e2b_sandbox — External E2B Cloud Micro-VM Sandbox Service.

Executes Python code in an isolated, secure E2B micro-VM sandbox with support for:
- Standard output (stdout) & error streams (stderr)
- Data science, ML & numerical math (NumPy, SciPy, Pandas, SymPy, Scikit-Learn, PyTorch)
- Plotting & Visual figures (Matplotlib, Seaborn, Plotly) converted into base64 images
- Dynamic on-the-fly dependency installation if missing modules are detected
- File artifact capture (PDF reports, CSV datasets, Excel sheets, text files)
- Optional asynchronous webhook notifications upon completion.
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
    webhook_delivered: Optional[bool] = None
    webhook_status: Optional[str] = None  # "delivered" | "rate_limited" | "failed" | "not_configured"
    webhook_url: Optional[str] = None  # Masked target URL
    webhook_error: Optional[str] = None  # Human-readable failure/rate-limit explanation


def patch_fpdf_unicode_code(code: str) -> str:
    """
    Self-heals Python code that generates PDFs via fpdf/fpdf2 when encountering
    Unicode encoding limitations (FPDFUnicodeEncodingException).
    1. Replaces common non-Latin-1 unicode punctuation with safe ASCII equivalents.
    2. Registers Linux DejaVu TrueType fonts and switches font family to 'DejaVu'.
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
    }
    patched = code
    for char, rep in replacements.items():
        patched = patched.replace(char, rep)

    if "FPDF" in patched:
        font_inject = '''
# Auto-injected DejaVu TrueType Unicode font for fpdf2
import os as _os
_dj_reg = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
_dj_b = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
if _os.path.exists(_dj_reg):
    try:
        pdf.add_font("DejaVu", "", _dj_reg)
        pdf.add_font("DejaVu", "B", _dj_b if _os.path.exists(_dj_b) else _dj_reg)
        pdf.set_font("DejaVu", size=10)
    except Exception:
        pass
'''
        # Switch helvetica / arial / times font calls to DejaVu
        patched = re.sub(
            r'set_font\(\s*["\'](helvetica|arial|times)["\']',
            'set_font("DejaVu"',
            patched,
            flags=re.IGNORECASE,
        )

        pdf_init_match = re.search(r'(\w+)\s*=\s*FPDF\s*\([^)]*\)', patched)
        if pdf_init_match:
            var_name = pdf_init_match.group(1)
            inject_code = font_inject.replace("pdf.", f"{var_name}.")
            end_pos = pdf_init_match.end()
            patched = patched[:end_pos] + "\n" + inject_code + patched[end_pos:]

    return patched


class E2BSandboxService:
    """Client for E2B Code Interpreter micro-VMs."""

    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or settings.E2B_API_KEY
        if self.api_key:
            os.environ["E2B_API_KEY"] = self.api_key

    async def execute_code(
        self,
        code: str,
        timeout_sec: Optional[int] = None,
        auto_install: bool = True,
        webhook_url: Optional[str] = None,
        webhook_secret: Optional[str] = None,
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
        webhook_url : str, optional
            Optional webhook endpoint to receive asynchronous notification upon completion.
        webhook_secret : str, optional
            Optional HMAC-SHA256 signature secret.

        Returns
        -------
        SandboxExecutionResult
        """
        eff_webhook_url = webhook_url or settings.SANDBOX_WEBHOOK_URL
        eff_webhook_secret = webhook_secret or settings.SANDBOX_WEBHOOK_SECRET

        if not self.api_key:
            res = SandboxExecutionResult(
                success=False,
                error="E2B_API_KEY is not configured in environment.",
                stdout="",
                stderr="",
            )
            if eff_webhook_url:
                from app.external_services.webhook_dispatcher import webhook_dispatcher
                webhook_dispatcher.dispatch_background(eff_webhook_url, "sandbox.execution.failed", res.model_dump(), eff_webhook_secret)
            return res

        timeout = timeout_sec or settings.PYTHON_SANDBOX_TIMEOUT_SEC
        start_time = time.perf_counter()
        installed_packages: list[str] = []

        if eff_webhook_url:
            from app.external_services.webhook_dispatcher import webhook_dispatcher
            webhook_dispatcher.dispatch_background(
                eff_webhook_url,
                "sandbox.execution.started",
                {"code_length": len(code), "timeout": timeout},
                eff_webhook_secret,
            )

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

                execution = await sbx.run_code(code)

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
                            # Re-run after installation
                            execution = await sbx.run_code(code)

                # Automatic font/Unicode self-healing for PDF generation (FPDFUnicodeEncodingException)
                if execution.error and (
                    "FPDFUnicodeEncodingException" in str(execution.error.name)
                    or "outside the range of characters supported" in str(execution.error.value)
                    or "UnicodeEncodeError" in str(execution.error.name)
                    or "latin-1" in str(execution.error.value)
                ):
                    logger.info("sandbox.auto_heal_unicode", error_name=execution.error.name)
                    patched_code = patch_fpdf_unicode_code(code)
                    if patched_code != code:
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

                webhook_delivered = None
                webhook_status = "not_configured"
                masked_webhook_url = None
                webhook_error = None

                if eff_webhook_url:
                    masked_webhook_url = (
                        eff_webhook_url[:18] + "..." + eff_webhook_url[-8:]
                        if len(eff_webhook_url) > 26
                        else eff_webhook_url
                    )
                    from app.external_services.webhook_dispatcher import webhook_dispatcher
                    event_type = "sandbox.execution.completed" if success else "sandbox.execution.failed"
                    payload_data = {
                        "success": success,
                        "duration_ms": duration_ms,
                        "stdout": stdout_text,
                        "stderr": stderr_text,
                        "error": error_msg,
                        "images_count": len(image_results),
                        "artifacts": [a.model_dump() for a in artifacts],
                        "packages_installed": installed_packages,
                    }
                    try:
                        ok, st_code, st_body, _ = await webhook_dispatcher.dispatch_with_details(
                            webhook_url=eff_webhook_url,
                            event_name=event_type,
                            data=payload_data,
                            secret=eff_webhook_secret,
                            max_retries=settings.SANDBOX_WEBHOOK_RETRIES,
                            timeout_sec=settings.SANDBOX_WEBHOOK_TIMEOUT_SEC,
                        )
                        webhook_delivered = ok
                        if ok:
                            webhook_status = "delivered"
                        elif st_code == 429:
                            webhook_status = "rate_limited"
                            webhook_error = "Webhook endpoint request limit exceeded (HTTP 429). Update SANDBOX_WEBHOOK_URL."
                        else:
                            webhook_status = "failed"
                            webhook_error = f"HTTP {st_code}: {st_body[:60] if st_body else 'Failed'}"
                    except Exception as w_exc:
                        webhook_delivered = False
                        webhook_status = "failed"
                        webhook_error = str(w_exc)

                    # Also notify per-artifact creation
                    if artifacts:
                        for art in artifacts:
                            webhook_dispatcher.dispatch_background(
                                eff_webhook_url,
                                "sandbox.artifact.created",
                                {
                                    "filename": art.filename,
                                    "mime_type": art.mime_type,
                                    "size_bytes": art.size_bytes,
                                },
                                eff_webhook_secret,
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
                    webhook_delivered=webhook_delivered,
                    webhook_status=webhook_status,
                    webhook_url=masked_webhook_url,
                    webhook_error=webhook_error,
                )

        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error("sandbox.execution_failed", exc=str(exc))
            masked_webhook_url = (
                eff_webhook_url[:18] + "..." + eff_webhook_url[-8:]
                if eff_webhook_url and len(eff_webhook_url) > 26
                else eff_webhook_url
            )
            err_result = SandboxExecutionResult(
                success=False,
                error=f"Sandbox Execution Error: {str(exc)}",
                stdout="",
                stderr="",
                duration_ms=duration_ms,
                webhook_url=masked_webhook_url,
                webhook_status="failed" if eff_webhook_url else "not_configured",
            )
            if eff_webhook_url:
                from app.external_services.webhook_dispatcher import webhook_dispatcher
                webhook_dispatcher.dispatch_background(
                    eff_webhook_url,
                    "sandbox.execution.failed",
                    err_result.model_dump(),
                    eff_webhook_secret,
                )
            return err_result

    async def execute_code_stream(
        self,
        code: str,
        timeout_sec: Optional[int] = None,
        auto_install: bool = True,
        webhook_url: Optional[str] = None,
        webhook_secret: Optional[str] = None,
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

        eff_webhook_url = webhook_url or settings.SANDBOX_WEBHOOK_URL
        eff_webhook_secret = webhook_secret or settings.SANDBOX_WEBHOOK_SECRET

        if not self.api_key:
            err_msg = "E2B_API_KEY is not configured in environment."
            yield f"event: error\ndata: {json.dumps({'error': err_msg})}\n\n"
            return

        timeout = timeout_sec or settings.PYTHON_SANDBOX_TIMEOUT_SEC
        start_time = time.perf_counter()
        installed_packages: list[str] = []

        if eff_webhook_url:
            from app.external_services.webhook_dispatcher import webhook_dispatcher
            webhook_dispatcher.dispatch_background(
                eff_webhook_url,
                "sandbox.execution.started",
                {"code_length": len(code), "timeout": timeout},
                eff_webhook_secret,
            )

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

                run_task = asyncio.create_task(
                    sbx.run_code(
                        code,
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
                            run_task = asyncio.create_task(
                                sbx.run_code(
                                    code,
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

                # Automatic font/Unicode self-healing for PDF generation (FPDFUnicodeEncodingException)
                if execution.error and (
                    "FPDFUnicodeEncodingException" in str(execution.error.name)
                    or "outside the range of characters supported" in str(execution.error.value)
                    or "UnicodeEncodeError" in str(execution.error.name)
                    or "latin-1" in str(execution.error.value)
                ):
                    yield f"event: status\ndata: {json.dumps({'step': 'healing', 'message': 'The sandbox is running: Applying font encoding patch...'})}\n\n"
                    logger.info("sandbox.auto_heal_unicode", error_name=execution.error.name)
                    patched_code = patch_fpdf_unicode_code(code)
                    if patched_code != code:
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

                # Silent background webhook delivery on server side
                if eff_webhook_url:
                    from app.external_services.webhook_dispatcher import webhook_dispatcher
                    event_type = "sandbox.execution.completed" if success else "sandbox.execution.failed"
                    payload_data = {
                        "success": success,
                        "duration_ms": duration_ms,
                        "stdout": stdout_text,
                        "stderr": stderr_text,
                        "error": error_msg,
                        "images_count": len(image_results),
                        "artifacts": [a.model_dump() for a in artifacts],
                        "packages_installed": installed_packages,
                    }
                    webhook_dispatcher.dispatch_background(eff_webhook_url, event_type, payload_data, eff_webhook_secret)

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


e2b_sandbox_service = E2BSandboxService()
