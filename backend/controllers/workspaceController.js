import mongoose from "mongoose";
import validator from "validator";
import TryCatch from "../utils/TryCatch.js";
import { Workspace } from "../models/Workspace.js";
import { WorkspaceMember } from "../models/WorkspaceMember.js";
import { User } from "../models/User.js";
import { Role } from "../models/Role.js";
import { Department } from "../models/Department.js";
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

/**
 * GET /api/workspaces/:workspaceId/members
 *
 * List workspace members with their names, emails, roles, and departments.
 * Preserves the exact response contract for PermissionsModal.jsx while supporting
 * status filtering (?status=all, ?status=active) and returning status, isOwner, joinedAt.
 */
export const listWorkspaceMembers = TryCatch(async (req, res) => {
  const { status } = req.query;
  const filter = { workspaceId: req.workspace._id };

  if (status && status !== "all") {
    filter.status = status;
  } else if (!status) {
    // Default to active members, preserving exact backwards compatibility
    filter.status = "active";
  }

  const members = await WorkspaceMember.find(filter)
    .populate("userId", "name email avatarUrl")
    .populate("roleIds", "name isOwner isSystem")
    .populate("departmentIds", "name")
    .populate("invitedBy", "name email");

  const isOwnerUser = (userId) => String(req.workspace.ownerId) === String(userId);

  const result = members
    .filter((m) => m.userId)
    .map((m) => ({
      _id: m._id,
      userId: m.userId._id,
      name: m.userId.name,
      email: m.userId.email,
      avatarUrl: m.userId.avatarUrl,
      roles: (m.roleIds || []).map((r) => ({
        _id: r._id,
        name: r.name,
        isOwner: r.isOwner,
        isSystem: r.isSystem,
      })),
      departments: (m.departmentIds || []).map((d) => ({
        _id: d._id,
        name: d.name,
      })),
      status: m.status,
      isOwner: isOwnerUser(m.userId._id),
      invitedBy: m.invitedBy
        ? { _id: m.invitedBy._id, name: m.invitedBy.name, email: m.invitedBy.email }
        : null,
      joinedAt: m.joinedAt || m.createdAt,
    }));

  res.json({ members: result });
});

/**
 * POST /api/workspaces/:workspaceId/members
 *
 * Add an existing registered user to the workspace by email.
 * Requires "members.invite" permission or workspace ownership.
 *
 * Body: { email, roleIds?, departmentIds? }
 */
