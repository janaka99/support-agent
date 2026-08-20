import json
import uuid
import logging
import re
import httpx
from typing import List
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from sqlalchemy import select, delete
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.core.database import async_session_maker
from app.db.models import Message, Conversation, KnowledgeBase, KnowledgeDocument, DocumentChunk, Bot
from app.agent.graph import build_bot_graph
from app.services.document_parser import chunk_text, generate_embeddings_batch
from app.core.redis import redis_client
from app.core.config import settings

logger = logging.getLogger(__name__)


async def process_chat_job(job_id: str, data: dict, worker_name: str):
    """
    Consumes a chat job, runs dynamic multi-agent LangGraph for the specified Bot, and saves the AI response.
    """
    conv_id = data.get("conversation_id")
    org_id = data.get("org_id")
    bot_id = data.get("bot_id")

    print(f"[{worker_name}] Processing chat job: {job_id} for Conversation {conv_id} (Bot: {bot_id})")
    
    async with async_session_maker() as db:
        # Fetch conversation to check channel and bot
        conv_res = await db.execute(select(Conversation).where(Conversation.id == uuid.UUID(str(conv_id))))
        conversation = conv_res.scalar_one_or_none()
        channel = "web"
        external_chat_id = None
        if conversation:
            if not bot_id and conversation.bot_id:
                bot_id = str(conversation.bot_id)
            channel = conversation.channel
            external_chat_id = conversation.external_chat_id

        conn_string = str(settings.DATABASE_URL).replace('+asyncpg', '')
        
        async with AsyncPostgresSaver.from_conn_string(conn_string) as checkpointer:
            await checkpointer.setup()
            
            try:
                # Build dynamic graph for this bot & its specialist agents & tools
                dynamic_graph = await build_bot_graph(
                    org_id=org_id,
                    db=db,
                    bot_id=bot_id,
                    checkpointer=checkpointer
                )
                
                new_message = HumanMessage(content=data["user_message"])
                config = {
                    "configurable": {"thread_id": str(conv_id)},
                    "metadata": {
                        "session_id": str(conv_id),
                        "user_id": str(org_id),
                        "bot_id": str(bot_id) if bot_id else "default",
                    },
                    "run_name": "support-agent-chat",
                }
                
                graph_result = await dynamic_graph.ainvoke({
                    "messages": [new_message],
                    "conversation_id": conv_id
                }, config=config)

                last_message = graph_result["messages"][-1]
                assistant_content = str(last_message.content)
                
                # Save assistant reply
                assistant_msg = Message(
                    conversation_id=uuid.UUID(str(conv_id)),
                    org_id=uuid.UUID(str(org_id)),
                    role="assistant",
                    content=assistant_content
                )
                db.add(assistant_msg)
                await db.commit()

                # Publish result to Redis Pub/Sub
                channel_name = f"chat_{conv_id}"
                payload = json.dumps({
                    "id": str(assistant_msg.id),
                    "role": "assistant",
                    "content": assistant_content
                })
                await redis_client.publish(channel_name, payload)
                await redis_client.publish(channel_name, "[DONE]")
                
                # Telegram integration
                if channel == "telegram" and external_chat_id and bot_id:
                    bot_res = await db.execute(select(Bot).where(Bot.id == uuid.UUID(bot_id)))
                    bot_obj = bot_res.scalar_one_or_none()
                    if bot_obj and bot_obj.telegram_bot_token:
                        inline_keyboard = []
                        links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', assistant_content)
                        if links:
                            buttons = []
                            for text_label, url_or_data in links:
                                if url_or_data.startswith("action:"):
                                    buttons.append({"text": text_label, "callback_data": url_or_data[7:]})
                                else:
                                    buttons.append({"text": text_label, "url": url_or_data})
                            if buttons:
                                inline_keyboard = [[b] for b in buttons]
                            
                            clean_content = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', '', assistant_content).strip()
                        else:
                            clean_content = assistant_content
                            
                        payload_data = {
                            "chat_id": external_chat_id,
                            "text": clean_content
                        }
                        if inline_keyboard:
                            payload_data["reply_markup"] = {"inline_keyboard": inline_keyboard}
                            
                        async with httpx.AsyncClient() as client:
                            await client.post(
                                f"https://api.telegram.org/bot{bot_obj.telegram_bot_token}/sendMessage",
                                json=payload_data
                            )
                
                print(f"[{worker_name}] Successfully saved reply for job {job_id}")

            except Exception as e:
                print(f"[{worker_name}] Error processing job: {e}")
                
                error_content = "I'm having trouble connecting right now. Please try again later."
                fallback_msg = Message(
                    conversation_id=uuid.UUID(str(conv_id)),
                    org_id=uuid.UUID(str(org_id)),
                    role="assistant",
                    content=error_content
                )
                db.add(fallback_msg)
                await db.commit()
                
                channel_name = f"chat_{conv_id}"
                payload = json.dumps({
                    "id": str(fallback_msg.id),
                    "role": "assistant",
                    "content": error_content
                })
                await redis_client.publish(channel_name, payload)
                await redis_client.publish(channel_name, "[DONE]")
                
                if channel == "telegram" and external_chat_id and bot_id:
                    bot_res = await db.execute(select(Bot).where(Bot.id == uuid.UUID(bot_id)))
                    bot_obj = bot_res.scalar_one_or_none()
                    if bot_obj and bot_obj.telegram_bot_token:
                        async with httpx.AsyncClient() as client:
                            await client.post(
                                f"https://api.telegram.org/bot{bot_obj.telegram_bot_token}/sendMessage",
                                json={"chat_id": external_chat_id, "text": error_content}
                            )


