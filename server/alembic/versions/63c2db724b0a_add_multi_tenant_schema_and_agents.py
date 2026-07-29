"""add multi-tenant schema and agents

Revision ID: 63c2db724b0a
Revises: f90fa2b0450f
Create Date: 2026-07-27 19:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '63c2db724b0a'
down_revision: Union[str, Sequence[str], None] = 'f90fa2b0450f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add org_id to messages (using nullable=True first if there was data, but going with False based on models)
    # We use nullable=False assuming a clean db or we can handle it via a multi-step migration if needed.
    # We will use nullable=True for safety during column creation, but SQLAlchemy models enforce False.
    op.add_column('messages', sa.Column('org_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_messages_org_id', 'messages', 'orgs', ['org_id'], ['id'])

    # 2. Create agents table
    op.create_table('agents',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('org_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('specialization', sa.String(), nullable=False),
        sa.Column('system_prompt', sa.String(), nullable=False),
        sa.Column('model', sa.String(), nullable=False),
        sa.Column('tools', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('guardrails', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('routing_examples', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['orgs.id'], name='fk_agents_org_id'),
        sa.PrimaryKeyConstraint('id')
    )

    # 3. Add Row Level Security (RLS)
    
    tables_for_rls = ['users', 'conversations', 'messages', 'agents']
    
    for table in tables_for_rls:
        # Enable RLS
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        
        # Create policy based on app.current_org
        policy_sql = f"""
        CREATE POLICY {table}_org_policy ON {table}
            USING (org_id = current_setting('app.current_org', true)::uuid);
        """
        op.execute(policy_sql)


def downgrade() -> None:
    # Reverse RLS
    tables_for_rls = ['agents', 'messages', 'conversations', 'users']
    for table in tables_for_rls:
        op.execute(f"DROP POLICY IF EXISTS {table}_org_policy ON {table};")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
    
    # Drop agents table
    op.drop_table('agents')
    
    # Drop org_id from messages
    op.drop_constraint('fk_messages_org_id', 'messages', type_='foreignkey')
    op.drop_column('messages', 'org_id')
