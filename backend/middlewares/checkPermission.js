import mongoose from "mongoose";
import { PermissionGrant } from "../models/PermissionGrant.js";
import { Document } from "../models/Document.js";
import { Folder } from "../models/Folder.js";

/**
 * Build the list of resource targets for a document, walking up the folder
 * hierarchy while `inheritAcl` is true on each ancestor folder.
 *
 * Returns an array of { resourceType, resourceId } objects:
 *   - The document itself
 *   - Its parent folder (if any)
 *   - Ancestor folders (walking up via parentId while inheritAcl is true)
 */
async function buildResourceChain(document) {
  const chain = [{ resourceType: "document", resourceId: document._id }];

  if (!document.folderId) return chain;

  let currentFolderId = document.folderId;
  const visited = new Set();

  while (currentFolderId && !visited.has(String(currentFolderId))) {
    visited.add(String(currentFolderId));
    const folder = await Folder.findById(currentFolderId);
    if (!folder) break;

    chain.push({ resourceType: "folder", resourceId: folder._id });

    // Stop walking if this folder does NOT inherit ACL from its parent
    if (!folder.inheritAcl) break;
    currentFolderId = folder.parentId;
  }

  return chain;
}

/**
 * Resolve the set of principalType+principalId pairs that the current user
 * matches against. Uses the workspace membership already set by requireWorkspace.
 */
function resolvePrincipals(req) {
  const principals = [];

  // Direct user principal
  principals.push({ principalType: "user", principalId: req.user._id });

  // Role-based principals
  const roleIds = req.membership?.roleIds || [];
  for (const role of roleIds) {
    const id = role?._id || role;
    if (id) principals.push({ principalType: "role", principalId: id });
  }

  // Department-based principals
  const deptIds = req.membership?.departmentIds || [];
  for (const dept of deptIds) {
    const id = dept?._id || dept;
    if (id) principals.push({ principalType: "department", principalId: id });
  }

  // Workspace-wide principal (principalId is null for workspace-wide grants)
  principals.push({ principalType: "workspace", principalId: null });

  return principals;
}

/**
 * Middleware factory: checks whether the authenticated user has a specific
 * document-level permission (e.g. "view", "edit", "download", "share", "delete").
 *
 * Must be used AFTER `isAuth` and `requireWorkspace`.
 *
 * Workspace owners and users with "sharing.manage" role permission bypass this
 * check entirely, preserving backwards-compatible behavior.
 */
export const checkDocumentPermission = (requiredAction) => async (req, res, next) => {
  try {
    // Workspace owners always have full access
    if (req.authz?.isOwner) return next();

    // Users with sharing.manage role permission also bypass
    if (req.authz?.permissions?.includes("sharing.manage")) return next();

    // Implicitly grant view access to all workspace members
    if (requiredAction === "view") return next();

    const documentId = req.params.documentId;
    if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ message: "Invalid document id" });
    }

    const document = await Document.findOne({
      _id: documentId,
      workspaceId: req.workspace._id,
    });

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Build the resource chain (document → folder → parent folders)
    const resourceChain = await buildResourceChain(document);

    // Resolve the user's principal identifiers
    const principals = resolvePrincipals(req);

    // Build query: find any grant that matches ANY resource in the chain
    // AND matches ANY of the user's principals AND includes the required action
    const now = new Date();

    const orConditions = [];
    for (const resource of resourceChain) {
      for (const principal of principals) {
        const condition = {
          workspaceId: req.workspace._id,
          resourceType: resource.resourceType,
          resourceId: resource.resourceId,
          principalType: principal.principalType,
          actions: requiredAction,
        };

        // For workspace-wide grants, principalId is null
        if (principal.principalId !== null) {
          condition.principalId = principal.principalId;
        } else {
          condition.principalId = null;
        }

        orConditions.push(condition);
      }
    }

    const grant = await PermissionGrant.findOne({
      $and: [
        { $or: orConditions },
        {
          $or: [
            { expiresAt: null },
            { expiresAt: { $gt: now } },
          ],
        },
      ],
    });

    if (!grant) {
      // For personal workspaces, the single member (owner) always has access
      // (this is a fallback — owners should already be caught above)
      if (req.workspace.type === "personal") return next();

      // Check if the user is the document creator — creators have implicit access
      if (String(document.createdBy) === String(req.user._id)) return next();

      return res.status(403).json({
        message: "You do not have permission to perform this action on this document",
        requiredAction,
      });
    }

    // Attach the matching grant info for downstream handlers
    req.documentGrant = grant;
    next();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Utility: Check if a user has a specific permission on a document.
 * Can be called programmatically (not as middleware).
 * Returns true/false.
 */
export async function hasDocumentPermission({ userId, workspaceId, documentId, action, membership, workspace }) {
  // Workspace owner bypass
  if (String(workspace.ownerId) === String(userId)) return true;

  const document = await Document.findOne({ _id: documentId, workspaceId });
  if (!document) return false;

  // Document creator bypass
  if (String(document.createdBy) === String(userId)) return true;

  // Personal workspace bypass
  if (workspace.type === "personal") return true;

  // Implicitly grant view access to all workspace members
  if (action === "view") return true;

  const resourceChain = await buildResourceChain(document);

  const principals = [];
  principals.push({ principalType: "user", principalId: new mongoose.Types.ObjectId(userId) });

  const roleIds = membership?.roleIds || [];
  for (const role of roleIds) {
    const id = role?._id || role;
    if (id) principals.push({ principalType: "role", principalId: id });
  }

  const deptIds = membership?.departmentIds || [];
  for (const dept of deptIds) {
    const id = dept?._id || dept;
    if (id) principals.push({ principalType: "department", principalId: id });
  }

  principals.push({ principalType: "workspace", principalId: null });

  const now = new Date();
  const orConditions = [];
  for (const resource of resourceChain) {
    for (const principal of principals) {
      const condition = {
        workspaceId,
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        principalType: principal.principalType,
        actions: action,
      };
      if (principal.principalId !== null) {
        condition.principalId = principal.principalId;
      } else {
        condition.principalId = null;
      }
      orConditions.push(condition);
    }
  }

  // Guard: if no conditions were built, deny access
  if (orConditions.length === 0) return false;

  const grant = await PermissionGrant.findOne({
    $and: [
      { $or: orConditions },
      {
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: now } },
        ],
      },
    ],
  });

  return !!grant;
}
