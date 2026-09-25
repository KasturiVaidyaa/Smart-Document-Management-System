import mongoose from "mongoose";

const chatSessionSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, default: "New chat" },
    scope: {
      type: String,
      // "workspace"  — all accessible docs in the workspace
      // "document"   — single document
      // "folder"     — all documents inside a folder (recursive)
      // "multi"      — explicitly selected set of documents
      enum: ["workspace", "document", "folder", "multi"],
      default: "workspace",
    },
    /** Single-document scope */
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },
    /** Folder scope — folder id */
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },
    /** Multi-document scope — fixed set of doc IDs */
    documentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
      },
    ],
    lastMessageAt: Date,
  },
  { timestamps: true, collection: "chat_sessions" }
);

chatSessionSchema.index({ workspaceId: 1, userId: 1, lastMessageAt: -1 });

export const ChatSession = mongoose.model("ChatSession", chatSessionSchema);
