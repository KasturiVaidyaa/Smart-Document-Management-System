import mongoose from "mongoose";
import { ROLE_PERMISSIONS } from "../constants/permissions.js";

const roleSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    isOwner: {
      type: Boolean,
      default: false,
    },
    permissions: [
      {
        type: String,
        enum: ROLE_PERMISSIONS,
      },
    ],
  },
  { timestamps: true }
);

roleSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

export const Role = mongoose.model("Role", roleSchema);
