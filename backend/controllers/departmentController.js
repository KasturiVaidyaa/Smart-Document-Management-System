import mongoose from "mongoose";
import TryCatch from "../utils/TryCatch.js";
import { Department } from "../models/Department.js";
import { WorkspaceMember } from "../models/WorkspaceMember.js";

/**
 * Helper to escape regex special characters for case-insensitive exact matching
 */
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

/**
 * Helper to verify that potentialParentId is not a descendant of departmentId,
 * preventing circular reference chains in the department hierarchy tree.
 */
async function isDescendant(workspaceId, potentialDescendantId, ancestorId) {
  let currentId = potentialDescendantId;
  const visited = new Set();

  while (currentId && !visited.has(String(currentId))) {
    if (String(currentId) === String(ancestorId)) {
      return true;
    }
    visited.add(String(currentId));
    const dept = await Department.findOne({
      _id: currentId,
      workspaceId,
    }).select("parentId");

    if (!dept || !dept.parentId) break;
    currentId = dept.parentId;
  }

  return false;
}

/**
 * GET /api/workspaces/:workspaceId/departments
 *
 * List all departments in the current workspace with populated manager and parent,
 * including active member count.
 * Accessible to any active member of the workspace.
 */
export const listDepartments = TryCatch(async (req, res) => {
  const departments = await Department.find({
    workspaceId: req.workspace._id,
  })
    .populate("managerId", "name email avatarUrl")
    .populate("parentId", "name")
    .sort({ name: 1 });

  // Compute active member count per department for this workspace
  const memberCounts = await WorkspaceMember.aggregate([
    {
      $match: {
        workspaceId: req.workspace._id,
        status: "active",
      },
    },
    { $unwind: "$departmentIds" },
    {
      $group: {
        _id: "$departmentIds",
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = Object.fromEntries(
    memberCounts.map((mc) => [String(mc._id), mc.count])
  );

  const result = departments.map((d) => ({
    _id: d._id,
    workspaceId: d.workspaceId,
    name: d.name,
    parentId: d.parentId
      ? {
          _id: d.parentId._id,
          name: d.parentId.name,
        }
      : null,
    manager: d.managerId
      ? {
          _id: d.managerId._id,
          name: d.managerId.name,
          email: d.managerId.email,
          avatarUrl: d.managerId.avatarUrl,
        }
      : null,
    memberCount: countMap[String(d._id)] || 0,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));

  res.json({ departments: result });
});

/**
 * POST /api/workspaces/:workspaceId/departments
 *
 * Create a new department.
 * Requires "departments.manage" permission or workspace ownership.
 *
 * Body: { name, parentId?, managerId? }
 */
export const createDepartment = TryCatch(async (req, res) => {
  const { name, parentId, managerId } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ message: "Department name is required" });
  }

  const trimmedName = name.trim();

  // Enforce workspace-scoped case-insensitive name uniqueness
  const existing = await Department.findOne({
    workspaceId: req.workspace._id,
    name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
  });

  if (existing) {
    return res.status(400).json({
      message: "A department with this name already exists in this workspace",
    });
  }

  // Validate parentId if provided
  let validatedParentId = null;
  if (parentId && parentId !== "null" && parentId !== "none") {
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({ message: "Invalid parent department ID" });
    }
    const parentDept = await Department.findOne({
      _id: parentId,
      workspaceId: req.workspace._id,
    });
    if (!parentDept) {
      return res.status(400).json({
        message: "Parent department not found in this workspace",
      });
    }
    validatedParentId = parentDept._id;
  }

  // Validate managerId if provided
  let validatedManagerId = null;
  if (managerId && managerId !== "null" && managerId !== "none") {
    if (!mongoose.Types.ObjectId.isValid(managerId)) {
      return res.status(400).json({ message: "Invalid manager user ID" });
    }
    // Manager must be an ACTIVE WorkspaceMember of this workspace
    const member = await WorkspaceMember.findOne({
      workspaceId: req.workspace._id,
      userId: managerId,
      status: "active",
    });
    if (!member) {
      return res.status(400).json({
        message: "Department manager must be an active workspace member",
      });
    }
    validatedManagerId = managerId;
  }

  const department = await Department.create({
    workspaceId: req.workspace._id,
    name: trimmedName,
    parentId: validatedParentId,
    managerId: validatedManagerId,
  });

  await department.populate([
    { path: "managerId", select: "name email avatarUrl" },
    { path: "parentId", select: "name" },
  ]);

  res.status(201).json({
    message: "Department created successfully",
    department: {
      _id: department._id,
      workspaceId: department.workspaceId,
      name: department.name,
      parentId: department.parentId
        ? { _id: department.parentId._id, name: department.parentId.name }
        : null,
      manager: department.managerId
        ? {
            _id: department.managerId._id,
            name: department.managerId.name,
            email: department.managerId.email,
            avatarUrl: department.managerId.avatarUrl,
          }
        : null,
      memberCount: 0,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    },
  });
});

/**
 * PATCH /api/workspaces/:workspaceId/departments/:departmentId
 *
 * Update department name, parentId, or managerId.
 * Requires "departments.manage" permission or workspace ownership.
 *
 * Body: { name?, parentId?, managerId? }
 */
export const updateDepartment = TryCatch(async (req, res) => {
  const { departmentId } = req.params;
  const { name, parentId, managerId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(departmentId)) {
    return res.status(400).json({ message: "Invalid department ID" });
  }

  // Cross-workspace validation: target department must belong to this workspace
  const department = await Department.findOne({
    _id: departmentId,
    workspaceId: req.workspace._id,
  });

  if (!department) {
    return res.status(404).json({ message: "Department not found in this workspace" });
  }

  // 1. Name update
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Department name cannot be empty" });
    }
    const trimmedName = name.trim();

    // Check duplicate name excluding this department
    const existing = await Department.findOne({
      _id: { $ne: department._id },
      workspaceId: req.workspace._id,
      name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({
        message: "A department with this name already exists in this workspace",
      });
    }
    department.name = trimmedName;
  }

  // 2. Parent department update
  if (parentId !== undefined) {
    if (parentId === null || parentId === "" || parentId === "none") {
      department.parentId = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(parentId)) {
        return res.status(400).json({ message: "Invalid parent department ID" });
      }

      // Hierarchy validation 1: Self-parenting check
      if (String(parentId) === String(department._id)) {
        return res.status(400).json({
          message: "A department cannot be its own parent",
        });
      }

      // Cross-workspace parent validation
      const parentDept = await Department.findOne({
        _id: parentId,
        workspaceId: req.workspace._id,
      });
      if (!parentDept) {
        return res.status(400).json({
          message: "Parent department not found in this workspace",
        });
      }

      // Hierarchy validation 2: Circular descendant reference check
      const causesCycle = await isDescendant(
        req.workspace._id,
        parentDept._id,
        department._id
      );
      if (causesCycle) {
        return res.status(400).json({
          message:
            "Circular hierarchy detected: cannot set a descendant department as parent",
        });
      }

      department.parentId = parentDept._id;
    }
  }

  // 3. Manager update
  if (managerId !== undefined) {
    if (managerId === null || managerId === "" || managerId === "none") {
      department.managerId = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(managerId)) {
        return res.status(400).json({ message: "Invalid manager user ID" });
      }

      // Active workspace member check
      const member = await WorkspaceMember.findOne({
        workspaceId: req.workspace._id,
        userId: managerId,
        status: "active",
      });
      if (!member) {
        return res.status(400).json({
          message: "Department manager must be an active workspace member",
        });
      }

      department.managerId = managerId;
    }
  }

  await department.save();

  await department.populate([
    { path: "managerId", select: "name email avatarUrl" },
    { path: "parentId", select: "name" },
  ]);

  // Fetch updated active member count
  const memberCount = await WorkspaceMember.countDocuments({
    workspaceId: req.workspace._id,
    departmentIds: department._id,
    status: "active",
  });

  res.json({
    message: "Department updated successfully",
    department: {
      _id: department._id,
      workspaceId: department.workspaceId,
      name: department.name,
      parentId: department.parentId
        ? { _id: department.parentId._id, name: department.parentId.name }
        : null,
      manager: department.managerId
        ? {
            _id: department.managerId._id,
            name: department.managerId.name,
            email: department.managerId.email,
            avatarUrl: department.managerId.avatarUrl,
          }
        : null,
      memberCount,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    },
  });
});

