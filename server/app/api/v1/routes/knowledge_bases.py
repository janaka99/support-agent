import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user
from app.db.models import KnowledgeBase, KnowledgeDocument, DocumentChunk, User
from app.schemas.knowledge_base import (
    KnowledgeBaseCreate,
    KnowledgeBaseUpdate,
    KnowledgeBaseResponse,
    KnowledgeDocumentResponse,
    DocumentChunkResponse,
    DocumentTextCreate,
    SemanticSearchRequest,
    SemanticSearchResult,
)
from app.core.redis import redis_client
from app.services.document_parser import (
    extract_text_from_bytes,
    chunk_text,
    generate_embeddings_batch,
    generate_single_embedding,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge-bases", tags=["Knowledge Bases"])


@router.get("", response_model=List[KnowledgeBaseResponse])
async def list_knowledge_bases(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """List all knowledge bases for the current organization with document and chunk counts."""
    doc_count_subq = (
        select(
            KnowledgeDocument.kb_id,
            func.count(KnowledgeDocument.id).label("doc_count")
        )
        .where(KnowledgeDocument.org_id == user.org_id)
        .group_by(KnowledgeDocument.kb_id)
        .subquery()
    )

    chunk_count_subq = (
        select(
            DocumentChunk.kb_id,
            func.count(DocumentChunk.id).label("chunk_count")
        )
        .where(DocumentChunk.org_id == user.org_id)
        .group_by(DocumentChunk.kb_id)
        .subquery()
    )

    stmt = (
        select(
            KnowledgeBase,
            func.coalesce(doc_count_subq.c.doc_count, 0).label("document_count"),
            func.coalesce(chunk_count_subq.c.chunk_count, 0).label("total_chunks")
        )
        .outerjoin(doc_count_subq, KnowledgeBase.id == doc_count_subq.c.kb_id)
        .outerjoin(chunk_count_subq, KnowledgeBase.id == chunk_count_subq.c.kb_id)
        .where(KnowledgeBase.org_id == user.org_id)
        .order_by(KnowledgeBase.created_at.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    responses = []
    for kb, doc_count, chunk_count in rows:
        resp = KnowledgeBaseResponse.model_validate(kb)
        resp.document_count = doc_count
        resp.total_chunks = chunk_count
        responses.append(resp)

    return responses


@router.post("", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_base(
    kb_in: KnowledgeBaseCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new Knowledge Base repository."""
    kb = KnowledgeBase(
        id=uuid.uuid4(),
        org_id=user.org_id,
        name=kb_in.name,
        description=kb_in.description,
        embedding_model=kb_in.embedding_model or "text-embedding-3-small",
        chunk_size=kb_in.chunk_size or 500,
        chunk_overlap=kb_in.chunk_overlap or 50,
    )
    db.add(kb)
    await db.commit()
    await db.refresh(kb)

    resp = KnowledgeBaseResponse.model_validate(kb)
    resp.document_count = 0
    resp.total_chunks = 0
    return resp


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(
    kb_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get Knowledge Base details and stats."""
    stmt = select(KnowledgeBase).where(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id
    )
    result = await db.execute(stmt)
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found.")

    doc_count_res = await db.execute(
        select(func.count(KnowledgeDocument.id)).where(
            KnowledgeDocument.kb_id == kb_id,
            KnowledgeDocument.org_id == user.org_id
        )
    )
    chunk_count_res = await db.execute(
        select(func.count(DocumentChunk.id)).where(
            DocumentChunk.kb_id == kb_id,
            DocumentChunk.org_id == user.org_id
        )
    )

    resp = KnowledgeBaseResponse.model_validate(kb)
    resp.document_count = doc_count_res.scalar() or 0
    resp.total_chunks = chunk_count_res.scalar() or 0
    return resp


@router.put("/{kb_id}", response_model=KnowledgeBaseResponse)
async def update_knowledge_base(
    kb_id: uuid.UUID,
    kb_in: KnowledgeBaseUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update Knowledge Base metadata."""
    stmt = select(KnowledgeBase).where(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id
    )
    result = await db.execute(stmt)
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found.")

    if kb_in.name is not None:
        kb.name = kb_in.name
    if kb_in.description is not None:
        kb.description = kb_in.description
    if kb_in.chunk_size is not None:
        kb.chunk_size = kb_in.chunk_size
    if kb_in.chunk_overlap is not None:
        kb.chunk_overlap = kb_in.chunk_overlap

    await db.commit()
    await db.refresh(kb)

    doc_count_res = await db.execute(
        select(func.count(KnowledgeDocument.id)).where(
            KnowledgeDocument.kb_id == kb_id,
            KnowledgeDocument.org_id == user.org_id
        )
    )
    chunk_count_res = await db.execute(
        select(func.count(DocumentChunk.id)).where(
            DocumentChunk.kb_id == kb_id,
            DocumentChunk.org_id == user.org_id
        )
    )

    resp = KnowledgeBaseResponse.model_validate(kb)
    resp.document_count = doc_count_res.scalar() or 0
    resp.total_chunks = chunk_count_res.scalar() or 0
    return resp


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_base(
    kb_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Delete Knowledge Base and all associated documents & vector chunks."""
    stmt = select(KnowledgeBase).where(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id
    )
    result = await db.execute(stmt)
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found.")

    await db.delete(kb)
    await db.commit()
    return None


@router.get("/{kb_id}/documents", response_model=List[KnowledgeDocumentResponse])
async def list_documents(
    kb_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """List all documents indexed in the given Knowledge Base."""
    # Verify KB ownership
    kb_res = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.org_id == user.org_id
        )
    )
    if not kb_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Knowledge base not found.")

    stmt = (
        select(KnowledgeDocument)
        .where(
            KnowledgeDocument.kb_id == kb_id,
            KnowledgeDocument.org_id == user.org_id
        )
        .order_by(KnowledgeDocument.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{kb_id}/documents/upload", response_model=KnowledgeDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    kb_id: uuid.UUID,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Upload a file document (.pdf, .md, .txt, .csv, .json).
    Extracts text and enqueues background worker job for high-throughput, non-blocking vector indexing.
    """
    kb_res = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.org_id == user.org_id
        )
    )
    kb = kb_res.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found.")

    filename = file.filename or "uploaded_document"
    doc_title = title.strip() if title and title.strip() else filename
    content_bytes = await file.read()
    file_size = len(content_bytes)

    try:
        raw_text = extract_text_from_bytes(filename, content_bytes)
        if not raw_text or not raw_text.strip():
            raise ValueError("No readable text could be extracted from the file.")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File parsing error: {str(e)}"
        )

    doc = KnowledgeDocument(
        id=uuid.uuid4(),
        kb_id=kb.id,
        org_id=user.org_id,
        title=doc_title,
        source_type="pdf" if filename.lower().endswith(".pdf") else ("markdown" if filename.lower().endswith(".md") else "file"),
        file_size_bytes=file_size,
        raw_content=raw_text,
        status="pending",
        processing_progress=0,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Dispatch to background worker stream
    await redis_client.xadd(
        "document_jobs",
        {
            "doc_id": str(doc.id),
            "kb_id": str(kb.id),
            "org_id": str(user.org_id),
            "title": doc.title,
        }
    )

    return doc


@router.post("/{kb_id}/documents/text", response_model=KnowledgeDocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_text_document(
    kb_id: uuid.UUID,
    payload: DocumentTextCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Create a new document from pasted raw text or markdown.
    Enqueues background worker job for non-blocking vector indexing.
    """
    kb_res = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.org_id == user.org_id
        )
    )
    kb = kb_res.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found.")

    if not payload.content or not payload.content.strip():
        raise HTTPException(status_code=400, detail="Document content cannot be empty.")

    doc = KnowledgeDocument(
        id=uuid.uuid4(),
        kb_id=kb.id,
        org_id=user.org_id,
        title=payload.title,
        source_type="raw_text",
        file_size_bytes=len(payload.content.encode("utf-8")),
        raw_content=payload.content,
        status="pending",
        processing_progress=0,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Dispatch to background worker stream
    await redis_client.xadd(
        "document_jobs",
        {
            "doc_id": str(doc.id),
            "kb_id": str(kb.id),
            "org_id": str(user.org_id),
            "title": doc.title,
        }
    )

    return doc


@router.post("/{kb_id}/documents/{doc_id}/cancel", response_model=KnowledgeDocumentResponse)
async def cancel_document_processing(
    kb_id: uuid.UUID,
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Cancel an ongoing or pending document indexing process.
    Sets cancellation flag in Redis and marks document cancelled without leaving duplicate/corrupt chunks.
    """
    stmt = select(KnowledgeDocument).where(
        KnowledgeDocument.id == doc_id,
        KnowledgeDocument.kb_id == kb_id,
        KnowledgeDocument.org_id == user.org_id
    )
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Set cancellation signal in Redis (1 hour TTL)
    await redis_client.set(f"cancel_doc:{doc.id}", "1", ex=3600)

    if doc.status in ["pending", "indexing"]:
        doc.status = "cancelled"
        doc.error_message = "Cancelled by user"
        doc.processing_progress = 0
        # Purge any partial chunks for safety
        await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))
        doc.chunk_count = 0
        await db.commit()
        await db.refresh(doc)

    return doc


@router.post("/{kb_id}/documents/{doc_id}/retry", response_model=KnowledgeDocumentResponse)
async def retry_document_processing(
    kb_id: uuid.UUID,
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Retry an indexing job for a failed or cancelled document without duplicate chunks.
    """
    stmt = select(KnowledgeDocument).where(
        KnowledgeDocument.id == doc_id,
        KnowledgeDocument.kb_id == kb_id,
        KnowledgeDocument.org_id == user.org_id
    )
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if not doc.raw_content:
        raise HTTPException(status_code=400, detail="Document content unavailable for retry. Please upload again.")

    # Clear cancellation flag
    await redis_client.delete(f"cancel_doc:{doc.id}")

    # Reset status
    doc.status = "pending"
    doc.error_message = None
    doc.processing_progress = 0
    await db.commit()
    await db.refresh(doc)

    # Re-queue job
    await redis_client.xadd(
        "document_jobs",
        {
            "doc_id": str(doc.id),
            "kb_id": str(kb_id),
            "org_id": str(user.org_id),
            "title": doc.title,
        }
    )

    return doc


@router.get("/{kb_id}/documents/{doc_id}/chunks", response_model=List[DocumentChunkResponse])
async def get_document_chunks(
    kb_id: uuid.UUID,
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Retrieve all text chunks for a specific document to inspect parsed segments."""
    stmt = (
        select(DocumentChunk)
        .where(
            DocumentChunk.kb_id == kb_id,
            DocumentChunk.document_id == doc_id,
            DocumentChunk.org_id == user.org_id
        )
        .order_by(DocumentChunk.chunk_index.asc())
    )
    result = await db.execute(stmt)
    chunks = result.scalars().all()
    
    # Map chunk_metadata column to schema metadata
    responses = []
    for c in chunks:
        resp = DocumentChunkResponse(
            id=c.id,
            document_id=c.document_id,
            kb_id=c.kb_id,
            content=c.content,
            chunk_index=c.chunk_index,
            metadata=c.chunk_metadata or {},
            created_at=c.created_at
        )
        responses.append(resp)
    return responses


@router.delete("/{kb_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    kb_id: uuid.UUID,
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Delete a document from a knowledge base.
    All associated vector chunks and embeddings in PostgreSQL are automatically cascade-purged.
    """
    # Clean up any Redis cancellation key
    await redis_client.delete(f"cancel_doc:{doc_id}")

    stmt = select(KnowledgeDocument).where(
        KnowledgeDocument.id == doc_id,
        KnowledgeDocument.kb_id == kb_id,
        KnowledgeDocument.org_id == user.org_id
    )
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    await db.delete(doc)
    await db.commit()
    return None


@router.post("/{kb_id}/search", response_model=List[SemanticSearchResult])
async def search_knowledge_base(
    kb_id: uuid.UUID,
    search_req: SemanticSearchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Perform semantic vector similarity search against the Knowledge Base."""
    kb_res = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.org_id == user.org_id
        )
    )
    kb = kb_res.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found.")

    query_embedding = await generate_single_embedding(
        text=search_req.query,
        model_name=kb.embedding_model
    )

    # Calculate cosine distance using pgvector: distance = cosine_distance(query_embedding)
    # Cosine Similarity = 1 - cosine_distance
    cosine_distance = DocumentChunk.embedding.cosine_distance(query_embedding)

    stmt = (
        select(
            DocumentChunk,
            KnowledgeDocument.title.label("doc_title"),
            cosine_distance.label("distance")
        )
        .join(KnowledgeDocument, DocumentChunk.document_id == KnowledgeDocument.id)
        .where(
            DocumentChunk.kb_id == kb_id,
            DocumentChunk.org_id == user.org_id
        )
        .order_by(cosine_distance.asc())
        .limit(search_req.top_k)
    )

    result = await db.execute(stmt)
    rows = result.all()

    results = []
    for chunk_obj, doc_title, distance in rows:
        sim_score = max(0.0, min(1.0, 1.0 - float(distance)))
        if sim_score >= search_req.similarity_threshold:
            results.append(SemanticSearchResult(
                chunk_id=chunk_obj.id,
                document_id=chunk_obj.document_id,
                document_title=doc_title,
                content=chunk_obj.content,
                similarity_score=round(sim_score, 4),
                chunk_index=chunk_obj.chunk_index,
                metadata=chunk_obj.chunk_metadata or {}
            ))

    return results
