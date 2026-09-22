import mongoose from "mongoose";
import TryCatch from "../utils/TryCatch.js";
import { Role } from "../models/Role.js";
import { WorkspaceMember } from "../models/WorkspaceMember.js";
import { ROLE_PERMISSIONS } from "../constants/permissions.js";
import { runInTransaction } from "../utils/runInTransaction.js";

const RESERVED_ROLE_NAMES = ["owner", "admin", "manager", "employee"];

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Human-readable descriptors for the authoritative ROLE_PERMISSIONS
const PERMISSION_METADATA = [
  {
    id: "members.invite",
    label: "Invite Members",
    category: "Workspace Administration",
    description: "Invite registered users to join the workspace and participate in document workflows",
  },
  {
    id: "roles.manage",
    label: "Manage Roles & Permissions",
    category: "Workspace Administration",
    description: "Create, edit, and delete custom roles, and assign or modify member roles",
  },
  {
    id: "departments.manage",
    label: "Manage Departments",
    category: "Organization",
    description: "Create, edit, and delete departments, and assign or remove department members",
  },
  {
    id: "sharing.manage",
    label: "Manage Sharing & Permissions",
    category: "Content & Sharing",
    description: "Manage resource-level permission grants and create or revoke public share links",
  },
  {
    id: "dashboard.view",
    label: "View Dashboard",
    category: "Workspace Overview",
    description: "Access workspace dashboard overview, summary statistics, and metrics",
  },
  {
    id: "audit.view",
    label: "View Audit Logs",
    category: "Security & Monitoring",
    description: "Inspect workspace activity and security audit history",
  },
  {
    id: "storage.view",
    label: "View Storage Metrics",
    category: "Security & Monitoring",
    description: "View workspace storage usage, quotas, and file analytics",
  },
];

/**
 * GET /api/workspaces/:workspaceId/roles/permissions
 * Returns list of available permissions and their UI metadata.
 */
export const listAvailablePermissions = TryCatch(async (req, res) => {
  // Ensure we only return metadata for permissions that exist in ROLE_PERMISSIONS
  const validMetadata = PERMISSION_METADATA.filter((p) =>
    ROLE_PERMISSIONS.includes(p.id)
  );

  res.json({
    permissions: validMetadata,
    allowedPermissions: ROLE_PERMISSIONS,
  });
});

/**
 * GET /api/workspaces/:workspaceId/roles
 * List all roles for the current workspace with active member count.
 */
export const listRoles = TryCatch(async (req, res) => {
  const roles = await Role.find({ workspaceId: req.workspace._id });

  // Count active WorkspaceMembers for each role scoped to the current workspace
  const memberCounts = await WorkspaceMember.aggregate([
    { $match: { workspaceId: req.workspace._id, status: "active" } },
    { $unwind: "$roleIds" },
    { $group: { _id: "$roleIds", count: { $sum: 1 } } },
  ]);

  const countMap = Object.fromEntries(
    memberCounts.map((mc) => [String(mc._id), mc.count])
  );

  const systemOrder = { Owner: 1, Admin: 2, Manager: 3, Employee: 4 };

  const serializedRoles = roles
    .map((r) => ({
      _id: r._id,
      name: r.name,
      isSystem: Boolean(r.isSystem),
      isOwner: Boolean(r.isOwner),
      permissions: r.permissions || [],
      memberCount: countMap[String(r._id)] || 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => {
      const orderA = systemOrder[a.name] || (a.isSystem ? 5 : 6);
      const orderB = systemOrder[b.name] || (b.isSystem ? 5 : 6);
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

  res.json({ roles: serializedRoles });
});

/**
 * POST /api/workspaces/:workspaceId/roles
 * Create a new custom role in the workspace.
 * Requires "roles.manage" permission.
 */
export const createRole = TryCatch(async (req, res) => {
  const { name, permissions } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ message: "Role name is required" });
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 50) {
    return res.status(400).json({ message: "Role name cannot exceed 50 characters" });
  }

  // Check reserved system names case-insensitively
  if (RESERVED_ROLE_NAMES.includes(trimmedName.toLowerCase())) {
    return res.status(400).json({
      message: `"${trimmedName}" is a reserved system role name and cannot be used for custom roles`,
    });
  }

  // Validate permissions array
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return res.status(400).json({ message: "Permissions must be a non-empty array" });
  }

  const invalidPermissions = permissions.filter((p) => !ROLE_PERMISSIONS.includes(p));
  if (invalidPermissions.length > 0) {
    return res.status(400).json({
      message: `Invalid permissions: ${invalidPermissions.join(", ")}. Allowed permissions: ${ROLE_PERMISSIONS.join(", ")}`,
    });
  }

  // Case-insensitive duplicate check in this workspace
  const existingRole = await Role.findOne({
    workspaceId: req.workspace._id,
    name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
  });

  if (existingRole) {
    return res.status(400).json({
      message: "A role with this name already exists in this workspace",
    });
  }

  // Deduplicate permissions
  const uniquePermissions = [...new Set(permissions)];

  const role = await Role.create({
    workspaceId: req.workspace._id,
    name: trimmedName,
    isSystem: false,
    isOwner: false,
    permissions: uniquePermissions,
  });

  res.status(201).json({
    message: "Custom role created successfully",
    role: {
      _id: role._id,
      name: role.name,
      isSystem: false,
      isOwner: false,
      permissions: role.permissions,
      memberCount: 0,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    },
  });
});

