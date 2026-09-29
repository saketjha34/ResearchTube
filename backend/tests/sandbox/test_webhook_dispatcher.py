"""
Unit tests for app.external_services.webhook_dispatcher.
"""

import asyncio
from unittest.mock import AsyncMock, patch
import httpx
import pytest

from app.external_services.webhook_dispatcher import (
    EVENT_SANDBOX_PING,
    SUPPORTED_EVENTS,
    WebhookDispatcher,
    compute_signature,
    verify_signature,
)


def test_compute_and_verify_signature():
    """Verify HMAC-SHA256 signature computation and constant-time verification."""
    secret = "my_secret_key_123"
    payload = b'{"event": "sandbox.execution.completed", "status": "ok"}'

    signature = compute_signature(payload, secret)
    assert signature.startswith("sha256=")

    # Valid verification
    assert verify_signature(payload, signature, secret) is True

    # Tampered payload fails
    tampered_payload = b'{"event": "sandbox.execution.completed", "status": "tampered"}'
    assert verify_signature(tampered_payload, signature, secret) is False

    # Wrong secret fails
    assert verify_signature(payload, signature, "wrong_secret") is False

    # Corrupted signature format fails gracefully
    assert verify_signature(payload, "invalid_sig_without_prefix", secret) is False


def test_supported_events_list():
    """Verify standard supported event types are registered."""
    assert EVENT_SANDBOX_PING in SUPPORTED_EVENTS
    assert "sandbox.execution.started" in SUPPORTED_EVENTS
    assert "sandbox.execution.completed" in SUPPORTED_EVENTS
    assert "sandbox.execution.failed" in SUPPORTED_EVENTS
    assert "sandbox.artifact.created" in SUPPORTED_EVENTS
    assert "sandbox.tool.invoked" in SUPPORTED_EVENTS


def test_dispatch_success_200():
    """Verify successful dispatch returns True on HTTP 200."""
    dispatcher = WebhookDispatcher()
    mock_response = httpx.Response(status_code=200, request=httpx.Request("POST", "https://example.com/webhook"))

    async def _run():
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
            success = await dispatcher.dispatch(
                webhook_url="https://example.com/webhook",
                event_name="sandbox.ping",
                data={"test": "data"},
                secret="test_secret",
            )
            assert success is True

    asyncio.run(_run())


def test_dispatch_retries_and_exhausts():
    """Verify dispatch retries upon HTTP 500 and returns False when retries are exhausted."""
    dispatcher = WebhookDispatcher()
    mock_500 = httpx.Response(status_code=500, request=httpx.Request("POST", "https://example.com/webhook"))

    async def _run():
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_500):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                success = await dispatcher.dispatch(
                    webhook_url="https://example.com/webhook",
                    event_name="sandbox.execution.failed",
                    data={"error": "fatal"},
                    max_retries=2,
                )
                assert success is False

    asyncio.run(_run())


def test_dispatch_timeout_handling():
    """Verify network timeouts are handled without crashing."""
    dispatcher = WebhookDispatcher()

    async def _run():
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=httpx.TimeoutException("timeout")):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                success = await dispatcher.dispatch(
                    webhook_url="https://example.com/webhook",
                    event_name="sandbox.ping",
                    data={},
                    max_retries=1,
                )
                assert success is False

    asyncio.run(_run())


def test_dispatch_rate_limited_429_aborts_immediately():
    """Verify HTTP 429 quota exhaustion aborts retries immediately without multiple attempts."""
    dispatcher = WebhookDispatcher()
    mock_429 = httpx.Response(status_code=429, text="Request limit exceeded", request=httpx.Request("POST", "https://example.com/webhook"))

    async def _run():
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_429) as mock_post:
            with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                success, code, body, _ = await dispatcher.dispatch_with_details(
                    webhook_url="https://example.com/webhook",
                    event_name="sandbox.execution.completed",
                    data={"result": "ok"},
                    max_retries=3,
                )
                assert success is False
                assert code == 429
                assert "limit" in body.lower() or "quota" in body.lower()
                # Must abort immediately on attempt 1 without sleeping or retrying 3 times
                assert mock_post.call_count == 1
                mock_sleep.assert_not_called()

    asyncio.run(_run())

