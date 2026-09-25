import TryCatch from "../utils/TryCatch.js";
import mongoose from "mongoose";
import { ChatSession } from "../models/ChatSession.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { Document } from "../models/Document.js";
import { Folder } from "../models/Folder.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { resolveAllowedIds, folderDocumentIds } from "../services/aiJobs.js";
import { ragChat, ragChatStream, ragSummarize } from "../services/aiService.js";

const HISTORY_LIMIT = 16; // larger window for richer context

// ── List sessions ─────────────────────────────────────────────────────────────
export const listChatSessions = TryCatch(async (req, res) => {
  const sessions = await ChatSession.find({
    workspaceId: req.workspace._id,
    userId: req.user._id,
  })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(50)
    .populate("documentId", "name")
    .populate("folderId", "name");

  res.json({ sessions });
});

// ── Create a named session (document/folder/multi/workspace scope) ────────────
export const createChatSession = TryCatch(async (req, res) => {
  const validScopes = ["workspace", "document", "folder", "multi"];
  const scope = validScopes.includes(req.body.scope) ? req.body.scope : "workspace";

  let documentId = null;
  let folderId = null;
  let documentIds = [];
  let title = req.body.title || "New chat";

  if (scope === "document") {
    if (!req.body.documentId) {
      return res.status(400).json({ message: "documentId is required for document scope" });
    }
    const doc = await Document.findOne({
      _id: req.body.documentId,
      workspaceId: req.workspace._id,
      status: "active",
    });
    if (!doc) return res.status(404).json({ message: "Document not found" });
    documentId = doc._id;
    title = req.body.title || `Chat: ${doc.name}`;
  }

  if (scope === "folder") {
    if (!req.body.folderId) {
      return res.status(400).json({ message: "folderId is required for folder scope" });
    }
    const folder = await Folder.findOne({
      _id: req.body.folderId,
      workspaceId: req.workspace._id,
    });
    if (!folder) return res.status(404).json({ message: "Folder not found" });
    folderId = folder._id;
    title = req.body.title || `Folder: ${folder.name}`;
  }

  if (scope === "multi") {
    if (!Array.isArray(req.body.documentIds) || req.body.documentIds.length === 0) {
      return res.status(400).json({ message: "documentIds array is required for multi scope" });
    }
    const ids = req.body.documentIds.map((id) => new mongoose.Types.ObjectId(id));
    const docs = await Document.find({
      _id: { $in: ids },
      workspaceId: req.workspace._id,
      status: "active",
    }).select("_id");
    documentIds = docs.map((d) => d._id);
    title = req.body.title || `Chat (${documentIds.length} docs)`;
  }

  const session = await ChatSession.create({
    workspaceId: req.workspace._id,
    userId: req.user._id,
    title,
    scope,
    documentId,
    folderId,
    documentIds,
    lastMessageAt: new Date(),
  });

  res.status(201).json({ session });
});

// ── List messages in a session ────────────────────────────────────────────────
export const listChatMessages = TryCatch(async (req, res) => {
  const session = await ChatSession.findOne({
    _id: req.params.sessionId,
    workspaceId: req.workspace._id,
    userId: req.user._id,
  });
  if (!session) {
    return res.status(404).json({ message: "Chat session not found" });
  }
  const messages = await ChatMessage.find({ sessionId: session._id }).sort({ createdAt: 1 });
  res.json({ session, messages });
});

