import { AuditEvent } from "../models/AuditEvent.js";

/**
 * Safely logs an audit event without blocking or breaking calling business logic.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} [params.workspaceId] - Workspace ID where event occurred
 * @param {Object} [params.actor] - User object (req.user) containing _id and email
 * @param {string|mongoose.Types.ObjectId} [params.actorId] - Explicit actor user ID
 * @param {string} [params.actorEmail] - Explicit actor email
 * @param {string} params.action - Action name (e.g., 'document.upload', 'permission.grant')
 * @param {string} [params.resourceType] - Type of resource ('document', 'folder', 'workspace', etc.)
 * @param {string|mongoose.Types.ObjectId} [params.resourceId] - ID of the resource
 * @param {Object} [params.metadata] - Extra context/details about the event
 * @returns {Promise<Object|null>} Created AuditEvent or null if logging failed
 */
export async function logAuditEvent({
  workspaceId,
  actor,
  actorId,
  actorEmail,
  action,
  resourceType,
  resourceId,
  metadata = {},
}) {
  try {
    if (!action) {
      console.warn("logAuditEvent: 'action' is required but was not provided.");
      return null;
    }

    const resolvedActorId = actorId || actor?._id || actor?.id || null;
    const resolvedActorEmail = actorEmail || actor?.email || undefined;

    const event = await AuditEvent.create({
      workspaceId: workspaceId || null,
      actorId: resolvedActorId,
      actorEmail: resolvedActorEmail,
      action,
      resourceType: resourceType || undefined,
      resourceId: resourceId || undefined,
      metadata,
    });

    return event;
  } catch (error) {
    console.error("Failed to log audit event:", error.message);
    return null;
  }
}
