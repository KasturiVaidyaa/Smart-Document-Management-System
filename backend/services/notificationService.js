import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";

/**
 * Valid notification types matching Notification model enum:
 * "shared", "permission_changed", "new_version", "access_expiring", "link_expiring", "access_requested", "access_expired"
 */
const VALID_NOTIFICATION_TYPES = new Set([
  "shared",
  "permission_changed",
  "new_version",
  "access_expiring",
  "link_expiring",
  "access_requested",
  "access_expired",
]);

/**
 * Safely creates an in-app notification for a user without blocking or breaking caller operations.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId - Target recipient user ID
 * @param {string|mongoose.Types.ObjectId} [params.workspaceId] - Workspace context ID
 * @param {string} params.type - Notification type
 * @param {Object} [params.payload] - Notification data payload
 * @returns {Promise<Object|null>} Created Notification or null
 */
export async function createNotification({
  userId,
  workspaceId,
  type,
  payload = {},
}) {
  try {
    if (!userId || !type) {
      console.warn("createNotification: 'userId' and 'type' are required.");
      return null;
    }

    if (!VALID_NOTIFICATION_TYPES.has(type)) {
      console.warn(`createNotification: '${type}' is not a recognized notification type.`);
      return null;
    }

    // Check if recipient has inApp notifications enabled in their preferences
    const user = await User.findById(userId).select("notificationPrefs").lean();
    if (user && user.notificationPrefs && user.notificationPrefs.inApp === false) {
      return null; // Recipient opted out of in-app notifications
    }

    const notification = await Notification.create({
      userId,
      workspaceId: workspaceId || null,
      type,
      payload,
    });

    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error.message);
    return null;
  }
}

/**
 * Safely creates notifications for multiple recipients (e.g., workspace admins).
 *
 * @param {Object} params
 * @param {Array<string|mongoose.Types.ObjectId>} params.userIds - Array of recipient user IDs
 * @param {string|mongoose.Types.ObjectId} [params.workspaceId] - Workspace context ID
 * @param {string} params.type - Notification type
 * @param {Object} [params.payload] - Notification data payload
 * @returns {Promise<Array<Object>>} Array of created notifications
 */
export async function notifyUsers({
  userIds,
  workspaceId,
  type,
  payload = {},
}) {
  try {
    if (!Array.isArray(userIds) || userIds.length === 0 || !type) {
      return [];
    }

    // Remove duplicates
    const uniqueUserIds = [...new Set(userIds.map((id) => String(id)))];

    const results = await Promise.allSettled(
      uniqueUserIds.map((uid) =>
        createNotification({
          userId: uid,
          workspaceId,
          type,
          payload,
        })
      )
    );

    return results
      .filter((r) => r.status === "fulfilled" && r.value !== null)
      .map((r) => r.value);
  } catch (error) {
    console.error("Failed to notify users in bulk:", error.message);
    return [];
  }
}
