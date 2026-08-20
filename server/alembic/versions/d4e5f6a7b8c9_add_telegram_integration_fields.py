"""add telegram integration fields

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-20 20:07:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bots', sa.Column('telegram_bot_token', sa.String(), nullable=True))
    op.add_column('conversations', sa.Column('channel', sa.String(), nullable=False, server_default='web'))
    op.add_column('conversations', sa.Column('external_chat_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('conversations', 'external_chat_id')
    op.drop_column('conversations', 'channel')
    op.drop_column('bots', 'telegram_bot_token')