export const inviteWorkspaceMember = TryCatch(async (req, res) => {
  const { email, roleIds = [], departmentIds = [] } = req.body;

  if (!email || typeof email !== "string" || !validator.isEmail(email)) {
    return res.status(400).json({ message: "A valid email address is required" });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Find user by email
  const targetUser = await User.findOne({ email: normalizedEmail });
  if (!targetUser) {
    return res.status(404).json({
      message: "User not found. The user must be registered before being added to a workspace.",
    });
  }

  // Authoritative owner check: target cannot be the workspace owner
  const isOwner = String(req.workspace.ownerId) === String(targetUser._id);
  if (isOwner) {
    return res.status(400).json({ message: "User is already the workspace owner" });
  }

  // Cross-workspace role verification
  let assignedRoleIds = [];
  if (Array.isArray(roleIds) && roleIds.length > 0) {
    for (const rid of roleIds) {
      if (!mongoose.Types.ObjectId.isValid(rid)) {
        return res.status(400).json({ message: "Invalid role id provided" });
      }
    }
    const roles = await Role.find({
      _id: { $in: roleIds },
      workspaceId: req.workspace._id,
    });
    if (roles.length !== roleIds.length) {
      return res.status(400).json({ message: "One or more roles do not belong to this workspace" });
    }
    // Prevent assigning an Owner role to an invited member
    if (roles.some((r) => r.isOwner)) {
      return res.status(400).json({ message: "Cannot assign Owner role to invited members" });
    }
    assignedRoleIds = roles.map((r) => r._id);
  } else {
    // Default to Employee role in this workspace if available
    const defaultRole = await Role.findOne({
      workspaceId: req.workspace._id,
      name: "Employee",
    });
    if (defaultRole) {
      assignedRoleIds = [defaultRole._id];
    }
  }

  // Cross-workspace department verification
  let assignedDepartmentIds = [];
  if (Array.isArray(departmentIds) && departmentIds.length > 0) {
    for (const did of departmentIds) {
      if (!mongoose.Types.ObjectId.isValid(did)) {
        return res.status(400).json({ message: "Invalid department id provided" });
      }
    }
    const depts = await Department.find({
      _id: { $in: departmentIds },
      workspaceId: req.workspace._id,
    });
    if (depts.length !== departmentIds.length) {
      return res.status(400).json({ message: "One or more departments do not belong to this workspace" });
    }
    assignedDepartmentIds = depts.map((d) => d._id);
  }

  // Check if member already exists in this workspace
  let member = await WorkspaceMember.findOne({
    workspaceId: req.workspace._id,
    userId: targetUser._id,
  });

  if (member) {
    if (member.status === "active") {
      return res.status(400).json({ message: "User is already an active member of this workspace" });
    }
    if (member.status === "invited") {
      return res.status(400).json({ message: "User has already been invited to this workspace" });
    }
    // Reactivate previously removed or suspended member
    member.status = "active";
    member.roleIds = assignedRoleIds;
    member.departmentIds = assignedDepartmentIds;
    member.invitedBy = req.user._id;
    member.joinedAt = new Date();
    await member.save();
  } else {
    member = await WorkspaceMember.create({
      workspaceId: req.workspace._id,
      userId: targetUser._id,
      roleIds: assignedRoleIds,
      departmentIds: assignedDepartmentIds,
      status: "active",
      invitedBy: req.user._id,
      joinedAt: new Date(),
    });
  }

  await member.populate([
    { path: "userId", select: "name email avatarUrl" },
    { path: "roleIds", select: "name isOwner isSystem" },
    { path: "departmentIds", select: "name" },
    { path: "invitedBy", select: "name email" },
  ]);

  res.status(201).json({
    message: "Member added to workspace successfully",
    member: {
      _id: member._id,
      userId: member.userId._id,
      name: member.userId.name,
      email: member.userId.email,
      avatarUrl: member.userId.avatarUrl,
      roles: (member.roleIds || []).map((r) => ({
        _id: r._id,
        name: r.name,
        isOwner: r.isOwner,
        isSystem: r.isSystem,
      })),
      departments: (member.departmentIds || []).map((d) => ({
        _id: d._id,
        name: d.name,
      })),
      status: member.status,
      isOwner: false,
      invitedBy: member.invitedBy
        ? { _id: member.invitedBy._id, name: member.invitedBy.name, email: member.invitedBy.email }
        : null,
      joinedAt: member.joinedAt || member.createdAt,
    },
  });
});

/**
 * PATCH /api/workspaces/:workspaceId/members/:memberId
 *
 * Update a workspace member's roles, departments, or status.
 * Enforces field-specific authorization:
 *   - role changes -> "roles.manage"
 *   - department changes -> "departments.manage"
 *   - status changes -> "roles.manage"
 *
 * Protects workspace owner against demotion, role replacement, and suspension/removal.
 */
export const updateWorkspaceMember = TryCatch(async (req, res) => {
  const { memberId } = req.params;
  const { roleIds, departmentIds, status } = req.body;

  if (!mongoose.Types.ObjectId.isValid(memberId)) {
    return res.status(400).json({ message: "Invalid member id" });
  }

  // Cross-workspace protection: target must belong to this workspace
  const member = await WorkspaceMember.findOne({
    _id: memberId,
    workspaceId: req.workspace._id,
  });

  if (!member) {
    return res.status(404).json({ message: "Member not found in this workspace" });
  }

  // Authoritative owner check using workspace.ownerId
  const isTargetOwner = String(req.workspace.ownerId) === String(member.userId);

  // Field-specific permission checks

  // 1. Role changes require "roles.manage" or Owner
  if (roleIds !== undefined) {
    const canManageRoles = req.authz?.isOwner || req.authz?.permissions?.includes("roles.manage");
    if (!canManageRoles) {
      return res.status(403).json({ message: "Insufficient permissions to manage roles" });
    }

    if (!Array.isArray(roleIds)) {
      return res.status(400).json({ message: "roleIds must be an array" });
    }

    for (const rid of roleIds) {
      if (!mongoose.Types.ObjectId.isValid(rid)) {
        return res.status(400).json({ message: "Invalid role id in roleIds" });
      }
    }

    // Cross-workspace role verification
    const roles = await Role.find({
      _id: { $in: roleIds },
      workspaceId: req.workspace._id,
    });

    if (roles.length !== roleIds.length) {
      return res.status(400).json({ message: "One or more roles do not belong to this workspace" });
    }

    // Owner protection: cannot demote owner or remove their Owner role
    if (isTargetOwner) {
      const includesOwnerRole = roles.some((r) => r.isOwner);
      if (!includesOwnerRole) {
        return res.status(403).json({ message: "Cannot remove the Owner role from the workspace owner" });
      }
    } else {
      // Non-owner cannot be assigned Owner role
      const includesOwnerRole = roles.some((r) => r.isOwner);
      if (includesOwnerRole) {
        return res.status(403).json({ message: "Cannot assign Owner role to a non-owner member" });
      }
    }

    member.roleIds = roles.map((r) => r._id);
  }

  // 2. Department changes require "departments.manage" or Owner
  if (departmentIds !== undefined) {
    const canManageDepts =
      req.authz?.isOwner || req.authz?.permissions?.includes("departments.manage");
    if (!canManageDepts) {
      return res.status(403).json({ message: "Insufficient permissions to manage departments" });
    }

    if (!Array.isArray(departmentIds)) {
      return res.status(400).json({ message: "departmentIds must be an array" });
    }

    for (const did of departmentIds) {
      if (!mongoose.Types.ObjectId.isValid(did)) {
        return res.status(400).json({ message: "Invalid department id in departmentIds" });
      }
    }

    // Cross-workspace department verification
    const depts = await Department.find({
      _id: { $in: departmentIds },
      workspaceId: req.workspace._id,
    });

    if (depts.length !== departmentIds.length) {
      return res.status(400).json({ message: "One or more departments do not belong to this workspace" });
    }

    member.departmentIds = depts.map((d) => d._id);
  }

  // 3. Status changes require "roles.manage" or Owner
  if (status !== undefined) {
    const canManageStatus = req.authz?.isOwner || req.authz?.permissions?.includes("roles.manage");
    if (!canManageStatus) {
      return res.status(403).json({ message: "Insufficient permissions to change member status" });
    }

    if (!["active", "suspended", "removed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // Owner protection: cannot suspend or remove the workspace owner
    if (isTargetOwner && (status === "suspended" || status === "removed")) {
      return res.status(403).json({ message: "Cannot suspend or remove the workspace owner" });
    }

    member.status = status;
  }

  await member.save();

  await member.populate([
    { path: "userId", select: "name email avatarUrl" },
    { path: "roleIds", select: "name isOwner isSystem" },
    { path: "departmentIds", select: "name" },
    { path: "invitedBy", select: "name email" },
  ]);

  res.json({
    message: "Member updated successfully",
    member: {
      _id: member._id,
      userId: member.userId._id,
      name: member.userId.name,
      email: member.userId.email,
      avatarUrl: member.userId.avatarUrl,
      roles: (member.roleIds || []).map((r) => ({
        _id: r._id,
        name: r.name,
        isOwner: r.isOwner,
        isSystem: r.isSystem,
      })),
      departments: (member.departmentIds || []).map((d) => ({
        _id: d._id,
        name: d.name,
      })),
      status: member.status,
      isOwner: isTargetOwner,
      invitedBy: member.invitedBy
        ? { _id: member.invitedBy._id, name: member.invitedBy.name, email: member.invitedBy.email }
        : null,
      joinedAt: member.joinedAt || member.createdAt,
    },
  });
});

/**
 * DELETE /api/workspaces/:workspaceId/members/:memberId
 *
 * Remove a member from the workspace by setting status to "removed".
 * Requires "roles.manage" permission or workspace ownership.
 *
 * Strictly blocks removal of the workspace owner.
 */
export const removeWorkspaceMember = TryCatch(async (req, res) => {
  const { memberId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(memberId)) {
    return res.status(400).json({ message: "Invalid member id" });
  }

  // Cross-workspace protection: target must belong to this workspace
  const member = await WorkspaceMember.findOne({
    _id: memberId,
    workspaceId: req.workspace._id,
  });

  if (!member) {
    return res.status(404).json({ message: "Member not found in this workspace" });
  }

  // Authoritative owner check: Owner cannot be removed
  const isTargetOwner = String(req.workspace.ownerId) === String(member.userId);
  if (isTargetOwner) {
    return res.status(403).json({ message: "Cannot remove the workspace owner" });
  }

  // Terminate workspace access by setting status to "removed"
  member.status = "removed";
  await member.save();

  res.json({
    message: "Member removed from workspace",
    memberId: member._id,
  });
});

/**
 * PATCH /api/workspaces/:workspaceId
 *
 * Update workspace name and administrative collaboration settings.
 * Strictly enforces top-level and nested allowlists.
 * Protected fields (ownerId, type, storageQuotaBytes, storageUsedBytes, slug, _id)
 * are completely immutable and any unknown fields are rejected with 400.
 *
 * Authorized for: Workspace Owner OR users with "roles.manage" permission.
 */
export const updateWorkspace = TryCatch(async (req, res) => {
  // Authorization check: Workspace Owner OR user with "roles.manage" permission
  const canManage =
    req.authz?.isOwner || req.authz?.permissions?.includes("roles.manage");

  if (!canManage) {
    return res.status(403).json({
      message: "Insufficient permissions to modify workspace settings",
    });
  }

  // Top-level allowlist validation: reject any unexpected top-level fields
  const ALLOWED_TOP_FIELDS = ["name", "settings"];
  const bodyKeys = Object.keys(req.body);

  if (bodyKeys.length === 0) {
    return res.status(400).json({ message: "No update fields provided" });
  }

  for (const key of bodyKeys) {
    if (!ALLOWED_TOP_FIELDS.includes(key)) {
      return res.status(400).json({
        message: `Field '${key}' cannot be modified through this endpoint`,
      });
    }
  }

  // Validate and update name if provided
  if (req.body.name !== undefined) {
    if (typeof req.body.name !== "string" || !req.body.name.trim()) {
      return res.status(400).json({ message: "Workspace name cannot be empty" });
    }
    const trimmedName = req.body.name.trim();
    if (trimmedName.length > 100) {
      return res.status(400).json({
        message: "Workspace name cannot exceed 100 characters",
      });
    }
    req.workspace.name = trimmedName;
  }

  // Validate and update settings if provided
  if (req.body.settings !== undefined) {
    if (
      typeof req.body.settings !== "object" ||
      req.body.settings === null ||
      Array.isArray(req.body.settings)
    ) {
      return res.status(400).json({ message: "Settings must be an object" });
    }

    const ALLOWED_SETTINGS_KEYS = [
      "allowExternalSharing",
      "defaultLinkExpiryHours",
      "aiEnabled",
    ];
    const settingsKeys = Object.keys(req.body.settings);

    for (const key of settingsKeys) {
      if (!ALLOWED_SETTINGS_KEYS.includes(key)) {
        return res.status(400).json({
          message: `Setting '${key}' is invalid or cannot be modified`,
        });
      }
    }

    const { allowExternalSharing, defaultLinkExpiryHours, aiEnabled } =
      req.body.settings;

    if (allowExternalSharing !== undefined) {
      if (typeof allowExternalSharing !== "boolean") {
        return res.status(400).json({
          message: "allowExternalSharing must be a boolean",
        });
      }
      req.workspace.settings.allowExternalSharing = allowExternalSharing;
    }

    if (defaultLinkExpiryHours !== undefined) {
      if (
        typeof defaultLinkExpiryHours !== "number" ||
        !Number.isInteger(defaultLinkExpiryHours) ||
        defaultLinkExpiryHours < 1 ||
        defaultLinkExpiryHours > 8760
      ) {
        return res.status(400).json({
          message: "defaultLinkExpiryHours must be an integer between 1 and 8760",
        });
      }
      req.workspace.settings.defaultLinkExpiryHours = defaultLinkExpiryHours;
    }

    if (aiEnabled !== undefined) {
      if (typeof aiEnabled !== "boolean") {
        return res.status(400).json({
          message: "aiEnabled must be a boolean",
        });
      }
      req.workspace.settings.aiEnabled = aiEnabled;
    }
  }

  await req.workspace.save();

  res.json({
    message: "Workspace settings updated successfully",
    ...serializeMembership(req.membership, req.workspace, req.user._id),
  });
});

