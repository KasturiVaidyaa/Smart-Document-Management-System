import TryCatch from "../utils/TryCatch.js";
import { ChatSession } from "../models/ChatSession.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { Document } from "../models/Document.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { allowedDocumentIds } from "../services/aiJobs.js";
import { ragChat } from "../services/aiService.js";

const HISTORY_LIMIT = 12;

export const listChatSessions = TryCatch(async (req, res) => {
  const sessions = await ChatSession.find({
    workspaceId: req.workspace._id,
    userId: req.user._id,
  })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(50);

  res.json({ sessions });
});

export const createChatSession = TryCatch(async (req, res) => {
  const scope = req.body.scope === "document" ? "document" : "workspace";
  let documentId = null;

  if (scope === "document") {
    if (!req.body.documentId) {
      return res.status(400).json({ message: "documentId is required" });
    }
    const doc = await Document.findOne({
      _id: req.body.documentId,
      workspaceId: req.workspace._id,
      status: "active",
    });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }
    documentId = doc._id;
  }

  const session = await ChatSession.create({
    workspaceId: req.workspace._id,
    userId: req.user._id,
    title: req.body.title || (scope === "document" ? "Document chat" : "New chat"),
    scope,
    documentId,
    lastMessageAt: new Date(),
  });

  res.status(201).json({ session });
});

export const listChatMessages = TryCatch(async (req, res) => {
  const session = await ChatSession.findOne({
    _id: req.params.sessionId,
    workspaceId: req.workspace._id,
    userId: req.user._id,
  });
  if (!session) {
    return res.status(404).json({ message: "Chat session not found" });
  }

  const messages = await ChatMessage.find({ sessionId: session._id }).sort({
    createdAt: 1,
  });
  res.json({ session, messages });
});

export const sendChatMessage = TryCatch(async (req, res) => {
  const question = req.body.question?.trim();
  if (!question) {
    return res.status(400).json({ message: "Question is required" });
  }

  let session = null;
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
    session = await ChatSession.create({
      workspaceId: req.workspace._id,
      userId: req.user._id,
      title: question.slice(0, 80),
      scope: req.body.documentId ? "document" : "workspace",
      documentId: req.body.documentId || null,
      lastMessageAt: new Date(),
    });
  }

  let allowed = await allowedDocumentIds(req.workspace._id);
  if (session.scope === "document" && session.documentId) {
    // Single-document scoped session (original behavior)
    allowed = allowed.filter((id) => id === String(session.documentId));
  } else if (req.body.documentIds && Array.isArray(req.body.documentIds) && req.body.documentIds.length > 0) {
    // Multi-document scoped chat: filter allowed to only the requested document IDs
    const requestedIds = new Set(req.body.documentIds.map(String));
    allowed = allowed.filter((id) => requestedIds.has(id));
  }

  const prior = await ChatMessage.find({ sessionId: session._id })
    .sort({ createdAt: -1 })
    .limit(HISTORY_LIMIT);
  const history = prior
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));

  const result = await ragChat({
    workspaceId: String(req.workspace._id),
    sessionId: String(session._id),
    allowedDocumentIds: allowed,
    question,
    history,
  });

  const userMessage = await ChatMessage.create({
    sessionId: session._id,
    workspaceId: req.workspace._id,
    role: "user",
    content: question,
  });

  const assistantMessage = await ChatMessage.create({
    sessionId: session._id,
    workspaceId: req.workspace._id,
    role: "assistant",
    content: result.answer || "",
    citedDocumentIds: result.citedDocumentIds || [],
  });

  if (session.title === "New chat" || session.title === "Document chat") {
    session.title = question.slice(0, 80);
  }
  session.lastMessageAt = new Date();
  await session.save();

  await AuditEvent.create({
    workspaceId: req.workspace._id,
    actorId: req.user._id,
    actorEmail: req.user.email,
    action: "ai.qa",
    resourceType: "chat_session",
    resourceId: session._id,
    metadata: { refused: Boolean(result.refused) },
  });

  res.json({
    session,
    userMessage,
    assistantMessage,
    citedDocumentIds: result.citedDocumentIds || [],
    citedChunks: result.citedChunks || [],
    refused: Boolean(result.refused),
  });
});

export const renameChatSession = TryCatch(async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ message: "Title is required" });
  }

  const session = await ChatSession.findOneAndUpdate(
    {
      _id: req.params.sessionId,
      workspaceId: req.workspace._id,
      userId: req.user._id,
    },
    { title: title.trim() },
    { new: true }
  );

  if (!session) {
    return res.status(404).json({ message: "Chat session not found" });
  }

  res.json({ session });
});

export const deleteChatSession = TryCatch(async (req, res) => {
  const session = await ChatSession.findOne({
    _id: req.params.sessionId,
    workspaceId: req.workspace._id,
    userId: req.user._id,
  });

  if (!session) {
    return res.status(404).json({ message: "Chat session not found" });
  }

  // Delete all messages in the session
  await ChatMessage.deleteMany({ sessionId: session._id });
  // Delete the session itself
  await session.deleteOne();

  res.json({ message: "Chat session deleted successfully" });
});
