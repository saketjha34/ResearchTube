"""
app.external_services.webhook_dispatcher — Asynchronous Webhook Notification Service.

Delivers JSON payloads to configured external webhook URLs with optional HMAC-SHA256 signatures,
exponential backoff retries, and detailed delivery metrics.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger("webhook_dispatcher")

# Recognized canonical event types
EVENT_SANDBOX_STARTED = "sandbox.execution.started"
EVENT_SANDBOX_COMPLETED = "sandbox.execution.completed"
EVENT_SANDBOX_FAILED = "sandbox.execution.failed"
EVENT_SANDBOX_ARTIFACT_CREATED = "sandbox.artifact.created"
EVENT_SANDBOX_TOOL_INVOKED = "sandbox.tool.invoked"
EVENT_SANDBOX_PING = "sandbox.webhook.ping"

SUPPORTED_EVENTS = [
    EVENT_SANDBOX_STARTED,
    EVENT_SANDBOX_COMPLETED,
    EVENT_SANDBOX_FAILED,
    EVENT_SANDBOX_ARTIFACT_CREATED,
    EVENT_SANDBOX_TOOL_INVOKED,
    EVENT_SANDBOX_PING,
]


class WebhookDispatcher:
    """Dispatches webhook events to external listener URLs."""

    @staticmethod
    def compute_signature(payload_bytes: bytes, secret: str) -> str:
        """Generate HMAC-SHA256 hex digest for payload verification."""
        mac = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256)
        return f"sha256={mac.hexdigest()}"

    @staticmethod
    def verify_signature(payload_bytes: bytes, signature_header: str, secret: str) -> bool:
        """Validate an incoming HMAC-SHA256 signature using constant-time comparison."""
        if not signature_header or not signature_header.startswith("sha256="):
            return False
        expected = WebhookDispatcher.compute_signature(payload_bytes, secret)
        return hmac.compare_digest(expected, signature_header)

    async def dispatch_with_details(
        self,
        webhook_url: str,
        event_name: str,
        data: Dict[str, Any],
        secret: Optional[str] = None,
        max_retries: int = 1,
        timeout_sec: float = 10.0,
    ) -> Tuple[bool, Optional[int], Optional[str], float]:
        """
        Send a webhook event and return (success, status_code, response_body_snippet, latency_ms).
        """
        payload = {
            "event": event_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }
        payload_bytes = json.dumps(payload, default=str).encode("utf-8")
        eff_secret = secret or settings.SANDBOX_WEBHOOK_SECRET

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "ResearchTube-Webhook/1.0",
            "X-ResearchTube-Event": event_name,
            "X-ResearchTube-Timestamp": payload["timestamp"],
        }
        if eff_secret:
            headers["X-ResearchTube-Signature"] = self.compute_signature(payload_bytes, eff_secret)

        last_status = None
        last_body = None
        start_time = time.perf_counter()

        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout_sec) as client:
                    resp = await client.post(webhook_url, content=payload_bytes, headers=headers)
                    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    last_status = resp.status_code
                    last_body = resp.text[:500] if resp.text else None

                    if resp.is_success:
                        logger.info(
                            "webhook.delivered",
                            url=webhook_url,
                            event_type=event_name,
                            status=resp.status_code,
                            attempt=attempt,
                            latency_ms=elapsed_ms,
                        )
                        return True, last_status, last_body, elapsed_ms
                    elif resp.status_code == 429:
                        logger.warning(
                            "webhook.rate_limited",
                            url=webhook_url,
                            status=429,
                            body=last_body,
                            attempt=attempt,
                            hint="Target webhook endpoint (e.g. Webhook.site) exceeded free request quota. Aborting retries.",
                        )
                        # Do not retry on 429 — target quota is full, retrying will only fail
                        return False, 429, "Rate limit / quota exceeded on webhook endpoint (HTTP 429).", elapsed_ms
                    else:
                        logger.warning(
                            "webhook.http_error",
                            url=webhook_url,
                            status=resp.status_code,
                            body=last_body,
                            attempt=attempt,
                        )
            except Exception as exc:
                elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
                last_body = str(exc)
                logger.warning(
                    "webhook.attempt_failed",
                    url=webhook_url,
                    attempt=attempt,
                    error=str(exc),
                )
            if attempt < max_retries:
                await asyncio.sleep(1.0 * attempt)

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.error("webhook.exhausted", url=webhook_url, event_type=event_name)
        return False, last_status, last_body, elapsed_ms

    async def dispatch(
        self,
        webhook_url: str,
        event_name: str,
        data: Dict[str, Any],
        secret: Optional[str] = None,
        max_retries: int = 2,
    ) -> bool:
        """Send an asynchronous webhook event with retry (boolean success return)."""
        success, _, _, _ = await self.dispatch_with_details(
            webhook_url=webhook_url,
            event_name=event_name,
            data=data,
            secret=secret,
            max_retries=max_retries,
            timeout_sec=settings.SANDBOX_WEBHOOK_TIMEOUT_SEC,
        )
        return success

    def dispatch_background(
        self,
        webhook_url: str,
        event_name: str,
        data: Dict[str, Any],
        secret: Optional[str] = None,
    ) -> None:
        """Fire-and-forget background webhook delivery task."""
        asyncio.create_task(
            self.dispatch(
                webhook_url=webhook_url,
                event_name=event_name,
                data=data,
                secret=secret,
                max_retries=settings.SANDBOX_WEBHOOK_RETRIES,
            )
        )


webhook_dispatcher = WebhookDispatcher()

compute_signature = WebhookDispatcher.compute_signature
verify_signature = WebhookDispatcher.verify_signature