/**
 * DELETE /api/workspaces/:workspaceId/departments/:departmentId
 *
 * Delete a department.
 * Requires "departments.manage" permission or workspace ownership.
 *
 * Cleanup behavior:
 *   1. Unassigns the department ID from all WorkspaceMember records in this workspace.
 *   2. Reparents direct children to the deleted department's parent (or null if root).
 *   3. Deletes the Department record.
 */
export const deleteDepartment = TryCatch(async (req, res) => {
  const { departmentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(departmentId)) {
    return res.status(400).json({ message: "Invalid department ID" });
  }

  // Cross-workspace validation
  const department = await Department.findOne({
    _id: departmentId,
    workspaceId: req.workspace._id,
  });

  if (!department) {
    return res.status(404).json({ message: "Department not found in this workspace" });
  }

  // 1. Remove department from all members in this workspace
  await WorkspaceMember.updateMany(
    {
      workspaceId: req.workspace._id,
      departmentIds: department._id,
    },
    {
      $pull: { departmentIds: department._id },
    }
  );

  // 2. Reparent direct children to deleted department's parent (or null)
  await Department.updateMany(
    {
      workspaceId: req.workspace._id,
      parentId: department._id,
    },
    {
      parentId: department.parentId || null,
    }
  );

  // 3. Delete the department document
  await Department.deleteOne({ _id: department._id });

  res.json({
    message: "Department deleted successfully",
    departmentId: department._id,
  });
});