// ── Send a chat message (main RAG entry-point) ────────────────────────────────
export const sendChatMessage = TryCatch(async (req, res) => {
  const question = req.body.question?.trim();
  if (!question) {
    return res.status(400).json({ message: "Question is required" });
  }

  // ── Resolve or create session ────────────────────────────────────────────
  let session;
  if (req.body.sessionId) {
    session = await ChatSession.findOne({
      _id: req.body.sessionId,
      workspaceId: req.workspace._id,
      userId: req.user._id,
    });
    if (!session) {
      return res.status(404).json({ message: "Chat session not found" });
    }
  } else {
    // Auto-detect scope from request body
    let scope = "workspace";
    let documentId = null;
    let folderId = null;
    let documentIds = [];

    if (req.body.folderId) {
      scope = "folder";
      folderId = req.body.folderId;
    } else if (req.body.documentId) {
      scope = "document";
      documentId = req.body.documentId;
    } else if (Array.isArray(req.body.documentIds) && req.body.documentIds.length > 0) {
      scope = "multi";
      documentIds = req.body.documentIds.map((id) => new mongoose.Types.ObjectId(id));
    }

    session = await ChatSession.create({
      workspaceId: req.workspace._id,
      userId: req.user._id,
      title: question.slice(0, 80),
      scope,
      documentId,
      folderId,
      documentIds,
      lastMessageAt: new Date(),
    });
  }

  // ── Resolve which document IDs are in scope ──────────────────────────────
  const allowed = await resolveAllowedIds({
    workspaceId: String(req.workspace._id),
    session,
    body: req.body,
  });

  if (allowed.length === 0) {
    // No documents available in scope — still answer but note limitation
    const noDocsMsg = await ChatMessage.create({
      sessionId: session._id,
      workspaceId: req.workspace._id,
      role: "assistant",
      content:
        "⚠️ No indexed documents were found in the selected scope. " +
        "Please make sure documents are uploaded and processed before chatting.",
      citedDocumentIds: [],
    });
    await ChatMessage.create({
      sessionId: session._id,
      workspaceId: req.workspace._id,
      role: "user",
      content: question,
    });
    session.lastMessageAt = new Date();
    await session.save();
    return res.json({ session, userMessage: null, assistantMessage: noDocsMsg, citedDocumentIds: [], refused: false });
  }

  // ── Build conversation history ───────────────────────────────────────────
  const prior = await ChatMessage.find({ sessionId: session._id })
    .sort({ createdAt: -1 })
    .limit(HISTORY_LIMIT);
  const history = prior.reverse().map((m) => ({ role: m.role, content: m.content }));

  // ── Setup Streaming Headers ──────────────────────────────────────────────
  if (!res.headersSent) {
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
  }

  // ── Call RAG chat stream (with non-stream fallback) ─────────────────────
  const aiPayload = {
    workspaceId: String(req.workspace._id),
    sessionId: String(session._id),
    allowedDocumentIds: allowed,
    question,
    history,
    scopeHint: session.scope,
  };

  let streamResult;
  try {
    streamResult = await ragChatStream(aiPayload, res);
  } catch (streamError) {
    console.warn("Stream failed, falling back to non-stream:", streamError.message);
    // Fallback to non-streaming RAG chat
    try {
      const fallback = await ragChat(aiPayload);
      const answer = fallback.answer || "";
      const meta = {
        citedDocumentIds: fallback.citedDocumentIds || [],
        citedChunks: fallback.citedChunks || [],
        refused: fallback.refused || false,
      };
      // Write the full response as NDJSON lines so the frontend can still parse it
      if (!res.writableEnded) {
        res.write(JSON.stringify({ type: "meta", ...meta }) + "\n");
        if (answer) {
          res.write(JSON.stringify({ type: "text", content: answer }) + "\n");
        }
      }
      streamResult = { answer, meta, hasError: false };
    } catch (fallbackError) {
      console.error("Both stream and fallback failed:", fallbackError.message);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to connect to AI service." });
      } else if (!res.writableEnded) {
        res.write(JSON.stringify({ type: "error", content: "Failed to connect to AI service." }) + "\n");
        res.end();
      }
      return;
    }
  }

  // ── Persist messages ─────────────────────────────────────────────────────
  try {
    const userMessage = await ChatMessage.create({
      sessionId: session._id,
      workspaceId: req.workspace._id,
      role: "user",
      content: question,
    });

    const aiMeta = streamResult.meta || {};
    let assistantMessage = null;
    
    if (streamResult.answer) {
      assistantMessage = await ChatMessage.create({
        sessionId: session._id,
        workspaceId: req.workspace._id,
        role: "assistant",
        content: streamResult.answer,
        citedDocumentIds: aiMeta.citedDocumentIds || [],
      });
    }

    // Auto-title on first message
    if (
      ["New chat", "Document chat", "Folder chat"].includes(session.title) ||
      (session.title.startsWith("Folder: ") === false && session.title.startsWith("Chat: ") === false)
    ) {
      session.title = question.slice(0, 80);
    }
    session.lastMessageAt = new Date();
    await session.save();

    // ── Audit ────────────────────────────────────────────────────────────────
    await AuditEvent.create({
      workspaceId: req.workspace._id,
      actorId: req.user._id,
      actorEmail: req.user.email,
      action: "ai.qa",
      resourceType: "chat_session",
      resourceId: session._id,
      metadata: {
        scope: session.scope,
        docCount: allowed.length,
        refused: Boolean(aiMeta.refused),
      },
    });

    // Send final message with session details to frontend before closing
    if (!res.writableEnded) {
      res.write(
        JSON.stringify({
          type: "complete",
          session,
          userMessage,
          assistantMessage,
          citedDocumentIds: aiMeta.citedDocumentIds || [],
          citedChunks: aiMeta.citedChunks || [],
          refused: Boolean(aiMeta.refused),
        }) + "\n"
      );
      res.end();
    }
  } catch (dbError) {
    console.error("Database save error after stream:", dbError);
    if (!res.writableEnded) {
      res.write(JSON.stringify({ type: "error", content: "Failed to save chat history." }) + "\n");
      res.end();
    }
  }
});

