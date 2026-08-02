"""add usage logs

Revision ID: e89a01bf1920
Revises: ba044ab82697
Create Date: 2026-08-01 23:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e89a01bf1920'
down_revision: Union[str, Sequence[str], None] = 'ba044ab82697'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'usage_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('org_id', sa.UUID(), nullable=False),
        sa.Column('conversation_id', sa.UUID(), nullable=True),
        sa.Column('node_name', sa.String(), nullable=True),
        sa.Column('model', sa.String(), nullable=False),
        sa.Column('prompt_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completion_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cost_usd', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ),
        sa.ForeignKeyConstraint(['org_id'], ['orgs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_usage_logs_org_id'), 'usage_logs', ['org_id'], unique=False)
    op.create_index(op.f('ix_usage_logs_conversation_id'), 'usage_logs', ['conversation_id'], unique=False)
    
    # Setup RLS
    op.execute("ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE usage_logs FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY usage_logs_org_isolation ON usage_logs
        USING (
            (current_setting('app.current_user_role', true) = 'superuser')
            OR
            (org_id = current_setting('app.current_org_id', true)::uuid)
        )
        WITH CHECK (
            (current_setting('app.current_user_role', true) = 'superuser')
            OR
            (org_id = current_setting('app.current_org_id', true)::uuid)
        );
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS usage_logs_org_isolation ON usage_logs;")
    op.drop_index(op.f('ix_usage_logs_conversation_id'), table_name='usage_logs')
    op.drop_index(op.f('ix_usage_logs_org_id'), table_name='usage_logs')
    op.drop_table('usage_logs')
