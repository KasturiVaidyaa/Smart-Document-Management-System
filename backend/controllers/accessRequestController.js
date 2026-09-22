import mongoose from "mongoose";
import TryCatch from "../utils/TryCatch.js";
import { AccessRequest } from "../models/AccessRequest.js";
import { PermissionGrant } from "../models/PermissionGrant.js";
import { Document } from "../models/Document.js";
import { DOCUMENT_ACTIONS } from "../constants/permissions.js";
import { logAuditEvent } from "../services/auditService.js";
import { createNotification, notifyUsers } from "../services/notificationService.js";

/**
 * POST /api/workspaces/:workspaceId/documents/:documentId/access-requests
 *
 * Create an access request for a document.
 * Requires workspace membership. Prevents duplicate pending requests.
 *
 * Body: { message? }
 */
export const createAccessRequest = TryCatch(async (req, res) => {
  const { documentId } = req.params;
  const { message } = req.body;

  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    return res.status(400).json({ message: "Invalid document id" });
  }

  const document = await Document.findOne({
    _id: documentId,
    workspaceId: req.workspace._id,
    status: "active",
  });

  if (!document) {
    return res.status(404).json({ message: "Document not found" });
  }

  // Check for existing pending request
  const existing = await AccessRequest.findOne({
    workspaceId: req.workspace._id,
    documentId: document._id,
    requesterId: req.user._id,
    status: "pending",
  });

  if (existing) {
    return res.status(409).json({
      message: "You already have a pending access request for this document",
      request: existing,
    });
  }

  const request = await AccessRequest.create({
    workspaceId: req.workspace._id,
    documentId: document._id,
    requesterId: req.user._id,
    status: "pending",
    message: message?.trim() || undefined,
  });

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "access_request.create",
    resourceType: "document",
    resourceId: document._id,
    metadata: {
      requestId: request._id,
      documentName: document.name,
      message: request.message,
    },
  });

  const notifyUserIds = [
    document.createdBy?.toString(),
    req.workspace.ownerId?.toString(),
  ].filter((id) => id && id !== req.user._id?.toString());

  const uniqueNotifyIds = [...new Set(notifyUserIds)];
  if (uniqueNotifyIds.length > 0) {
    notifyUsers({
      userIds: uniqueNotifyIds,
      workspaceId: req.workspace._id,
      type: "access_requested",
      payload: {
        documentId: document._id,
        documentName: document.name,
        requestId: request._id,
        requesterId: req.user._id,
        requesterName: req.user.name || req.user.email,
        message: request.message,
      },
    });
  }

  res.status(201).json({
    message: "Access request submitted",
    request,
  });
});

/**
 * GET /api/workspaces/:workspaceId/access-requests
 *
 * List access requests for the workspace.
 * Requires workspace ownership or "sharing.manage" role permission.
 *
 * Query: { status? } — defaults to "pending"
 */
export const listAccessRequests = TryCatch(async (req, res) => {
  const statusFilter = req.query.status || "pending";
  const validStatuses = ["pending", "approved", "denied"];

  const filter = {
    workspaceId: req.workspace._id,
  };

  if (validStatuses.includes(statusFilter)) {
    filter.status = statusFilter;
  }

  const requests = await AccessRequest.find(filter)
    .populate("requesterId", "name email avatarUrl")
    .populate("documentId", "name mimeType extension")
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ requests });
});

/**
 * PATCH /api/workspaces/:workspaceId/access-requests/:requestId
 *
 * Approve or deny an access request.
 * Requires workspace ownership or "sharing.manage" role permission.
 *
 * Body: { status: "approved"|"denied", actions?: [...] }
 *
 * When approving, automatically creates a PermissionGrant for the requester.
 */
export const resolveAccessRequest = TryCatch(async (req, res) => {
  const { requestId } = req.params;
  const { status, actions } = req.body;

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return res.status(400).json({ message: "Invalid request id" });
  }

  if (!["approved", "denied"].includes(status)) {
    return res.status(400).json({ message: "status must be 'approved' or 'denied'" });
  }

  const request = await AccessRequest.findOne({
    _id: requestId,
    workspaceId: req.workspace._id,
  });

  if (!request) {
    return res.status(404).json({ message: "Access request not found" });
  }

  if (request.status !== "pending") {
    return res.status(400).json({
      message: `This request has already been ${request.status}`,
    });
  }

  request.status = status;
  await request.save();

  let grant = null;

  if (status === "approved") {
    // Determine which actions to grant
    const grantActions = Array.isArray(actions) && actions.length > 0
      ? actions.filter((a) => DOCUMENT_ACTIONS.includes(a))
      : ["view"]; // Default to view-only access

    // Check for existing grant
    const existingGrant = await PermissionGrant.findOne({
      workspaceId: req.workspace._id,
      resourceType: "document",
      resourceId: request.documentId,
      principalType: "user",
      principalId: request.requesterId,
    });

    if (existingGrant) {
      // Merge actions
      const merged = [...new Set([...existingGrant.actions, ...grantActions])];
      existingGrant.actions = merged;
      existingGrant.grantedBy = req.user._id;
      await existingGrant.save();
      grant = existingGrant;
    } else {
      grant = await PermissionGrant.create({
        workspaceId: req.workspace._id,
        resourceType: "document",
        resourceId: request.documentId,
        principalType: "user",
        principalId: request.requesterId,
        actions: grantActions,
        grantedBy: req.user._id,
      });
    }
  }

  logAuditEvent({
    workspaceId: req.workspace._id,
    actor: req.user,
    action: "access_request.resolve",
    resourceType: "document",
    resourceId: request.documentId,
    metadata: {
      requestId: request._id,
      requesterId: request.requesterId,
      status,
      actions: grant?.actions || [],
    },
  });

  if (String(request.requesterId) !== String(req.user._id)) {
    createNotification({
      userId: request.requesterId,
      workspaceId: req.workspace._id,
      type: status === "approved" ? "shared" : "permission_changed",
      payload: {
        documentId: request.documentId,
        status,
        actions: grant?.actions || [],
        resolvedBy: req.user.name || req.user.email || "Workspace admin",
      },
    });
  }

  res.json({
    message: status === "approved" ? "Access request approved" : "Access request denied",
    request,
    grant,
  });
});
