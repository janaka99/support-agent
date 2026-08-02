"""force rls

Revision ID: ba044ab82697
Revises: fa77c4d4d0bd
Create Date: 2026-08-01 14:20:45.825341

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ba044ab82697'
down_revision: Union[str, Sequence[str], None] = 'fa77c4d4d0bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables_for_rls = ['users', 'conversations', 'messages', 'agents']
    for table in tables_for_rls:
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")


def downgrade() -> None:
    tables_for_rls = ['users', 'conversations', 'messages', 'agents']
    for table in tables_for_rls:
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;")
