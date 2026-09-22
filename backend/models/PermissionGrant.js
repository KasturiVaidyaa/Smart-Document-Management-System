import mongoose from "mongoose";
import { DOCUMENT_ACTIONS } from "../constants/permissions.js";

const permissionGrantSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    resourceType: {
      type: String,
      enum: ["folder", "document"],
      required: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    principalType: {
      type: String,
      enum: ["user", "role", "department", "workspace"],
      required: true,
    },
    principalId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    actions: [
      {
        type: String,
        enum: DOCUMENT_ACTIONS,
      },
    ],
    expiresAt: {
      type: Date,
      default: null,
    },
    layer: {
      type: String,
      enum: ["primary", "secondary"],
      default: "primary",
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

permissionGrantSchema.index({ resourceType: 1, resourceId: 1 });
permissionGrantSchema.index({ workspaceId: 1, expiresAt: 1 });

export const PermissionGrant = mongoose.model(
  "PermissionGrant",
  permissionGrantSchema
);