async def process_document_job(job_id: str, data: dict, worker_name: str):
    """
    Consumes a document indexing job from Redis stream.
    Features:
    - Mid-process cancellation check before and during chunk embedding batches.
    - Zero duplicate chunks on retries (atomic deletion of old chunks before writing new ones).
    - Asynchronous high-throughput batching for concurrent document ingestion.
    """
    doc_id_str = data.get("doc_id")
    kb_id_str = data.get("kb_id")
    org_id_str = data.get("org_id")

    if not doc_id_str or not kb_id_str or not org_id_str:
        print(f"[{worker_name}] Invalid document job payload: {data}")
        return

    doc_id = uuid.UUID(doc_id_str)
    kb_id = uuid.UUID(kb_id_str)
    org_id = uuid.UUID(org_id_str)
    cancel_key = f"cancel_doc:{doc_id_str}"

    print(f"[{worker_name}] Processing document job: {job_id} for Document {doc_id_str} (KB: {kb_id_str})")

    # 1. Early cancellation check
    is_cancelled = await redis_client.get(cancel_key)
    if is_cancelled:
        print(f"[{worker_name}] Document {doc_id_str} was cancelled prior to starting.")
        async with async_session_maker() as db:
            res = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == doc_id))
            doc = res.scalar_one_or_none()
            if doc:
                doc.status = "cancelled"
                doc.error_message = "Cancelled by user"
                await db.commit()
        await redis_client.delete(cancel_key)
        return

    async with async_session_maker() as db:
        # 2. Fetch document & KB
        doc_res = await db.execute(
            select(KnowledgeDocument).where(
                KnowledgeDocument.id == doc_id,
                KnowledgeDocument.org_id == org_id
            )
        )
        doc = doc_res.scalar_one_or_none()
        if not doc:
            print(f"[{worker_name}] Document {doc_id_str} not found in database.")
            return

        kb_res = await db.execute(
            select(KnowledgeBase).where(
                KnowledgeBase.id == kb_id,
                KnowledgeBase.org_id == org_id
            )
        )
        kb = kb_res.scalar_one_or_none()
        if not kb:
            print(f"[{worker_name}] Knowledge base {kb_id_str} not found for document {doc_id_str}.")
            doc.status = "error"
            doc.error_message = "Associated Knowledge Base was not found."
            await db.commit()
            return

        # If already cancelled in DB, abort
        if doc.status == "cancelled":
            print(f"[{worker_name}] Document {doc_id_str} has cancelled status in DB. Aborting.")
            return

        # Mark as actively indexing
        doc.status = "indexing"
        doc.processing_progress = 10
        doc.error_message = None
        await db.commit()
        await db.refresh(doc)

        try:
            # 3. Extract text content
            raw_text = data.get("raw_content") or doc.raw_content
            if not raw_text or not raw_text.strip():
                raise ValueError("No readable text content available for document processing.")

            # Ensure raw_content is persisted in DB for future retries if it wasn't already
            if not doc.raw_content:
                doc.raw_content = raw_text

            # 4. Chunk text
            chunks = chunk_text(
                text=raw_text,
                chunk_size=kb.chunk_size,
                chunk_overlap=kb.chunk_overlap
            )
            if not chunks:
                raise ValueError("Document yielded no text chunks after chunking.")

            total_chunks = len(chunks)
            chunk_texts = [c["content"] for c in chunks]
            batch_size = 50
            all_embeddings: List[List[float]] = []

            # 5. Batch Embeddings with cancellation checkpoints
            for batch_start in range(0, total_chunks, batch_size):
                # Mid-process cancellation check before each batch
                if await redis_client.get(cancel_key):
                    print(f"[{worker_name}] Mid-process cancellation triggered for Document {doc_id_str} at chunk {batch_start}/{total_chunks}")
                    doc.status = "cancelled"
                    doc.error_message = "Cancelled by user during processing"
                    # Purge any existing chunks for safety
                    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))
                    await db.commit()
                    await redis_client.delete(cancel_key)
                    return

                batch_end = min(batch_start + batch_size, total_chunks)
                sub_texts = chunk_texts[batch_start:batch_end]
                
                sub_embeddings = await generate_embeddings_batch(
                    texts=sub_texts,
                    model_name=kb.embedding_model
                )
                all_embeddings.extend(sub_embeddings)

                # Update progress in DB (10% -> 90%)
                progress = int(10 + (batch_end / total_chunks) * 80)
                doc.processing_progress = progress
                await db.commit()

            # Final check before database write
            if await redis_client.get(cancel_key):
                print(f"[{worker_name}] Cancellation triggered before chunk commit for Document {doc_id_str}")
                doc.status = "cancelled"
                doc.error_message = "Cancelled by user"
                await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))
                await db.commit()
                await redis_client.delete(cancel_key)
                return

            # 6. Atomic Transaction & Duplicate Prevention:
            # Delete any previous chunks for this document to guarantee zero duplicate chunks on retry/re-index
            await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))

            for chunk_data, emb in zip(chunks, all_embeddings):
                c_meta = chunk_data.get("metadata", {})
                c_meta["document_title"] = doc.title

                chunk_record = DocumentChunk(
                    id=uuid.uuid4(),
                    document_id=doc.id,
                    kb_id=kb.id,
                    org_id=org_id,
                    content=chunk_data["content"],
                    chunk_index=chunk_data["chunk_index"],
                    embedding=emb,
                    chunk_metadata=c_meta
                )
                db.add(chunk_record)

            doc.chunk_count = total_chunks
            doc.status = "ready"
            doc.processing_progress = 100
            doc.error_message = None
            await db.commit()

            # Clean up cancel key if set
            await redis_client.delete(cancel_key)
            print(f"[{worker_name}] Successfully indexed Document {doc_id_str} ({total_chunks} chunks).")

        except Exception as e:
            print(f"[{worker_name}] Error processing document {doc_id_str}: {e}")
            logger.error(f"Error processing document {doc_id_str}: {e}", exc_info=True)
            doc.status = "error"
            doc.error_message = str(e)
            doc.processing_progress = 0
            # Clean up partial chunks on failure to prevent corrupted vector state
            await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))
            await db.commit()
            await redis_client.delete(cancel_key)
