"""
app.schema.sandbox — Pydantic Schemas for Python Sandbox Execution & Webhooks.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SandboxArtifact(BaseModel):
    """File generated inside the sandbox (e.g. PDF, CSV, Excel, TXT)."""
    filename: str
    mime_type: str
    size_bytes: int
    data_url: str  # Base64 data URL e.g. data:application/pdf;base64,...


class ExecutePythonRequest(BaseModel):
    """Request payload for executing code in the Python Sandbox."""

    code: str = Field(..., description="Python source code to execute")
    timeout: Optional[int] = Field(None, description="Optional execution timeout in seconds")
    webhook_url: Optional[str] = Field(None, description="Optional webhook URL to notify when execution completes")
    webhook_secret: Optional[str] = Field(None, description="Optional secret for HMAC-SHA256 webhook signature")


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
    webhook_delivered: Optional[bool] = None
    webhook_status: Optional[str] = None  # "delivered" | "rate_limited" | "failed" | "not_configured"
    webhook_url: Optional[str] = None  # Masked target URL
    webhook_error: Optional[str] = None  # Friendly error / limit explanation if any


class WebhookTestRequest(BaseModel):
    """Request to test a webhook endpoint with a ping event."""
    url: str = Field(..., description="The target webhook endpoint URL to test")
    secret: Optional[str] = Field(None, description="Optional secret key for signature verification")


class WebhookTestResponse(BaseModel):
    """Result of webhook connectivity test."""
    success: bool
    status_code: Optional[int] = None
    message: str
    response_body: Optional[str] = None
    latency_ms: Optional[float] = None


class WebhookTriggerRequest(BaseModel):
    """Request to trigger a simulated webhook event."""
    url: Optional[str] = Field(None, description="Target webhook URL (defaults to configured SANDBOX_WEBHOOK_URL)")
    event: str = Field("sandbox.execution.completed", description="Webhook event name to dispatch")
    secret: Optional[str] = Field(None, description="Secret key for signature verification")
    payload: Optional[Dict[str, Any]] = Field(None, description="Custom event data payload")


class WebhookTriggerResponse(BaseModel):
    """Result of triggering a simulated webhook event."""
    success: bool
    event: str
    status_code: Optional[int] = None
    message: str
    response_body: Optional[str] = None
    latency_ms: Optional[float] = None


class WebhookConfigResponse(BaseModel):
    """Current webhook subsystem configuration status."""
    enabled: bool
    default_webhook_url: Optional[str] = None  # Masked if configured
    has_secret: bool
    max_retries: int
    timeout_sec: float
    supported_events: List[str]