/**
 * POST /api/workspaces/:workspaceId/departments/:departmentId/members
 *
 * Bulk assign members to a department.
 * Requires "departments.manage" permission or workspace ownership.
 *
 * Body: { memberIds: [ObjectId] }
 *
 * Atomic validation rule:
 * ALL memberIds must belong to active WorkspaceMembers in the current workspace.
 * If ANY member is invalid, nonexistent, inactive, or from another workspace,
 * the entire operation is rejected before making any DB changes.
 */
export const assignDepartmentMembers = TryCatch(async (req, res) => {
  const { departmentId } = req.params;
  const { memberIds } = req.body;

  if (!mongoose.Types.ObjectId.isValid(departmentId)) {
    return res.status(400).json({ message: "Invalid department ID" });
  }

  // Verify department exists in this workspace
  const department = await Department.findOne({
    _id: departmentId,
    workspaceId: req.workspace._id,
  });
  if (!department) {
    return res.status(404).json({ message: "Department not found in this workspace" });
  }

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ message: "memberIds array cannot be empty" });
  }

  // Validate format of all memberIds
  for (const mid of memberIds) {
    if (!mongoose.Types.ObjectId.isValid(mid)) {
      return res.status(400).json({ message: `Invalid member ID format: ${mid}` });
    }
  }

  // Atomic validation: count active members in this workspace matching ALL provided IDs
  const activeMembers = await WorkspaceMember.find({
    _id: { $in: memberIds },
    workspaceId: req.workspace._id,
    status: "active",
  });

  if (activeMembers.length !== memberIds.length) {
    return res.status(400).json({
      message:
        "Validation failed: All members must be active members belonging to this workspace. Operation rejected.",
    });
  }

  // Add department to all validated active members
  const updateResult = await WorkspaceMember.updateMany(
    {
      _id: { $in: memberIds },
      workspaceId: req.workspace._id,
    },
    {
      $addToSet: { departmentIds: department._id },
    }
  );

  res.json({
    message: `${updateResult.modifiedCount} members assigned to department`,
    modifiedCount: updateResult.modifiedCount,
    departmentId: department._id,
  });
});

/**
 * DELETE /api/workspaces/:workspaceId/departments/:departmentId/members/:memberId
 *
 * Remove a member from a department.
 * Requires "departments.manage" permission or workspace ownership.
 */
export const removeDepartmentMember = TryCatch(async (req, res) => {
  const { departmentId, memberId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(departmentId)) {
    return res.status(400).json({ message: "Invalid department ID" });
  }
  if (!mongoose.Types.ObjectId.isValid(memberId)) {
    return res.status(400).json({ message: "Invalid member ID" });
  }

  // Verify department exists in this workspace
  const department = await Department.findOne({
    _id: departmentId,
    workspaceId: req.workspace._id,
  });
  if (!department) {
    return res.status(404).json({ message: "Department not found in this workspace" });
  }

  // Verify member exists in this workspace
  const member = await WorkspaceMember.findOne({
    _id: memberId,
    workspaceId: req.workspace._id,
  });
  if (!member) {
    return res.status(404).json({ message: "Member not found in this workspace" });
  }

  // Pull department from member's departmentIds
  await WorkspaceMember.updateOne(
    { _id: member._id, workspaceId: req.workspace._id },
    { $pull: { departmentIds: department._id } }
  );

  res.json({
    message: "Member removed from department",
    departmentId: department._id,
    memberId: member._id,
  });
});
