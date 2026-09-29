"""
Unit tests for FastAPI sandbox routes (app.routes.sandbox).
"""

from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from app.external_services.e2b_sandbox import SandboxExecutionResult
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_get_webhook_config():
    """Verify GET /sandbox/webhooks/config returns current configuration status."""
    response = client.get("/sandbox/webhooks/config")
    assert response.status_code == 200
    data = response.json()
    assert "enabled" in data
    assert "supported_events" in data
    assert isinstance(data["supported_events"], list)
    assert "sandbox.execution.started" in data["supported_events"]


def test_post_sandbox_execute_route():
    """Verify POST /sandbox/execute executes code and returns structured payload."""
    mock_res = SandboxExecutionResult(
        success=True,
        stdout="computed result = 100\n",
        duration_ms=45.2,
    )

    with patch("app.routes.sandbox.e2b_sandbox_service.execute_code", new_callable=AsyncMock, return_value=mock_res):
        response = client.post(
            "/sandbox/execute",
            json={"code": "x = 10; print(f'computed result = {x**2}')", "timeout": 30},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "computed result = 100" in data["stdout"]
        assert data["duration_ms"] == 45.2


def test_post_webhook_trigger():
    """Verify POST /sandbox/webhooks/trigger sends custom event."""
    with patch(
        "app.routes.sandbox.webhook_dispatcher.dispatch_with_details",
        new_callable=AsyncMock,
        return_value=(True, 200, "OK", 15.2),
    ):
        response = client.post(
            "/sandbox/webhooks/trigger",
            json={
                "url": "https://example.com/hook",
                "event": "sandbox.tool.invoked",
                "payload": {"status": "ok"},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["event"] == "sandbox.tool.invoked"
        assert data["status_code"] == 200


def test_post_webhook_test():
    """Verify POST /sandbox/webhooks/test sends ping event."""
    with patch(
        "app.routes.sandbox.webhook_dispatcher.dispatch_with_details",
        new_callable=AsyncMock,
        return_value=(True, 200, "OK", 22.1),
    ):
        response = client.post(
            "/sandbox/webhooks/test",
            json={
                "url": "https://example.com/test-hook",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["status_code"] == 200
