import mongoose from "mongoose";
import TryCatch from "../utils/TryCatch.js";
import { Notification } from "../models/Notification.js";

/**
 * GET /api/notifications
 *
 * List notifications belonging strictly to the authenticated user.
 * Supports pagination and optional filtering for unread notifications.
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - unread: boolean ("true" to filter unread only)
 */
export const listNotifications = TryCatch(async (req, res) => {
  const userId = req.user._id;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const unreadOnly = req.query.unread === "true" || req.query.unreadOnly === "true";

  const filter = { userId };
  if (unreadOnly) {
    filter.readAt = null;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate("workspaceId", "name type")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, readAt: null }),
  ]);

  res.json({
    notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * PATCH /api/notifications/:id/read
 *
 * Mark a single notification as read.
 * Strictly verifies ownership by scoping update to { _id: id, userId: req.user._id }.
 */
export const markNotificationAsRead = TryCatch(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid notification ID" });
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: id, userId },
    { readAt: new Date() },
    { new: true }
  ).populate("workspaceId", "name type");

  if (!notification) {
    return res.status(404).json({ message: "Notification not found" });
  }

  res.json({
    message: "Notification marked as read",
    notification,
  });
});

/**
 * POST /api/notifications/read-all
 *
 * Mark all unread notifications belonging strictly to the authenticated user as read.
 */
export const markAllNotificationsAsRead = TryCatch(async (req, res) => {
  const userId = req.user._id;

  const result = await Notification.updateMany(
    { userId, readAt: null },
    { $set: { readAt: new Date() } }
  );

  res.json({
    message: "All notifications marked as read",
    modifiedCount: result.modifiedCount,
  });
});
