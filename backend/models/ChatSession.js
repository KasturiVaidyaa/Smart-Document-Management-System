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
      enum: ["workspace", "document"],
      default: "workspace",
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },
    lastMessageAt: Date,
  },
  { timestamps: true, collection: "chat_sessions" }
);

chatSessionSchema.index({ workspaceId: 1, userId: 1, lastMessageAt: -1 });

export const ChatSession = mongoose.model("ChatSession", chatSessionSchema);
