"""add created_at to conversations

Revision ID: d3b190f84a1e
Revises: c1f930e1a400
Create Date: 2026-08-02 13:16:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd3b190f84a1e'
down_revision: Union[str, Sequence[str], None] = 'c1f930e1a400'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'conversations',
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()'))
    )


def downgrade() -> None:
    op.drop_column('conversations', 'created_at')
