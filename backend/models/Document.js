import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    name: { type: String, required: true, trim: true },
    mimeType: String,
    extension: String,
    currentVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DocumentVersion",
      default: null,
    },
    versionCount: { type: Number, default: 0 },
    sizeBytes: { type: Number, default: 0 },
    tags: [String],
    category: String,
    aiCategory: String,
    aiKeywords: [String],
    summary: String,
    status: {
      type: String,
      enum: ["active", "trash", "deleted"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastAccessedAt: Date,
  },
  { timestamps: true, collection: "documents" }
);

documentSchema.index({ workspaceId: 1, folderId: 1, status: 1 });
documentSchema.index({ workspaceId: 1, departmentId: 1 });
documentSchema.index({ workspaceId: 1, createdBy: 1 });
documentSchema.index({ workspaceId: 1, tags: 1 });
documentSchema.index({ workspaceId: 1, aiCategory: 1 });

export const Document = mongoose.model("Document", documentSchema);