// ── Folder AI summary ─────────────────────────────────────────────────────────
/**
 * POST /api/workspaces/:workspaceId/folders/:folderId/summarize
 * Generates an AI summary of all documents inside a folder.
 */
export const summarizeFolder = TryCatch(async (req, res) => {
  const { folderId } = req.params;

  const folder = await Folder.findOne({
    _id: folderId,
    workspaceId: req.workspace._id,
  });
  if (!folder) return res.status(404).json({ message: "Folder not found" });

  const docIds = await folderDocumentIds(String(req.workspace._id), folderId);
  if (docIds.length === 0) {
    return res.json({ summary: "No indexed documents found in this folder.", docCount: 0 });
  }

  const result = await ragSummarize({
    workspaceId: String(req.workspace._id),
    documentIds: docIds,
    prompt: req.body.prompt || `Summarize the key themes and content of these ${docIds.length} documents.`,
  });

  await AuditEvent.create({
    workspaceId: req.workspace._id,
    actorId: req.user._id,
    actorEmail: req.user.email,
    action: "ai.summarize_folder",
    resourceType: "folder",
    resourceId: folder._id,
    metadata: { docCount: docIds.length },
  });

  res.json({
    summary: result.summary || result.answer || "",
    docCount: docIds.length,
    folderId: folder._id,
    folderName: folder.name,
  });
});

// ── Rename / delete session (unchanged) ──────────────────────────────────────
export const renameChatSession = TryCatch(async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ message: "Title is required" });
  }
  const session = await ChatSession.findOneAndUpdate(
    { _id: req.params.sessionId, workspaceId: req.workspace._id, userId: req.user._id },
    { title: title.trim() },
    { new: true }
  );
  if (!session) return res.status(404).json({ message: "Chat session not found" });
  res.json({ session });
});

export const deleteChatSession = TryCatch(async (req, res) => {
  const session = await ChatSession.findOne({
    _id: req.params.sessionId,
    workspaceId: req.workspace._id,
    userId: req.user._id,
  });
  if (!session) return res.status(404).json({ message: "Chat session not found" });
  await ChatMessage.deleteMany({ sessionId: session._id });
  await session.deleteOne();
  res.json({ message: "Chat session deleted successfully" });
});
