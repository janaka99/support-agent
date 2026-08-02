"""create guardrails and junction tables

Revision ID: f1a82c91b3e4
Revises: e4a71b29df91
Create Date: 2026-08-02 16:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f1a82c91b3e4'
down_revision: Union[str, Sequence[str], None] = 'e4a71b29df91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create guardrails table
    op.create_table(
        'guardrails',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orgs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('guardrail_type', sa.String(), nullable=False, server_default='pii'),
        sa.Column('stage', sa.String(), nullable=False, server_default='ingress'),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('action_on_violation', sa.String(), nullable=False, server_default='block_and_respond'),
        sa.Column('refusal_message', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'))
    )

    # 2. Create bot_guardrails junction table
    op.create_table(
        'bot_guardrails',
        sa.Column('bot_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('bots.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('guardrail_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('guardrails.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'))
    )

    # 3. Create agent_guardrails junction table
    op.create_table(
        'agent_guardrails',
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('agents.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('guardrail_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('guardrails.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'))
    )


def downgrade() -> None:
    op.drop_table('agent_guardrails')
    op.drop_table('bot_guardrails')
    op.drop_table('guardrails')
