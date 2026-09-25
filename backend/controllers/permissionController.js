import mongoose from "mongoose";
import TryCatch from "../utils/TryCatch.js";
import { PermissionGrant } from "../models/PermissionGrant.js";
import { Document } from "../models/Document.js";
import { Folder } from "../models/Folder.js";
import { DOCUMENT_ACTIONS } from "../constants/permissions.js";
import { logAuditEvent } from "../services/auditService.js";
import { createNotification } from "../services/notificationService.js";

/**
 * POST /api/workspaces/:workspaceId/permissions
 *
 * Create a new permission grant on a document or folder.
 * Requires workspace ownership or "sharing.manage" role permission.
 *
 * Body: { resourceType, resourceId, principalType, principalId, actions, expiresAt? }
 */
export const createPermission = TryCatch(async (req, res) => {
  const { resourceType, resourceId, principalType, principalId, actions, expiresAt } = req.body;

  // Validate resourceType
  if (!["folder", "document"].includes(resourceType)) {
    return res.status(400).json({ message: "resourceType must be 'folder' or 'document'" });
  }

  // Validate resourceId
  if (!resourceId || !mongoose.Types.ObjectId.isValid(resourceId)) {
    return res.status(400).json({ message: "Valid resourceId is required" });
  }

  // Validate principalType
  if (!["user", "role", "department", "workspace"].includes(principalType)) {
    return res.status(400).json({ message: "principalType must be 'user', 'role', 'department', or 'workspace'" });
  }

  // Personal workspaces only support user-to-user sharing
  if (req.workspace.type === "personal" && principalType !== "user") {
    return res.status(400).json({ message: "Personal workspaces only support user-level permissions" });
  }

  // principalId is required for all types except "workspace"
  if (principalType !== "workspace") {
    if (!principalId || !mongoose.Types.ObjectId.isValid(principalId)) {
      return res.status(400).json({ message: "Valid principalId is required for this principalType" });
    }
  }

  // Validate actions
  if (!Array.isArray(actions) || actions.length === 0) {
    return res.status(400).json({ message: "actions must be a non-empty array" });
  }
  const invalidActions = actions.filter((a) => !DOCUMENT_ACTIONS.includes(a));
  if (invalidActions.length > 0) {
    return res.status(400).json({
      message: `Invalid actions: ${invalidActions.join(", ")}. Valid actions: ${DOCUMENT_ACTIONS.join(", ")}`,
    });
  }

  // Verify the resource exists in this workspace
  if (resourceType === "document") {
    const doc = await Document.findOne({ _id: resourceId, workspaceId: req.workspace._id });
    if (!doc) {
      return res.status(404).json({ message: "Document not found in this workspace" });
    }
  } else {
    const folder = await Folder.findOne({ _id: resourceId, workspaceId: req.workspace._id });
    if (!folder) {
      return res.status(404).json({ message: "Folder not found in this workspace" });
    }
  }

  // Check for existing identical grant (prevent duplicates)
  const existing = await PermissionGrant.findOne({
    workspaceId: req.workspace._id,
    resourceType,
    resourceId,
    principalType,
    principalId: principalType === "workspace" ? null : principalId,
  });

  if (existing) {
    // Update existing grant instead of creating duplicate
    existing.actions = [...new Set(actions)];
    if (expiresAt !== undefined) {
      existing.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }
    existing.grantedBy = req.user._id;
    await existing.save();

    logAuditEvent({
      workspaceId: req.workspace._id,
      actor: req.user,
      action: "permission.update",
      resourceType,
      resourceId,
      metadata: {
        principalType,
        principalId: principalType === "workspace" ? null : principalId,
        actions: existing.actions,
        expiresAt: existing.expiresAt,
      },
    });

    if (principalType === "user" && principalId && String(principalId) !== String(req.user._id)) {
      createNotification({
        userId: principalId,
        workspaceId: req.workspace._id,
        type: "permission_changed",
        payload: {
          resourceType,
          resourceId,
          actions: existing.actions,
          grantedBy: req.user.name || req.user.email || "Workspace admin",
        },
      });
    }

    return res.json({
      message: "Permission grant updated",
      grant: existing,
    });
  }

  const grant = await PermissionGrant.create({
    workspaceId: req.workspace._id,
    resourceType,
    resourceId,
    principalType,
    principalId: principalType === "workspace" ? null : principalId,
    actions: [...new Set(actions)],
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    grantedBy: req.user._id,
  });

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "permission.grant",
    resourceType,
    resourceId,
    metadata: {
      principalType,
      principalId: principalType === "workspace" ? null : principalId,
      actions: grant.actions,
      expiresAt: grant.expiresAt,
    },
  });

  if (principalType === "user" && principalId && String(principalId) !== String(req.user._id)) {
    createNotification({
      userId: principalId,
      workspaceId: req.workspace._id,
      type: "shared",
      payload: {
        resourceType,
        resourceId,
        actions: grant.actions,
        grantedBy: req.user.name || req.user.email || "Workspace admin",
      },
    });
  }

  res.status(201).json({
    message: "Permission granted",
    grant,
  });
});

