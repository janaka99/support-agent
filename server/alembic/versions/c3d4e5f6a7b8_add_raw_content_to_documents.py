"""Add raw_content and processing_progress to knowledge_documents

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-03 15:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('knowledge_documents', sa.Column('raw_content', sa.Text(), nullable=True))
    op.add_column('knowledge_documents', sa.Column('processing_progress', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('knowledge_documents', 'processing_progress')
    op.drop_column('knowledge_documents', 'raw_content')
