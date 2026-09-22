import mongoose from "mongoose";
import {
  DEFAULT_CATEGORIES,
  PERSONAL_QUOTA_BYTES,
} from "../constants/permissions.js";

const workspaceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["personal", "organization"],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    storageQuotaBytes: {
      type: Number,
      default: PERSONAL_QUOTA_BYTES,
    },
    storageUsedBytes: {
      type: Number,
      default: 0,
    },
    settings: {
      allowExternalSharing: { type: Boolean, default: true },
      defaultLinkExpiryHours: { type: Number, default: 72 },
      aiEnabled: { type: Boolean, default: true },
      categories: { type: [String], default: () => [...DEFAULT_CATEGORIES] },
    },
  },
  { timestamps: true, collection: "workspaces" }
);

workspaceSchema.index({ ownerId: 1 });

export const Workspace = mongoose.model("Workspace", workspaceSchema);
