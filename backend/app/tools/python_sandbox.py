"""
app.tools.python_sandbox — LangChain Tool for executing Python code in the sandbox.
"""

from __future__ import annotations

import asyncio
from typing import Optional, Tuple
from langchain_core.tools import tool

from app.core.config import settings
from app.external_services.e2b_sandbox import SandboxExecutionResult, e2b_sandbox_service


def format_sandbox_result_for_llm(result: SandboxExecutionResult) -> str:
    """Format a SandboxExecutionResult into a structured textual report for the LLM."""
    output_parts = []
    if result.stdout:
        output_parts.append(f"[STDOUT]\n{result.stdout}")
    if result.stderr:
        output_parts.append(f"[STDERR]\n{result.stderr}")
    if result.results:
        output_parts.append(f"[RESULTS]\n" + "\n".join(result.results))
    if result.images:
        output_parts.append(f"[{len(result.images)} chart/image(s) generated successfully and captured]")
    if result.artifacts:
        output_parts.append(
            f"[{len(result.artifacts)} file artifact(s) created: "
            + ", ".join(f"{a.filename} ({a.size_bytes} bytes)" for a in result.artifacts)
            + "]"
        )
    if result.packages_installed:
        output_parts.append(f"[PACKAGES INSTALLED]\n" + ", ".join(result.packages_installed))
    if result.error:
        output_parts.append(f"[ERROR]\n{result.error}")

    if not output_parts:
        return "[Code executed successfully with no printed output]"

    return "\n\n".join(output_parts)


async def execute_python_code_async(
    code: str,
    webhook_url: Optional[str] = None,
    webhook_secret: Optional[str] = None,
) -> Tuple[str, SandboxExecutionResult]:
    """
    Asynchronously run Python code in the E2B sandbox micro-VM.
    Returns (formatted_text_summary, execution_result_object).
    """
    eff_webhook_url = webhook_url or settings.SANDBOX_WEBHOOK_URL
    eff_webhook_secret = webhook_secret or settings.SANDBOX_WEBHOOK_SECRET

    result = await e2b_sandbox_service.execute_code(
        code=code,
        webhook_url=eff_webhook_url,
        webhook_secret=eff_webhook_secret,
    )
    formatted = format_sandbox_result_for_llm(result)
    return formatted, result


@tool
def execute_python_code(code: str) -> str:
    """
    Execute Python code in an isolated E2B micro-VM sandbox.

    Capabilities:
    - NumPy, SciPy, Pandas, SymPy, Scikit-Learn, PyTorch
    - Plotting & charts with Matplotlib and Seaborn (auto-captured as images)
    - Generating documents and file artifacts (e.g. PDFs using fpdf2/reportlab, CSVs, Excel, JSON)
    - Automatically installs any missing Python packages on the fly.

    Args:
        code: The Python source code to execute.

    Returns:
        Formatted execution output, printed stdout, errors, and confirmation of generated charts and files.
    """
    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                result = pool.submit(asyncio.run, e2b_sandbox_service.execute_code(code)).result()
        else:
            result = asyncio.run(e2b_sandbox_service.execute_code(code))

        return format_sandbox_result_for_llm(result)

    except Exception as exc:
        return f"[Sandbox Execution Error]: {str(exc)}"
