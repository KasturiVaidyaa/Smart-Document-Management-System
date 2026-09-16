"""RAG chat service — vector search → LLM answer with citations."""
from __future__ import annotations

import logging
import re
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import Settings, get_settings
from app.providers.base import BaseEmbedProvider, BaseLLMProvider
from app.services.prompts import CONVERSATIONAL_PROMPT, RAG_SYSTEM_PROMPT

logger = logging.getLogger("ragdms.rag_service")

# Refusal message when no relevant chunks are found
_REFUSAL = (
    "I couldn't find relevant information in the available documents "
    "to answer this question."
)

# Pattern to detect casual / conversational messages that don't need RAG
_CONVERSATIONAL_RE = re.compile(
    r"^\s*"
    r"(h(i|ello|ey|ola|owdy)"
    r"|good\s*(morning|afternoon|evening|night|day)"
    r"|thanks?( you)?|thank\s*you"
    r"|bye|goodbye|see ya|later"
    r"|how are you|what'?s up|sup"
    r"|ok(ay)?|sure|yes|no|yep|nope"
    r"|yo|what'?s good"
    r"|welcome|greetings)"
    r"[\s!?.,;:)]*$",
    re.IGNORECASE,
)


async def chat(
    *,
    workspace_id: str,
    session_id: str | None,
    allowed_document_ids: list[str],
    question: str,
    history: list[dict[str, str]],
    db: AsyncIOMotorDatabase,
    llm: BaseLLMProvider,
    embedder: BaseEmbedProvider,
) -> dict[str, Any]:
    """Execute a RAG chat query.

    1. Early return refusal if allowedDocumentIds is empty
    2. Embed query
    3. Atlas Vector Search on document_chunks filtered by workspaceId + allowedDocumentIds
    4. If no chunks above threshold → refuse
    5. Build context string from retrieved chunks
    6. Build messages: system prompt + history + user question
    7. Call LLM
    8. Extract cited document IDs
    9. Return answer + citations

    Returns:
        {
            "answer": str,
            "citedDocumentIds": list[str],
            "citedChunks": list[dict],
            "refused": bool,
        }
    """
    settings = get_settings()

    # --- Step 0: Handle conversational messages ---
    if _CONVERSATIONAL_RE.match(question.strip()):
        logger.info("Detected conversational message, skipping vector search")
        try:
            prompt = CONVERSATIONAL_PROMPT.format(question=question)
            answer = await llm.chat(
                [{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=200,
            )
            answer = _clean_response(answer)
        except Exception:
            answer = "Hello! 👋 I'm your document assistant. Feel free to ask me anything about the documents in this workspace."
        return {
            "answer": answer,
            "citedDocumentIds": [],
            "citedChunks": [],
            "refused": False,
        }

    # --- Step 1: Guard empty ACL ---
    if not allowed_document_ids:
        return {
            "answer": _REFUSAL,
            "citedDocumentIds": [],
            "citedChunks": [],
            "refused": True,
        }

    ws_oid = ObjectId(workspace_id)
    doc_oids = [ObjectId(did) for did in allowed_document_ids]

    # --- Step 2: Embed query ---
    try:
        query_embeddings = await embedder.embed([question])
    except Exception:
        logger.exception("Query embedding failed")
        return {
            "answer": "The embedding model is unavailable. Check GEMINI_EMBED_MODEL and restart the AI service.",
            "citedDocumentIds": [],
            "citedChunks": [],
            "refused": True,
        }
    if not query_embeddings:
        return {
            "answer": _REFUSAL,
            "citedDocumentIds": [],
            "citedChunks": [],
            "refused": True,
        }
    query_vector = query_embeddings[0]

    # --- Step 3: Atlas Vector Search ---
    chunks = await _vector_search(
        db=db,
        query_vector=query_vector,
        workspace_id=ws_oid,
        document_ids=doc_oids,
        top_k=settings.rag_top_k,
        similarity_threshold=settings.rag_similarity_threshold,
    )

    # --- Step 4: Check for relevant results ---
    if not chunks:
        logger.info("No relevant chunks found for query in workspace=%s", workspace_id)
        return {
            "answer": _REFUSAL,
            "citedDocumentIds": [],
            "citedChunks": [],
            "refused": True,
        }

    logger.info("Retrieved %d chunks for query in workspace=%s", len(chunks), workspace_id)

    # --- Step 5: Build context ---
    context = _build_context(chunks)

    # --- Step 6: Build messages ---
    history_block = _build_history_block(history)

    system_prompt = RAG_SYSTEM_PROMPT.format(
        context=context,
        history_block=history_block,
        question=question,
    )

    messages = [{"role": "user", "content": system_prompt}]

    # --- Step 7: Call LLM ---
    try:
        answer = await llm.chat(
            messages,
            temperature=0.3,
            max_tokens=1500,
        )
        answer = _clean_response(answer)
    except Exception:
        logger.exception("LLM call failed for RAG query")
        return {
            "answer": "I encountered an error processing your question. Please try again.",
            "citedDocumentIds": [],
            "citedChunks": [],
            "refused": False,
        }

    # --- Step 8: Extract cited document IDs ---
    cited_doc_ids = _extract_cited_doc_ids(chunks)

    # --- Step 9: Build cited chunks for response ---
    cited_chunks = [
        {
            "documentId": str(c["documentId"]),
            "chunkIndex": c["chunkIndex"],
            "page": c.get("page"),
            "heading": c.get("heading"),
            "text": c["text"][:300],  # truncate for response payload
            "score": c.get("score", 0.0),
        }
        for c in chunks
    ]

    return {
        "answer": answer,
        "citedDocumentIds": cited_doc_ids,
        "citedChunks": cited_chunks,
        "refused": False,
    }


async def search(
    *,
    workspace_id: str,
    allowed_document_ids: list[str],
    query: str,
    db: AsyncIOMotorDatabase,
    embedder: BaseEmbedProvider,
) -> dict[str, Any]:
    """Semantic search without an LLM answer."""
    if not allowed_document_ids or not query.strip():
        return {"hits": []}

    settings = get_settings()
    ws_oid = ObjectId(workspace_id)
    doc_oids = [ObjectId(did) for did in allowed_document_ids]
    try:
        query_embeddings = await embedder.embed([query])
    except Exception:
        logger.exception("Search embedding failed")
        return {"hits": []}
    if not query_embeddings:
        return {"hits": []}

    chunks = await _vector_search(
        db=db,
        query_vector=query_embeddings[0],
        workspace_id=ws_oid,
        document_ids=doc_oids,
        top_k=settings.rag_top_k,
        similarity_threshold=min(settings.rag_similarity_threshold, 0.45),
    )

    hits = []
    seen: set[str] = set()
    for c in chunks:
        doc_id = str(c.get("documentId", ""))
        if not doc_id or doc_id in seen:
            continue
        seen.add(doc_id)
        hits.append(
            {
                "documentId": doc_id,
                "score": c.get("score", 0.0),
                "snippet": (c.get("text") or "")[:240],
                "page": c.get("page"),
            }
        )
    return {"hits": hits}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _vector_search(
    *,
    db: AsyncIOMotorDatabase,
    query_vector: list[float],
    workspace_id: ObjectId,
    document_ids: list[ObjectId],
    top_k: int,
    similarity_threshold: float,
) -> list[dict]:
    """Run Atlas Vector Search, then cosine fallback if Atlas is unavailable.

    Atlas index (optional, named 'vector_index' on document_chunks):
        - path: embedding
        - filter fields: workspaceId, documentId
        - similarity: cosine
    """
    try:
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "vector_index",
                    "path": "embedding",
                    "queryVector": query_vector,
                    "numCandidates": top_k * 10,
                    "limit": top_k,
                    "filter": {
                        "workspaceId": workspace_id,
                        "documentId": {"$in": document_ids},
                    },
                }
            },
            {"$addFields": {"score": {"$meta": "vectorSearchScore"}}},
            {"$project": {"embedding": 0}},
        ]
        results = []
        async for doc in db.document_chunks.aggregate(pipeline):
            score = doc.get("score", 0.0)
            if score >= similarity_threshold:
                results.append(doc)
        if results:
            return results
    except Exception:
        logger.warning("Atlas Vector Search unavailable; using cosine fallback")

    return await _cosine_search(
        db=db,
        query_vector=query_vector,
        workspace_id=workspace_id,
        document_ids=document_ids,
        top_k=top_k,
        similarity_threshold=min(similarity_threshold, 0.45),
    )


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na <= 0 or nb <= 0:
        return 0.0
    return dot / ((na ** 0.5) * (nb ** 0.5))


