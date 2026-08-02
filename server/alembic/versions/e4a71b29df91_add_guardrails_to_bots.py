"""add guardrails to bots

Revision ID: e4a71b29df91
Revises: d3b190f84a1e
Create Date: 2026-08-02 13:31:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e4a71b29df91'
down_revision: Union[str, Sequence[str], None] = 'd3b190f84a1e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'bots',
        sa.Column('guardrails', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}')
    )


def downgrade() -> None:
    op.drop_column('bots', 'guardrails')
