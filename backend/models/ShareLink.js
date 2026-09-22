import mongoose from "mongoose";
import { LINK_ACTIONS } from "../constants/permissions.js";

const shareLinkSchema = new mongoose.Schema(
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
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    passwordHash: String,
    actions: [
      {
        type: String,
        enum: LINK_ACTIONS,
      },
    ],
    expiresAt: Date,
    revokedAt: Date,
    maxViews: Number,
    viewCount: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const ShareLink = mongoose.model("ShareLink", shareLinkSchema);