async def _cosine_search(
    *,
    db: AsyncIOMotorDatabase,
    query_vector: list[float],
    workspace_id: ObjectId,
    document_ids: list[ObjectId],
    top_k: int,
    similarity_threshold: float,
) -> list[dict]:
    cursor = db.document_chunks.find(
        {"workspaceId": workspace_id, "documentId": {"$in": document_ids}},
        {"text": 1, "page": 1, "heading": 1, "kind": 1, "chunkIndex": 1, "documentId": 1, "embedding": 1},
    ).limit(2500)

    scored: list[tuple[float, dict]] = []
    async for doc in cursor:
        embedding = doc.get("embedding") or []
        score = _cosine(query_vector, embedding)
        if score >= similarity_threshold:
            doc["score"] = score
            doc.pop("embedding", None)
            scored.append((score, doc))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [doc for _, doc in scored[:top_k]]


def _build_context(chunks: list[dict]) -> str:
    """Format retrieved chunks into a context string for the LLM prompt."""
    parts: list[str] = []
    for i, c in enumerate(chunks):
        doc_id = str(c.get("documentId", ""))
        page = c.get("page", "?")
        heading = c.get("heading") or ""
        kind = c.get("kind", "paragraph")
        score = c.get("score", 0.0)

        header_parts = [f"[Chunk {i}]"]
        header_parts.append(f"(Doc: {doc_id[-8:]}, Page {page})")
        if heading:
            header_parts.append(f"[{heading}]")
        if kind == "table":
            header_parts.append("<TABLE>")

        parts.append(f"{' '.join(header_parts)}\n{c['text']}\n")

    return "\n".join(parts)


