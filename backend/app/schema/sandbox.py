"""
app.schema.sandbox — Pydantic Schemas for Python & C++ Sandbox Execution.
"""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class SandboxArtifact(BaseModel):
    """File generated inside the sandbox (e.g. PDF, CSV, Excel, TXT)."""
    filename: str
    mime_type: str
    size_bytes: int
    data_url: str  # Base64 data URL e.g. data:application/pdf;base64,...


# =========================================================================
# Python Sandbox Schemas
# =========================================================================

class ExecutePythonRequest(BaseModel):
    """Request payload for executing code in the Python Sandbox."""

    code: str = Field(..., description="Python source code to execute")
    timeout: Optional[int] = Field(None, description="Optional execution timeout in seconds")


class ExecutePythonResponse(BaseModel):
    """Result returned from Python Sandbox execution."""

    success: bool
    stdout: str = ""
    stderr: str = ""
    error: Optional[str] = None
    results: List[str] = Field(default_factory=list)
    images: List[str] = Field(default_factory=list)
    artifacts: List[SandboxArtifact] = Field(default_factory=list)
    duration_ms: float = 0.0
    packages_installed: List[str] = Field(default_factory=list)


# =========================================================================
# C++ Sandbox Schemas
# =========================================================================

class ExecuteCPPRequest(BaseModel):
    """Request payload for compiling and executing code in the C++ Sandbox."""

    code: str = Field(..., description="C++ source code to compile and execute")
    timeout: Optional[int] = Field(None, description="Optional execution timeout in seconds")
    compiler_flags: Optional[str] = Field(
        None,
        description="Optional g++ compiler flags (defaults to -std=c++20 -O2 -Wall -Wextra)",
    )
    stdin: Optional[str] = Field(None, description="Optional standard input to pass into the compiled binary")


class ExecuteCPPResponse(BaseModel):
    """Result returned from C++ Sandbox compilation and execution."""

    success: bool
    stdout: str = ""
    stderr: str = ""
    error: Optional[str] = None
    compile_output: Optional[str] = None
    compile_time_ms: float = 0.0
    execution_time_ms: float = 0.0
    duration_ms: float = 0.0
    exit_code: Optional[int] = 0
    artifacts: List[SandboxArtifact] = Field(default_factory=list)
