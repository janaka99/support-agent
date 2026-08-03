import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class KnowledgeBaseBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Name of the Knowledge Base")
    description: Optional[str] = Field(None, description="Detailed description of the knowledge domain")
    embedding_model: str = Field(default="text-embedding-3-small", description="OpenAI embedding model")
    chunk_size: int = Field(default=500, ge=100, le=4000, description="Target chunk size in characters")
    chunk_overlap: int = Field(default=50, ge=0, le=1000, description="Overlap between consecutive chunks")


class KnowledgeBaseCreate(KnowledgeBaseBase):
    pass


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    chunk_size: Optional[int] = Field(None, ge=100, le=4000)
    chunk_overlap: Optional[int] = Field(None, ge=0, le=1000)


class KnowledgeDocumentResponse(BaseModel):
    id: uuid.UUID
    kb_id: uuid.UUID
    org_id: uuid.UUID
    title: str
    source_type: str
    file_size_bytes: Optional[int] = None
    status: str
    processing_progress: int = 0
    error_message: Optional[str] = None
    chunk_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class KnowledgeBaseResponse(KnowledgeBaseBase):
    id: uuid.UUID
    org_id: uuid.UUID
    document_count: int = 0
    total_chunks: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentChunkResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    kb_id: uuid.UUID
    content: str
    chunk_index: int
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentTextCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)


class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Semantic search query")
    top_k: int = Field(default=4, ge=1, le=20, description="Number of chunks to retrieve")
    similarity_threshold: float = Field(default=0.0, ge=0.0, le=1.0, description="Minimum cosine similarity threshold (0.0 to 1.0)")


class SemanticSearchResult(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    content: str
    similarity_score: float # Cosine similarity percentage (0.0 - 1.0)
    chunk_index: int
    metadata: Dict[str, Any] = Field(default_factory=dict)
