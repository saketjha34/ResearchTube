from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    String,
    Text,
    func,
)

from sqlalchemy.dialects.postgresql import UUID as PGUUID

from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.db.database import Base


if TYPE_CHECKING:

    from app.db.models.auth import (
        OAuthAccount,
        RefreshToken,
        UserAuth,
    )

    from app.db.models.youtube import ResearchRun


# ============================================================
# USER
# ============================================================

class User(Base):

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    email: Mapped[str] = mapped_column(
        String(320),
        unique=True,
        nullable=False,
        index=True,
    )

    username: Mapped[Optional[str]] = mapped_column(
        String(100),
        unique=True,
        nullable=True,
    )

    full_name: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
    )

    profile_picture_url: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ========================================================
    # AUTH RELATIONSHIPS
    # ========================================================

    auth: Mapped[Optional["UserAuth"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )

    oauth_accounts: Mapped[List["OAuthAccount"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # ========================================================
    # RESEARCH
    # ========================================================

    research_runs: Mapped[List["ResearchRun"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )