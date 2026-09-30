"""
app.tools.cpp_sandbox — LangChain Tool for compiling and executing C++ code in the sandbox.
"""

from __future__ import annotations

import asyncio
from typing import Optional, Tuple
from langchain_core.tools import tool

from app.core.config import settings
from app.external_services.e2b_sandbox import CPPSandboxExecutionResult, e2b_sandbox_service


def format_cpp_sandbox_result_for_llm(result: CPPSandboxExecutionResult) -> str:
    """Format a CPPSandboxExecutionResult into a structured textual report for the LLM."""
    output_parts = []
    if result.compile_output:
        output_parts.append(f"[COMPILER OUTPUT ({result.compile_time_ms:.1f}ms)]\n{result.compile_output}")
    if result.stdout:
        output_parts.append(f"[STDOUT ({result.execution_time_ms:.1f}ms)]\n{result.stdout}")
    if result.stderr:
        output_parts.append(f"[STDERR]\n{result.stderr}")
    if result.artifacts:
        output_parts.append(
            f"[{len(result.artifacts)} file artifact(s) created: "
            + ", ".join(f"{a.filename} ({a.size_bytes} bytes)" for a in result.artifacts)
            + "]"
        )
    if result.exit_code != 0 and result.exit_code is not None:
        output_parts.append(f"[EXIT CODE]\n{result.exit_code}")
    if result.error:
        output_parts.append(f"[ERROR]\n{result.error}")

    if not output_parts:
        return f"[C++ code compiled and executed successfully with exit code 0 ({result.duration_ms:.1f}ms)]"

    return "\n\n".join(output_parts)


async def execute_cpp_code_async(
    code: str,
    compiler_flags: Optional[str] = None,
    stdin: Optional[str] = None,
) -> Tuple[str, CPPSandboxExecutionResult]:
    """
    Asynchronously compile and run C++ code in the E2B sandbox micro-VM.
    Returns (formatted_text_summary, execution_result_object).
    """
    result = await e2b_sandbox_service.execute_cpp_code(
        code=code,
        compiler_flags=compiler_flags,
        stdin=stdin,
    )
    formatted = format_cpp_sandbox_result_for_llm(result)
    return formatted, result


@tool
def execute_cpp_code(code: str, stdin: Optional[str] = None) -> str:
    """
    Compile and execute modern C++ code (C++20) in an isolated E2B micro-VM sandbox.

    Capabilities:
    - Compiles with g++ (-std=c++20 -O2 -Wall -Wextra)
    - Full C++ standard library support (STL: vector, map, set, algorithms, numeric, regex, ranges, concepts)
    - Supports standard input via the stdin parameter
    - File artifact generation (CSVs, TXT reports, binary files created by the executable are automatically captured)
    - Returns compiler warnings/errors, execution stdout/stderr, runtime exit codes, and duration metrics.

    Args:
        code: The C++ source code to compile and execute.
        stdin: Optional input text to provide to standard input (cin).

    Returns:
        Formatted execution output, compilation messages, printed stdout, errors, and created file artifacts.
    """
    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                result = pool.submit(asyncio.run, e2b_sandbox_service.execute_cpp_code(code, stdin=stdin)).result()
        else:
            result = asyncio.run(e2b_sandbox_service.execute_cpp_code(code, stdin=stdin))

        return format_cpp_sandbox_result_for_llm(result)

    except Exception as exc:
        return f"[C++ Sandbox Execution Error]: {str(exc)}"
