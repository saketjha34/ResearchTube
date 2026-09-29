"""
app.routes.sandbox — Dedicated Sandbox, Code Interpreter & Webhook Endpoints.

Mounts routes under `/sandbox` for isolated code execution in micro-VMs,
capturing outputs, visual figures, file artifacts, and webhook delivery.
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
import structlog

from app.core.config import settings
from app.core.limiter import limiter
from app.external_services.e2b_sandbox import e2b_sandbox_service
from app.external_services.webhook_dispatcher import (
    SUPPORTED_EVENTS,
    EVENT_SANDBOX_PING,
    webhook_dispatcher,
)
from app.schema.sandbox import (
    ExecutePythonRequest,
    ExecutePythonResponse,
    WebhookConfigResponse,
    WebhookTestRequest,
    WebhookTestResponse,
    WebhookTriggerRequest,
    WebhookTriggerResponse,
)

logger = structlog.get_logger("sandbox_routes")

router = APIRouter(
    prefix="/sandbox",
    tags=["Sandbox"],
)


@router.post(
    "/execute",
    response_model=ExecutePythonResponse,
    summary="Execute Python code in isolated sandbox",
)
@router.post(
    "/execute-python",
    response_model=ExecutePythonResponse,
    include_in_schema=False,
)
@limiter.limit("30/minute")
async def execute_python(
    request: Request,
    payload: ExecutePythonRequest,
) -> ExecutePythonResponse:
    """
    Run arbitrary Python code in an isolated E2B micro-VM sandbox.
    Captures stdout, stderr, errors, return values, generated visual charts,
    newly created file artifacts (PDFs, CSVs, Excel), and dispatches webhooks.
    """
    logger.info("sandbox.route_request", code_len=len(payload.code), has_webhook=bool(payload.webhook_url))

    result = await e2b_sandbox_service.execute_code(
        code=payload.code,
        timeout_sec=payload.timeout,
        webhook_url=payload.webhook_url,
        webhook_secret=payload.webhook_secret,
    )

    return ExecutePythonResponse(
        success=result.success,
        stdout=result.stdout,
        stderr=result.stderr,
        error=result.error,
        results=result.results,
        images=result.images,
        artifacts=result.artifacts,
        duration_ms=result.duration_ms,
        packages_installed=result.packages_installed,
        webhook_delivered=result.webhook_delivered,
        webhook_status=result.webhook_status,
        webhook_url=result.webhook_url,
        webhook_error=result.webhook_error,
    )


@router.post(
    "/stream",
    summary="Execute Python code with real-time SSE progression stream",
)
@router.post(
    "/execute-stream",
    include_in_schema=False,
)
@limiter.limit("30/minute")
async def execute_python_stream(
    request: Request,
    payload: ExecutePythonRequest,
) -> StreamingResponse:
    """
    Run arbitrary Python code in an isolated E2B micro-VM sandbox with real-time SSE streaming.
    Streams continuous progression:
    - `event: status`: Real-time stage updates ("The sandbox is running...")
    - `event: stdout`: Chunks of printed output in real time
    - `event: stderr`: Error output in real time
    - `event: figure`: Base64 chart figures as generated
    - `event: done`: Final structured execution payload
    - `event: error`: Fatal execution error
    """
    logger.info("sandbox.route_stream_request", code_len=len(payload.code))
    return StreamingResponse(
        e2b_sandbox_service.execute_code_stream(
            code=payload.code,
            timeout_sec=payload.timeout,
            webhook_url=payload.webhook_url,
            webhook_secret=payload.webhook_secret,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )



@router.get(
    "/webhooks/config",
    response_model=WebhookConfigResponse,
    summary="Get current webhook configuration status",
)
async def get_webhook_config(request: Request) -> WebhookConfigResponse:
    """
    Inspect the current webhook subsystem status, configured limits, and supported events.
    """
    raw_url = settings.SANDBOX_WEBHOOK_URL
    masked_url: Optional[str] = None
    if raw_url:
        if len(raw_url) > 15:
            masked_url = raw_url[:8] + "..." + raw_url[-6:]
        else:
            masked_url = "***"

    return WebhookConfigResponse(
        enabled=bool(settings.SANDBOX_WEBHOOK_URL),
        default_webhook_url=masked_url,
        has_secret=bool(settings.SANDBOX_WEBHOOK_SECRET),
        max_retries=settings.SANDBOX_WEBHOOK_RETRIES,
        timeout_sec=settings.SANDBOX_WEBHOOK_TIMEOUT_SEC,
        supported_events=SUPPORTED_EVENTS,
    )


@router.post(
    "/webhooks/test",
    response_model=WebhookTestResponse,
    summary="Test connectivity to a webhook endpoint",
)
@limiter.limit("10/minute")
async def test_webhook(
    request: Request,
    payload: WebhookTestRequest,
) -> WebhookTestResponse:
    """
    Send a ping event to verify that an external webhook listener URL is reachable and accepting requests.
    """
    logger.info("sandbox.test_webhook", url=payload.url)

    success, status_code, body, latency_ms = await webhook_dispatcher.dispatch_with_details(
        webhook_url=payload.url,
        event_name=EVENT_SANDBOX_PING,
        data={
            "message": "ResearchTube webhook test ping.",
            "status": "connected",
        },
        secret=payload.secret,
        max_retries=1,
    )

    if success:
        return WebhookTestResponse(
            success=True,
            status_code=status_code or 200,
            message="Webhook ping successfully delivered.",
            response_body=body,
            latency_ms=latency_ms,
        )
    return WebhookTestResponse(
        success=False,
        status_code=status_code or 500,
        message="Failed to deliver webhook ping. Please check that the URL is public and responding to POST requests.",
        response_body=body,
        latency_ms=latency_ms,
    )


@router.post(
    "/webhooks/trigger",
    response_model=WebhookTriggerResponse,
    summary="Trigger a simulated webhook event",
)
@limiter.limit("10/minute")
async def trigger_webhook(
    request: Request,
    payload: WebhookTriggerRequest,
) -> WebhookTriggerResponse:
    """
    Simulate and dispatch any supported webhook event (e.g. sandbox.execution.completed)
    to verify payload reception and HMAC signature validation on the receiver.
    """
    target_url = payload.url or settings.SANDBOX_WEBHOOK_URL
    if not target_url:
        return WebhookTriggerResponse(
            success=False,
            event=payload.event,
            message="No webhook URL specified in request or environment configuration.",
        )

    event_data = payload.payload or {
        "simulation": True,
        "sample_metric": 42,
        "description": f"Simulated dispatch for event '{payload.event}'",
    }

    success, status_code, body, latency_ms = await webhook_dispatcher.dispatch_with_details(
        webhook_url=target_url,
        event_name=payload.event,
        data=event_data,
        secret=payload.secret,
        max_retries=1,
    )

    return WebhookTriggerResponse(
        success=success,
        event=payload.event,
        status_code=status_code,
        message="Simulated webhook event delivered." if success else "Simulated webhook event failed delivery.",
        response_body=body,
        latency_ms=latency_ms,
    )