def _build_history_block(history: list[dict[str, str]]) -> str:
    """Format chat history for the prompt."""
    if not history:
        return ""
    lines = ["CONVERSATION HISTORY:"]
    for msg in history:
        role = msg.get("role", "user").upper()
        content = msg.get("content", "")
        # Truncate long history messages to keep context manageable
        if len(content) > 500:
            content = content[:500] + "..."
        lines.append(f"  {role}: {content}")
    return "\n".join(lines)


def _extract_cited_doc_ids(chunks: list[dict]) -> list[str]:
    """Extract unique document IDs from retrieved chunks."""
    seen: set[str] = set()
    result: list[str] = []
    for c in chunks:
        doc_id = str(c.get("documentId", ""))
        if doc_id and doc_id not in seen:
            seen.add(doc_id)
            result.append(doc_id)
    return result


def _clean_response(text: str) -> str:
    """Clean LLM response: strip preamble and thinking tags."""
    import re

    # Remove <think> tags
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

    # Strip common preambles
    preamble_re = re.compile(
        r"^(?:\s*(?:sure|certainly|of course|absolutely|okay|ok|"
        r"let me|i(?:'|')?ll|based on|here(?:'s| is))"
        r"[\s,:.!—-]*)+",
        re.IGNORECASE,
    )
    text = preamble_re.sub("", text).lstrip()

    return text
