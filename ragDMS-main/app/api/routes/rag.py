"""RAG chat endpoint — POST /rag/chat."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.schemas import (
    ChatRequest, ChatResponse, CitedChunk,
    SearchRequest, SearchResponse,
    SummarizeRequest, SummarizeResponse,
    SuggestTagsRequest, SuggestTagsResponse,
    ClassifyRequest, ClassifyResponse,
)
from app.deps import get_db, get_embed_provider, get_llm_provider
from app.middleware.auth import verify_internal_token
from app.providers.base import BaseEmbedProvider, BaseLLMProvider
from app.services.rag_service import (
    chat, chat_stream, search,
    summarize_documents, suggest_tags, classify_document,
)
from fastapi.responses import StreamingResponse

logger = logging.getLogger("ragdms.routes.rag")

router = APIRouter(
    prefix="/rag",
    tags=["rag"],
    dependencies=[Depends(verify_internal_token)],
)


@router.post("/chat", response_model=ChatResponse)
async def rag_chat(
    req: ChatRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    llm: BaseLLMProvider = Depends(get_llm_provider),
    embedder: BaseEmbedProvider = Depends(get_embed_provider),
) -> ChatResponse:
    """RAG query over permitted documents.

    Called by Express with workspaceId, allowedDocumentIds (pre-computed by ACL),
    question, and optional history for multi-turn context.

    If allowedDocumentIds is empty, returns refusal immediately.
    If no relevant chunks are found, returns refusal.
    """
    logger.info(
        "RAG chat: workspace=%s, docs=%d, session=%s",
        req.workspaceId,
        len(req.allowedDocumentIds),
        req.sessionId,
    )

    history = [{"role": m.role, "content": m.content} for m in req.history]

    result = await chat(
        workspace_id=req.workspaceId,
        session_id=req.sessionId,
        allowed_document_ids=req.allowedDocumentIds,
        question=req.question,
        history=history,
        db=db,
        llm=llm,
        embedder=embedder,
    )

    cited_chunks = [
        CitedChunk(**c) for c in result.get("citedChunks", [])
    ]

    return ChatResponse(
        answer=result["answer"],
        citedDocumentIds=result.get("citedDocumentIds", []),
        citedChunks=cited_chunks,
        refused=result.get("refused", False),
    )


@router.post("/chat/stream")
async def rag_chat_stream(
    req: ChatRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    llm: BaseLLMProvider = Depends(get_llm_provider),
    embedder: BaseEmbedProvider = Depends(get_embed_provider),
):
    """Streaming RAG query."""
    history = [{"role": m.role, "content": m.content} for m in req.history]

    return StreamingResponse(
        chat_stream(
            workspace_id=req.workspaceId,
            session_id=req.sessionId,
            allowed_document_ids=req.allowedDocumentIds,
            question=req.question,
            history=history,
            db=db,
            llm=llm,
            embedder=embedder,
        ),
        media_type="application/x-ndjson"
    )


@router.post("/search", response_model=SearchResponse)
async def rag_search(
    req: SearchRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    embedder: BaseEmbedProvider = Depends(get_embed_provider),
) -> SearchResponse:
    result = await search(
        workspace_id=req.workspaceId,
        allowed_document_ids=req.allowedDocumentIds,
        query=req.query,
        db=db,
        embedder=embedder,
    )
    return SearchResponse(hits=result.get("hits", []))


@router.post("/summarize", response_model=SummarizeResponse)
async def rag_summarize(
    req: SummarizeRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    llm: BaseLLMProvider = Depends(get_llm_provider),
    embedder: BaseEmbedProvider = Depends(get_embed_provider),
) -> SummarizeResponse:
    """Summarize one or more documents."""
    logger.info("RAG summarize: workspace=%s, docs=%d", req.workspaceId, len(req.documentIds))
    result = await summarize_documents(
        workspace_id=req.workspaceId,
        document_ids=req.documentIds,
        prompt=req.prompt,
        db=db,
        llm=llm,
        embedder=embedder,
    )
    return SummarizeResponse(**result)


@router.post("/suggest-tags", response_model=SuggestTagsResponse)
async def rag_suggest_tags(
    req: SuggestTagsRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    llm: BaseLLMProvider = Depends(get_llm_provider),
) -> SuggestTagsResponse:
    """Suggest tags/keywords for a document."""
    logger.info("RAG suggest-tags: workspace=%s, doc=%s", req.workspaceId, req.documentId)
    result = await suggest_tags(
        workspace_id=req.workspaceId,
        document_id=req.documentId,
        db=db,
        llm=llm,
    )
    return SuggestTagsResponse(**result)


@router.post("/classify", response_model=ClassifyResponse)
async def rag_classify(
    req: ClassifyRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    llm: BaseLLMProvider = Depends(get_llm_provider),
) -> ClassifyResponse:
    """Classify a document into a category."""
    logger.info("RAG classify: workspace=%s, doc=%s", req.workspaceId, req.documentId)
    result = await classify_document(
        workspace_id=req.workspaceId,
        document_id=req.documentId,
        categories=req.categories,
        db=db,
        llm=llm,
    )
    return ClassifyResponse(**result)

