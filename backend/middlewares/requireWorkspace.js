import mongoose from "mongoose";
import { Workspace } from "../models/Workspace.js";
import { WorkspaceMember } from "../models/WorkspaceMember.js";
import { membershipPermissions } from "../services/workspaceService.js";

export const requireWorkspace = async (req, res, next) => {
  try {
    const workspaceId = req.params.workspaceId;
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ message: "Invalid workspace id" });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    const membership = await WorkspaceMember.findOne({
      workspaceId,
      userId: req.user._id,
    }).populate("roleIds");

    const isOwner = String(workspace.ownerId) === String(req.user._id);

    if (!isOwner && (!membership || membership.status !== "active")) {
      return res.status(403).json({ message: "Not a member of this workspace" });
    }

    if (membership?.status === "suspended" || membership?.status === "removed") {
      return res.status(403).json({ message: "Workspace access denied" });
    }

    req.workspace = workspace;
    req.membership = membership;
    req.authz = membershipPermissions(membership, workspace, req.user._id);
    next();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const requirePermission = (permission) => (req, res, next) => {
  if (req.authz?.isOwner) return next();
  if (req.authz?.permissions?.includes(permission)) return next();
  return res.status(403).json({ message: "Insufficient permissions" });
};
