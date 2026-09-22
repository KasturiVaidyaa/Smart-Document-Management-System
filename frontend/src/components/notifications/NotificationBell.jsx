import { useState, useEffect, useRef } from "react";
import {
  Bell,
  CheckCheck,
  Share2,
  Shield,
  FileText,
  UserCheck,
  Clock,
  AlertCircle,
  Loader2,
  BellOff,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getNotificationDetails(notification) {
  const { type, payload = {} } = notification;

  switch (type) {
    case "shared":
      return {
        icon: Share2,
        iconColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        title: "Document Shared",
        description: `${payload.grantedBy || "Someone"} shared ${payload.resourceType || "a document"}${
          payload.documentName ? ` "${payload.documentName}"` : ""
        } with you${
          payload.actions?.length ? ` (${payload.actions.join(", ")})` : ""
        }.`,
        link: "/app/documents",
      };
    case "permission_changed":
      return {
        icon: Shield,
        iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        title: "Permission Updated",
        description: `${payload.grantedBy || payload.resolvedBy || payload.revokedBy || "Admin"} updated your permissions on ${
          payload.resourceType || "document"
        }${payload.documentName ? ` "${payload.documentName}"` : ""}${
          payload.status ? ` (${payload.status})` : ""
        }${payload.actions?.length ? ` - ${payload.actions.join(", ")}` : ""}.`,
        link: "/app/documents",
      };
    case "new_version":
      return {
        icon: FileText,
        iconColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        title: "New Version Available",
        description: `${payload.uploadedBy || "Someone"} uploaded version ${
          payload.versionNumber || ""
        } for "${payload.documentName || "document"}".`,
        link: "/app/documents",
      };
    case "access_requested":
      return {
        icon: UserCheck,
        iconColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
        title: "Access Requested",
        description: `${payload.requesterName || "A user"} requested access to "${
          payload.documentName || "document"
        }"${payload.message ? `: "${payload.message}"` : "."}`,
        link: "/app/access-requests",
      };
    case "access_expiring":
    case "link_expiring":
      return {
        icon: Clock,
        iconColor: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
        title: "Access Expiring Soon",
        description: `Access to ${payload.documentName || "a resource"} will expire soon.`,
        link: "/app/documents",
      };
    case "access_expired":
      return {
        icon: AlertCircle,
        iconColor: "text-rose-400 bg-rose-500/10 border-rose-500/20",
        title: "Access Expired",
        description: `Your access to ${payload.documentName || "a resource"} has expired.`,
        link: "/app/documents",
      };
    default:
      return {
        icon: Bell,
        iconColor: "text-zinc-400 bg-zinc-800 border-zinc-700",
        title: "Notification",
        description: "You have a new notification.",
        link: "/app/documents",
      };
  }
}

export const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState(null);

  const containerRef = useRef(null);
  const navigate = useNavigate();

  // Fetch initial notifications count on mount
  const fetchNotifications = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/notifications?limit=25");
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      setError("Unable to load notifications");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(true);
  }, []);

  // Fetch when opening the dropdown
  useEffect(() => {
    if (isOpen) {
      fetchNotifications(false);
    }
  }, [isOpen]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (notification, e) => {
    if (e) e.stopPropagation();

    // If already read, just navigate
    if (notification.readAt) {
      const details = getNotificationDetails(notification);
      if (details.link) {
        setIsOpen(false);
        navigate(details.link);
      }
      return;
    }

    try {
      await api.patch(`/api/notifications/${notification._id}/read`);
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notification._id ? { ...n, readAt: new Date() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      const details = getNotificationDetails(notification);
      if (details.link) {
        setIsOpen(false);
        navigate(details.link);
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await api.post("/api/notifications/read-all");
      const now = new Date();
      setNotifications((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: now }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className={`relative flex items-center justify-center rounded-lg p-2 transition-colors ${
          isOpen
            ? "bg-zinc-800 text-blue-400"
            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        }`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-zinc-900 animate-in zoom-in-50">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-zinc-700 bg-zinc-900 p-0 shadow-2xl z-50 animate-in fade-in-50 slide-in-from-top-2">
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-100 text-sm">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markingAll}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors font-medium"
              >
                {markingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )}
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Panel Body */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-zinc-800/60">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-zinc-500 text-sm gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                <span>Loading notifications...</span>
              </div>
            ) : error ? (
              <div className="py-8 text-center text-sm text-rose-400 px-4">
                <p>{error}</p>
                <button
                  onClick={() => fetchNotifications(false)}
                  className="mt-2 text-xs text-zinc-400 hover:text-zinc-200 underline"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-zinc-500 text-sm px-4 text-center">
                <div className="rounded-full bg-zinc-800/80 p-3 mb-2">
                  <BellOff className="h-6 w-6 text-zinc-500" />
                </div>
                <p className="font-medium text-zinc-300">No notifications yet</p>
                <p className="text-xs text-zinc-500 mt-1 max-w-[220px]">
                  When documents are shared or updated, you'll receive updates here.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const details = getNotificationDetails(item);
                const Icon = details.icon;
                const isUnread = !item.readAt;

                return (
                  <div
                    key={item._id}
                    onClick={(e) => handleMarkAsRead(item, e)}
                    className={`group relative flex items-start gap-3 p-3.5 text-left transition-colors cursor-pointer ${
                      isUnread
                        ? "bg-zinc-800/40 hover:bg-zinc-800/70"
                        : "hover:bg-zinc-800/30 opacity-80 hover:opacity-100"
                    }`}
                  >
                    {/* Unread indicator dot */}
                    {isUnread && (
                      <span className="absolute left-1.5 top-5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}

                    {/* Notification Icon */}
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${details.iconColor}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className={`text-xs truncate ${
                            isUnread
                              ? "font-semibold text-zinc-100"
                              : "font-medium text-zinc-300"
                          }`}
                        >
                          {details.title}
                        </span>
                        <span className="text-[10px] text-zinc-500 shrink-0">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                        {details.description}
                      </p>
                    </div>

                    {/* Action arrow */}
                    <div className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
