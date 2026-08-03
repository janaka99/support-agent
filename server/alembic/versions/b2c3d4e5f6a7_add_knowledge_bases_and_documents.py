"""Add knowledge_bases, knowledge_documents, and document_chunks tables

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-03 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create knowledge_bases table
    op.create_table(
        'knowledge_bases',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orgs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('embedding_model', sa.String(), nullable=False, server_default='text-embedding-3-small'),
        sa.Column('chunk_size', sa.Integer(), nullable=False, server_default='500'),
        sa.Column('chunk_overlap', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('ix_knowledge_bases_org_id', 'knowledge_bases', ['org_id'])

    # 2. Create knowledge_documents table
    op.create_table(
        'knowledge_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('kb_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('knowledge_bases.id', ondelete='CASCADE'), nullable=False),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orgs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('source_type', sa.String(), nullable=False, server_default='file'),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='ready'),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('chunk_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('ix_knowledge_documents_kb_id', 'knowledge_documents', ['kb_id'])
    op.create_index('ix_knowledge_documents_org_id', 'knowledge_documents', ['org_id'])

    # 3. Create document_chunks table with pgvector Vector(1536)
    op.create_table(
        'document_chunks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('knowledge_documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('kb_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('knowledge_bases.id', ondelete='CASCADE'), nullable=False),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orgs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content', sa.String(), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('embedding', Vector(1536), nullable=False),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('ix_document_chunks_document_id', 'document_chunks', ['document_id'])
    op.create_index('ix_document_chunks_kb_id', 'document_chunks', ['kb_id'])
    op.create_index('ix_document_chunks_org_id', 'document_chunks', ['org_id'])

    # Row-Level Security (RLS) policies for multi-tenancy
    op.execute("ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY org_isolation_policy ON knowledge_bases
        FOR ALL
        USING (org_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
    """)

    op.execute("ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY org_isolation_policy ON knowledge_documents
        FOR ALL
        USING (org_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
    """)

    op.execute("ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY org_isolation_policy ON document_chunks
        FOR ALL
        USING (org_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
    """)


def downgrade() -> None:
    op.drop_table('document_chunks')
    op.drop_table('knowledge_documents')
    op.drop_table('knowledge_bases')
