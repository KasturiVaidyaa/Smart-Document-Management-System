import mongoose from "mongoose";

const processingState = {
  type: String,
  enum: ["pending", "ready", "failed"],
  default: "pending",
};

const documentVersionSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    versionNumber: { type: Number, required: true },
    filename: String,
    s3Bucket: String,
    s3Key: String,
    s3ETag: String,
    checksum: String,
    sizeBytes: Number,
    mimeType: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    changeNote: String,
    processing: {
      extract: processingState,
      embed: processingState,
      classify: processingState,
    },
  },
  { timestamps: true, collection: "document_versions" }
);

documentVersionSchema.index({ documentId: 1, versionNumber: 1 }, { unique: true });

export const DocumentVersion = mongoose.model(
  "DocumentVersion",
  documentVersionSchema
);
