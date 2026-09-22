import mongoose from "mongoose";
import TryCatch from "../utils/TryCatch.js";
import { AuditEvent } from "../models/AuditEvent.js";

/**
 * GET /api/workspaces/:workspaceId/audit
 *
 * List audit events scoped strictly to the requested workspace.
 * Requires workspace membership and "audit.view" permission (or workspace ownership).
 *
 * Query filters:
 * - action: string (e.g. "document.upload", "permission.grant", "ai.qa")
 * - actorId: string (User ObjectId)
 * - resourceType: string (e.g. "document", "folder", "chat_session")
 * - from: ISO date string (filter events on or after this timestamp)
 * - to: ISO date string (filter events on or before this timestamp)
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 */
export const listAuditLogs = TryCatch(async (req, res) => {
  const workspaceId = req.workspace._id;
  const { action, actorId, resourceType, from, to } = req.query;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  // Strict workspace isolation: workspaceId is ALWAYS enforced
  const filter = { workspaceId };

  // Optional filter: action
  if (action && typeof action === "string" && action.trim()) {
    filter.action = action.trim();
  }

  // Optional filter: actorId
  if (actorId) {
    if (!mongoose.Types.ObjectId.isValid(actorId)) {
      return res.status(400).json({ message: "Invalid actorId format" });
    }
    filter.actorId = actorId;
  }

  // Optional filter: resourceType
  if (resourceType && typeof resourceType === "string" && resourceType.trim()) {
    filter.resourceType = resourceType.trim();
  }

  // Optional filter: Date range (from / to)
  if (from || to) {
    filter.createdAt = {};
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        filter.createdAt.$gte = fromDate;
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        if (typeof to === "string" && to.length === 10) {
          toDate.setUTCHours(23, 59, 59, 999);
        }
        filter.createdAt.$lte = toDate;
      }
    }
    if (Object.keys(filter.createdAt).length === 0) {
      delete filter.createdAt;
    }
  }

  // Query events and total count in parallel
  const [events, total] = await Promise.all([
    AuditEvent.find(filter)
      .populate("actorId", "name email avatarUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditEvent.countDocuments(filter),
  ]);

  res.json({
    events,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