/**
 * PATCH /api/workspaces/:workspaceId/roles/:roleId
 * Update custom role name or permissions.
 * System roles and the Owner role cannot be modified.
 * Requires "roles.manage" permission.
 */
export const updateRole = TryCatch(async (req, res) => {
  const { roleId } = req.params;
  const { name, permissions } = req.body;

  if (!mongoose.Types.ObjectId.isValid(roleId)) {
    return res.status(400).json({ message: "Invalid role id" });
  }

  // Scoped to workspace
  const role = await Role.findOne({
    _id: roleId,
    workspaceId: req.workspace._id,
  });

  if (!role) {
    return res.status(404).json({ message: "Role not found in this workspace" });
  }

  // Owner and system roles cannot be modified
  if (role.isOwner) {
    return res.status(403).json({ message: "Cannot modify the Owner role" });
  }

  if (role.isSystem) {
    return res.status(403).json({
      message: "System roles cannot be modified. Create a custom role instead.",
    });
  }

  // Update name if provided
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Role name cannot be empty" });
    }
    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
      return res.status(400).json({ message: "Role name cannot exceed 50 characters" });
    }

    if (RESERVED_ROLE_NAMES.includes(trimmedName.toLowerCase())) {
      return res.status(400).json({
        message: `"${trimmedName}" is a reserved system role name and cannot be used for custom roles`,
      });
    }

    const existingRole = await Role.findOne({
      workspaceId: req.workspace._id,
      _id: { $ne: role._id },
      name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
    });

    if (existingRole) {
      return res.status(400).json({
        message: "A role with this name already exists in this workspace",
      });
    }

    role.name = trimmedName;
  }

  // Update permissions if provided
  if (permissions !== undefined) {
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({ message: "Permissions must be a non-empty array" });
    }

    const invalidPermissions = permissions.filter((p) => !ROLE_PERMISSIONS.includes(p));
    if (invalidPermissions.length > 0) {
      return res.status(400).json({
        message: `Invalid permissions: ${invalidPermissions.join(", ")}. Allowed permissions: ${ROLE_PERMISSIONS.join(", ")}`,
      });
    }

    role.permissions = [...new Set(permissions)];
  }

  await role.save();

  // Compute current memberCount
  const memberCount = await WorkspaceMember.countDocuments({
    workspaceId: req.workspace._id,
    roleIds: role._id,
    status: "active",
  });

  res.json({
    message: "Role updated successfully",
    role: {
      _id: role._id,
      name: role.name,
      isSystem: false,
      isOwner: false,
      permissions: role.permissions,
      memberCount,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    },
  });
});

/**
 * DELETE /api/workspaces/:workspaceId/roles/:roleId
 * Delete a custom role.
 * Owner and system roles cannot be deleted.
 * Atomic cleanup: unassigns role from members in this workspace;
 * any member left with zero roles is assigned the workspace's default Employee role.
 * Requires "roles.manage" permission.
 */
export const deleteRole = TryCatch(async (req, res) => {
  const { roleId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(roleId)) {
    return res.status(400).json({ message: "Invalid role id" });
  }

  const role = await Role.findOne({
    _id: roleId,
    workspaceId: req.workspace._id,
  });

  if (!role) {
    return res.status(404).json({ message: "Role not found in this workspace" });
  }

  if (role.isOwner) {
    return res.status(403).json({ message: "Cannot delete the Owner role" });
  }

  if (role.isSystem) {
    return res.status(403).json({ message: "System roles cannot be deleted" });
  }

  // Atomic operation: delete role, unassign from members, fallback to Employee if zero roles left
  await runInTransaction(async (session) => {
    // 1. Delete the role
    await Role.deleteOne({ _id: role._id }, session ? { session } : {});

    // 2. Remove role reference from members in the SAME workspace only
    await WorkspaceMember.updateMany(
      { workspaceId: req.workspace._id, roleIds: role._id },
      { $pull: { roleIds: role._id } },
      session ? { session } : {}
    );

    // 3. Find any active members in this workspace left with 0 roles
    const emptyRoleMembers = await WorkspaceMember.find(
      {
        workspaceId: req.workspace._id,
        $or: [{ roleIds: { $size: 0 } }, { roleIds: { $exists: false } }],
      },
      null,
      session ? { session } : {}
    );

    if (emptyRoleMembers.length > 0) {
      // Find the existing Employee system role in THE SAME WORKSPACE
      const employeeRole = await Role.findOne(
        { workspaceId: req.workspace._id, name: "Employee", isSystem: true },
        null,
        session ? { session } : {}
      );

      if (!employeeRole) {
        throw new Error(
          "Default Employee role not found in this workspace for member fallback"
        );
      }

      await WorkspaceMember.updateMany(
        {
          workspaceId: req.workspace._id,
          _id: { $in: emptyRoleMembers.map((m) => m._id) },
        },
        { $addToSet: { roleIds: employeeRole._id } },
        session ? { session } : {}
      );
    }
  });

  res.json({
    message: "Role deleted successfully and affected members updated",
    roleId: role._id,
  });
});
