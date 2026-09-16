import mongoose from "mongoose";

const documentChunkSchema = new mongoose.Schema(
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
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    page: Number,
    heading: String,
    kind: String,
    embedding: { type: [Number], default: [] },
  },
  { timestamps: true, collection: "document_chunks" }
);

documentChunkSchema.index({ documentId: 1, versionId: 1 });
documentChunkSchema.index({ workspaceId: 1, documentId: 1 });

export const DocumentChunk = mongoose.model("DocumentChunk", documentChunkSchema);
