"""update auth  schema

Revision ID: 6ca5b06d6718
Revises: e2fd1b18f299
Create Date: 2026-10-03 17:08:01.530097

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import pgvector.sqlalchemy
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '6ca5b06d6718'
down_revision: Union[str, None] = 'e2fd1b18f299'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS replaced_by_hash TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS replaced_by_hash")
    op.execute("ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS revoked_at")
