import mongoose from "mongoose";

const aiJobSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    versionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DocumentVersion",
      required: true,
    },
    type: {
      type: String,
      enum: ["extract", "embed", "summarize", "categorize", "process"],
      default: "process",
    },
    status: {
      type: String,
      enum: ["queued", "running", "ready", "failed"],
      default: "queued",
    },
    error: String,
  },
  { timestamps: true, collection: "ai_jobs" }
);

aiJobSchema.index({ status: 1, updatedAt: 1 });
aiJobSchema.index({ documentId: 1, versionId: 1 });

export const AiJob = mongoose.model("AiJob", aiJobSchema);