/**
 * GET /api/workspaces/:workspaceId/documents/:documentId/permissions
 *
 * List all permission grants for a document, including inherited grants
 * from parent folders.
 */
export const listDocumentPermissions = TryCatch(async (req, res) => {
  const { documentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    return res.status(400).json({ message: "Invalid document id" });
  }

  const document = await Document.findOne({
    _id: documentId,
    workspaceId: req.workspace._id,
  });

  if (!document) {
    return res.status(404).json({ message: "Document not found" });
  }

  // Direct grants on the document
  const directGrants = await PermissionGrant.find({
    workspaceId: req.workspace._id,
    resourceType: "document",
    resourceId: document._id,
  }).populate("grantedBy", "name email");

  // Inherited grants from folder chain
  const inheritedGrants = [];
  if (document.folderId) {
    let currentFolderId = document.folderId;
    const visited = new Set();

    while (currentFolderId && !visited.has(String(currentFolderId))) {
      visited.add(String(currentFolderId));
      const folder = await Folder.findById(currentFolderId);
      if (!folder) break;

      const folderGrants = await PermissionGrant.find({
        workspaceId: req.workspace._id,
        resourceType: "folder",
        resourceId: folder._id,
      }).populate("grantedBy", "name email");

      for (const g of folderGrants) {
        inheritedGrants.push({
          ...g.toObject(),
          _inheritedFrom: { folderId: folder._id, folderName: folder.name, folderPath: folder.path },
        });
      }

      if (!folder.inheritAcl) break;
      currentFolderId = folder.parentId;
    }
  }

  res.json({
    directGrants,
    inheritedGrants,
    documentId: document._id,
  });
});

/**
 * DELETE /api/workspaces/:workspaceId/permissions/:grantId
 *
 * Revoke (delete) a specific permission grant.
 * Requires workspace ownership or "sharing.manage" role permission.
 */
export const deletePermission = TryCatch(async (req, res) => {
  const { grantId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(grantId)) {
    return res.status(400).json({ message: "Invalid grant id" });
  }

  const grant = await PermissionGrant.findOne({
    _id: grantId,
    workspaceId: req.workspace._id,
  });

  if (!grant) {
    return res.status(404).json({ message: "Permission grant not found" });
  }

  await PermissionGrant.deleteOne({ _id: grant._id });

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "permission.revoke",
    resourceType: grant.resourceType,
    resourceId: grant.resourceId,
    metadata: {
      principalType: grant.principalType,
      principalId: grant.principalId,
      actions: grant.actions,
    },
  });

  if (grant.principalType === "user" && grant.principalId && String(grant.principalId) !== String(req.user._id)) {
    createNotification({
      userId: grant.principalId,
      workspaceId: req.workspace._id,
      type: "permission_changed",
      payload: {
        resourceType: grant.resourceType,
        resourceId: grant.resourceId,
        actions: [],
        revokedBy: req.user.name || req.user.email || "Workspace admin",
      },
    });
  }

  res.json({
    message: "Permission revoked",
    grantId: grant._id,
  });
});
