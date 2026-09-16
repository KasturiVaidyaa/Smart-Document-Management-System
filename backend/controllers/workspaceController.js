import TryCatch from "../utils/TryCatch.js";
import { Workspace } from "../models/Workspace.js";
import { WorkspaceMember } from "../models/WorkspaceMember.js";
import { runInTransaction } from "../utils/runInTransaction.js";
import {
  createOrganizationWorkspace,
  membershipPermissions,
} from "../services/workspaceService.js";

const serializeMembership = (membership, workspace, userId) => {
  const authz = membershipPermissions(membership, workspace, userId);
  return {
    membershipId: membership?._id,
    status: membership?.status || "active",
    roleIds: membership?.roleIds || [],
    departmentIds: membership?.departmentIds || [],
    isOwner: authz.isOwner,
    permissions: authz.permissions,
    workspace: {
      _id: workspace._id,
      type: workspace.type,
      name: workspace.name,
      slug: workspace.slug,
      ownerId: workspace.ownerId,
      storageQuotaBytes: workspace.storageQuotaBytes,
      storageUsedBytes: workspace.storageUsedBytes,
      settings: workspace.settings,
    },
  };
};

export const listWorkspaces = TryCatch(async (req, res) => {
  const memberships = await WorkspaceMember.find({
    userId: req.user._id,
    status: { $in: ["active", "invited"] },
  }).populate("roleIds");

  const workspaceIds = memberships.map((m) => m.workspaceId);
  const workspaces = await Workspace.find({ _id: { $in: workspaceIds } });
  const byId = Object.fromEntries(workspaces.map((w) => [String(w._id), w]));

  const items = memberships
    .map((m) => {
      const workspace = byId[String(m.workspaceId)];
      if (!workspace) return null;
      return serializeMembership(m, workspace, req.user._id);
    })
    .filter(Boolean);

  res.json({
    personalWorkspaceId: req.user.personalWorkspaceId,
    workspaces: items,
  });
});

export const createOrgWorkspace = TryCatch(async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ message: "Organization name is required" });
  }

  const workspace = await runInTransaction(async (session) =>
    createOrganizationWorkspace({ userId: req.user._id, name: name.trim() }, session)
  );

  const membership = await WorkspaceMember.findOne({
    workspaceId: workspace._id,
    userId: req.user._id,
  }).populate("roleIds");

  res.status(201).json({
    message: "Organization created",
    ...serializeMembership(membership, workspace, req.user._id),
  });
});

export const getWorkspace = TryCatch(async (req, res) => {
  res.json(
    serializeMembership(req.membership, req.workspace, req.user._id)
  );
});
