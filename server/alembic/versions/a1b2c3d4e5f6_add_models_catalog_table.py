"""Add models catalog table

Revision ID: a1b2c3d4e5f6
Revises: f1a82c91b3e4
Create Date: 2026-08-03 12:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f1a82c91b3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'models',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orgs.id', ondelete='CASCADE'), nullable=True),
        sa.Column('model_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('provider_name', sa.String(), nullable=False),
        sa.Column('context_window', sa.Integer(), nullable=False, server_default='128000'),
        sa.Column('supports_tools', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('supports_vision', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('supports_structured', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('prompt_cost_per_million', sa.Float(), nullable=False, server_default='0.50'),
        sa.Column('completion_cost_per_million', sa.Float(), nullable=False, server_default='1.50'),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index(op.f('ix_models_model_id'), 'models', ['model_id'], unique=False)
    op.create_index(op.f('ix_models_provider'), 'models', ['provider'], unique=False)
    op.create_index(op.f('ix_models_org_id'), 'models', ['org_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_models_org_id'), table_name='models')
    op.drop_index(op.f('ix_models_provider'), table_name='models')
    op.drop_index(op.f('ix_models_model_id'), table_name='models')
    op.drop_table('models')
