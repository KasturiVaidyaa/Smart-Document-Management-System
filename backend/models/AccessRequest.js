import mongoose from "mongoose";

const accessRequestSchema = new mongoose.Schema(
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
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "denied"],
      default: "pending",
    },
    message: String,
  },
  { timestamps: true }
);

accessRequestSchema.index({ workspaceId: 1, documentId: 1, requesterId: 1 });

export const AccessRequest = mongoose.model("AccessRequest", accessRequestSchema);
