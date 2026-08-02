"""add bots and tools architecture

Revision ID: c1f930e1a400
Revises: e89a01bf1920
Create Date: 2026-08-02 12:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c1f930e1a400'
down_revision: Union[str, Sequence[str], None] = 'e89a01bf1920'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Tools Table
    op.create_table(
        'tools',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('org_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('tool_type', sa.String(), nullable=False, server_default='http_request'),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('parameters_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['org_id'], ['orgs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tools_org_id'), 'tools', ['org_id'], unique=False)
    op.create_index(op.f('ix_tools_name'), 'tools', ['name'], unique=False)

    # 2. Create Bots Table
    op.create_table(
        'bots',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('org_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('greeting_message', sa.String(), nullable=True, server_default='Hello! How can I help you today?'),
        sa.Column('system_prompt', sa.String(), nullable=True),
        sa.Column('model', sa.String(), nullable=False, server_default='gpt-4o-mini'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['org_id'], ['orgs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bots_org_id'), 'bots', ['org_id'], unique=False)

    # 3. Create Agent Tools Table (Many-to-Many)
    op.create_table(
        'agent_tools',
        sa.Column('agent_id', sa.UUID(), nullable=False),
        sa.Column('tool_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tool_id'], ['tools.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('agent_id', 'tool_id')
    )

    # 4. Create Bot Agents Table (Many-to-Many)
    op.create_table(
        'bot_agents',
        sa.Column('bot_id', sa.UUID(), nullable=False),
        sa.Column('agent_id', sa.UUID(), nullable=False),
        sa.Column('routing_hint', sa.String(), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['bot_id'], ['bots.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('bot_id', 'agent_id')
    )

    # 5. Add columns to existing tables
    op.add_column('agents', sa.Column('temperature', sa.Float(), nullable=False, server_default='0.2'))
    op.add_column('conversations', sa.Column('bot_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_conversations_bot_id', 'conversations', 'bots', ['bot_id'], ['id'], ondelete='SET NULL')

    # 6. Setup RLS for new tables
    for table_name in ['tools', 'bots']:
        op.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY;")
        op.execute(f"""
            CREATE POLICY {table_name}_org_isolation ON {table_name}
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
    op.drop_constraint('fk_conversations_bot_id', 'conversations', type_='foreignkey')
    op.drop_column('conversations', 'bot_id')
    op.drop_column('agents', 'temperature')

    op.execute("DROP POLICY IF EXISTS tools_org_isolation ON tools;")
    op.execute("DROP POLICY IF EXISTS bots_org_isolation ON bots;")

    op.drop_table('bot_agents')
    op.drop_table('agent_tools')
    op.drop_index(op.f('ix_bots_org_id'), table_name='bots')
    op.drop_table('bots')
    op.drop_index(op.f('ix_tools_name'), table_name='tools')
    op.drop_index(op.f('ix_tools_org_id'), table_name='tools')
    op.drop_table('tools')
