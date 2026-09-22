import mongoose from "mongoose";

const folderSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    path: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    inheritAcl: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

folderSchema.index({ workspaceId: 1, parentId: 1 });
folderSchema.index({ workspaceId: 1, path: 1 });

export const Folder = mongoose.model("Folder", folderSchema);
