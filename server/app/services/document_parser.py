import io
import re
import logging
from typing import List, Dict, Any, Optional
from langchain_openai import OpenAIEmbeddings
from app.core.config import settings

logger = logging.getLogger(__name__)


def extract_text_from_bytes(filename: str, content_bytes: bytes) -> str:
    """Extracts raw text content from uploaded file bytes (PDF, Markdown, TXT, CSV, JSON)."""
    filename_lower = filename.lower()
    
    if filename_lower.endswith(".pdf"):
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content_bytes))
            extracted_pages = []
            for idx, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    extracted_pages.append(f"--- Page {idx + 1} ---\n{page_text.strip()}")
            return "\n\n".join(extracted_pages)
        except Exception as e:
            logger.error(f"Error parsing PDF '{filename}': {e}")
            raise ValueError(f"Failed to parse PDF document '{filename}': {str(e)}")
            
    # Default: utf-8 decoded text (covers .md, .txt, .csv, .json, etc.)
    try:
        return content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return content_bytes.decode("latin-1", errors="ignore")


def chunk_text(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
    min_chunk_size: int = 40
) -> List[Dict[str, Any]]:
    """
    Splits text recursively into semantic chunks with overlap.
    Returns list of dicts with 'content', 'chunk_index', and 'metadata'.
    """
    if not text or not text.strip():
        return []
    
    cleaned_text = re.sub(r"\r\n", "\n", text.strip())
    
    # Split hierarchically: paragraphs -> lines -> sentences -> words
    paragraphs = re.split(r"\n\n+", cleaned_text)
    
    raw_chunks = []
    current_chunk = ""
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
            
        if len(para) > chunk_size:
            # Paragraph is too long: split into sentences / lines
            sub_segments = re.split(r"(?<=[.?!])\s+|\n", para)
            for seg in sub_segments:
                seg = seg.strip()
                if not seg:
                    continue
                if len(current_chunk) + len(seg) + 1 <= chunk_size:
                    current_chunk = f"{current_chunk} {seg}".strip()
                else:
                    if current_chunk and len(current_chunk) >= min_chunk_size:
                        raw_chunks.append(current_chunk)
                    # If single segment is huge, split by hard length
                    if len(seg) > chunk_size:
                        for i in range(0, len(seg), chunk_size - chunk_overlap):
                            slice_str = seg[i:i + chunk_size].strip()
                            if len(slice_str) >= min_chunk_size:
                                raw_chunks.append(slice_str)
                        current_chunk = ""
                    else:
                        current_chunk = seg
        else:
            if len(current_chunk) + len(para) + 2 <= chunk_size:
                current_chunk = f"{current_chunk}\n\n{para}".strip()
            else:
                if current_chunk and len(current_chunk) >= min_chunk_size:
                    raw_chunks.append(current_chunk)
                current_chunk = para
                
    if current_chunk and len(current_chunk) >= min_chunk_size:
        raw_chunks.append(current_chunk)
        
    # If no chunks were created, fallback to whole text
    if not raw_chunks and len(cleaned_text) > 0:
        raw_chunks = [cleaned_text[:chunk_size]]
        
    # Build structured chunks with overlap indices & metadata
    chunks = []
    for idx, chunk_content in enumerate(raw_chunks):
        chunks.append({
            "content": chunk_content,
            "chunk_index": idx,
            "metadata": {
                "chunk_index": idx,
                "total_chunks": len(raw_chunks),
                "char_length": len(chunk_content),
                "word_count": len(chunk_content.split())
            }
        })
        
    return chunks


async def generate_embeddings_batch(
    texts: List[str],
    model_name: str = "text-embedding-3-small"
) -> List[List[float]]:
    """Generates dense vector embeddings using OpenAI embeddings."""
    if not texts:
        return []
        
    embeddings_model = OpenAIEmbeddings(
        model=model_name or "text-embedding-3-small",
        api_key=settings.OPENAI_API_KEY,
        max_retries=3
    )
    
    # Process in batches of 64 to avoid rate or payload limits
    batch_size = 64
    all_embeddings = []
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        batch_res = await embeddings_model.aembed_documents(batch)
        all_embeddings.extend(batch_res)
        
    return all_embeddings


async def generate_single_embedding(
    text: str,
    model_name: str = "text-embedding-3-small"
) -> List[float]:
    """Generates embedding for a single query string."""
    embeddings_model = OpenAIEmbeddings(
        model=model_name or "text-embedding-3-small",
        api_key=settings.OPENAI_API_KEY,
        max_retries=3
    )
    return await embeddings_model.aembed_query(text)
