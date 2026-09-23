"""add video_scope_mode

Revision ID: e2fd1b18f299
Revises: 93f49d9b9997
Create Date: 2026-09-23 15:21:38.735579

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import pgvector.sqlalchemy


# revision identifiers, used by Alembic.
revision: str = 'e2fd1b18f299'
down_revision: Union[str, None] = '93f49d9b9997'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Safely add scope_mode column to chat_sessions
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'chat_sessions' AND column_name = 'scope_mode'
            ) THEN
                ALTER TABLE chat_sessions ADD COLUMN scope_mode VARCHAR(32) NOT NULL DEFAULT 'none';
            END IF;
        END $$;
    """)

    # 2. Create index on scope_mode if not exists
    op.execute("CREATE INDEX IF NOT EXISTS ix_chat_sessions_scope_mode ON chat_sessions (scope_mode);")

    # 3. Backfill existing video-scoped sessions
    op.execute("""
        UPDATE chat_sessions 
        SET scope_mode = 'video' 
        WHERE video_id IS NOT NULL AND (scope_mode IS NULL OR scope_mode = 'none');
    """)

    # 4. Safely ensure share_token constraint / index is consistent without failing if constraint is absent
    op.execute("ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_share_token_key;")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_chat_sessions_share_token ON chat_sessions (share_token);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_chat_sessions_scope_mode;")
    op.execute("ALTER TABLE chat_sessions DROP COLUMN IF EXISTS scope_mode;")
