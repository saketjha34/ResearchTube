import pytest
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.config import settings
from app.db.models import User, RefreshToken
from app.services.auth.local_auth_service import LocalAuthService
from app.utils.security_utils import (
    create_access_token,
    decode_access_token,
    create_refresh_token,
    hash_refresh_token,
)


def test_token_lifespan_configuration():
    """Verify that settings reflect the 7-day inactivity and 24-hour access token timeline."""
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 1440  # 24 hours
    assert settings.REFRESH_TOKEN_EXPIRE_DAYS == 7       # 7 days
    assert settings.REFRESH_TOKEN_ROTATION_GRACE_PERIOD_SEC == 30  # 30 seconds


def test_access_token_creation_and_expiration():
    """Verify create_access_token issues a token that expires in 24 hours."""
    user_id = uuid4()
    token = create_access_token(user_id)
    payload = decode_access_token(token)

    assert payload["sub"] == str(user_id)
    assert payload["type"] == "access"

    exp_timestamp = payload["exp"]
    expected_exp = datetime.now(timezone.utc) + timedelta(minutes=1440)
    # Allow 10-second test tolerance
    assert abs(exp_timestamp - int(expected_exp.timestamp())) < 10


@pytest.mark.anyio
async def test_create_refresh_session_sets_seven_days():
    """Verify create_refresh_session creates a token expiring in 7 days."""
    service = LocalAuthService()
    mock_db = AsyncMock()
    mock_user = MagicMock(spec=User)
    mock_user.id = uuid4()

    token = await service.create_refresh_session(mock_db, mock_user)
    assert token is not None

    mock_db.add.assert_called_once()
    saved_session: RefreshToken = mock_db.add.call_args[0][0]

    assert saved_session.user_id == mock_user.id
    assert saved_session.revoked is False
    assert saved_session.revoked_at is None
    assert saved_session.replaced_by_hash is None

    expected_exp = datetime.now(timezone.utc) + timedelta(days=7)
    delta = abs((saved_session.expires_at - expected_exp).total_seconds())
    assert delta < 5


@pytest.mark.anyio
async def test_rotate_refresh_token_extends_sliding_window():
    """Verify rotate_refresh_token marks old token revoked and sets new token with 7 days."""
    service = LocalAuthService()
    mock_db = AsyncMock()
    user_id = uuid4()
    mock_user = MagicMock(spec=User)
    mock_user.id = user_id
    mock_user.is_active = True

    old_raw = create_refresh_token()
    old_hash = hash_refresh_token(old_raw)
    old_session = RefreshToken(
        user_id=user_id,
        token_hash=old_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=5),
        revoked=False,
    )

    # First scalar call returns old_session, second scalar call returns mock_user
    mock_db.scalar = AsyncMock(side_effect=[old_session, mock_user])

    new_access, new_refresh = await service.rotate_refresh_token(mock_db, old_raw)

    assert new_access is not None
    assert new_refresh != old_raw

    # Old session must be marked revoked with audit timestamp & replacement hash
    assert old_session.revoked is True
    assert old_session.revoked_at is not None
    assert old_session.replaced_by_hash == hash_refresh_token(new_refresh)

    # New session must be added
    mock_db.add.assert_called_once()
    new_session: RefreshToken = mock_db.add.call_args[0][0]
    assert new_session.revoked is False
    expected_new_exp = datetime.now(timezone.utc) + timedelta(days=7)
    delta = abs((new_session.expires_at - expected_new_exp).total_seconds())
    assert delta < 5


@pytest.mark.anyio
async def test_rotate_refresh_token_within_grace_period():
    """Verify that a concurrent request using an already-rotated token within grace period succeeds."""
    service = LocalAuthService()
    mock_db = AsyncMock()
    user_id = uuid4()
    mock_user = MagicMock(spec=User)
    mock_user.id = user_id
    mock_user.is_active = True

    raw_token = create_refresh_token()
    token_hash = hash_refresh_token(raw_token)
    now = datetime.now(timezone.utc)

    # Token was rotated 5 seconds ago (well within 30-second grace window)
    recently_revoked_session = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=now + timedelta(days=7),
        revoked=True,
        revoked_at=now - timedelta(seconds=5),
        replaced_by_hash="some_new_hash",
    )

    mock_db.scalar = AsyncMock(side_effect=[recently_revoked_session, mock_user])

    # Should not raise ValueError; returns fresh access token
    new_access, returned_token = await service.rotate_refresh_token(mock_db, raw_token)
    assert new_access is not None
    assert returned_token == raw_token


@pytest.mark.anyio
async def test_rotate_refresh_token_expired_raises_inactivity_error():
    """Verify that a token older than 7 days raises session expired error."""
    service = LocalAuthService()
    mock_db = AsyncMock()
    user_id = uuid4()

    raw_token = create_refresh_token()
    token_hash = hash_refresh_token(raw_token)
    now = datetime.now(timezone.utc)

    expired_session = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=now - timedelta(hours=1),  # Expired
        revoked=False,
    )

    mock_db.scalar = AsyncMock(return_value=expired_session)

    with pytest.raises(ValueError, match="Session expired due to inactivity"):
        await service.rotate_refresh_token(mock_db, raw_token)
