import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  X,
  Upload,
  Eye,
  FileText,
  RotateCcw,
  Trash2,
  Shield,
  Share2,
  Lock,
  UserCheck,
  Sparkles,
  ArrowRightLeft,
  Clock,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import api from "../../utils/api";

function getTimelineDetails(event) {
  const { action, metadata = {} } = event;

  switch (action) {
    case "document.upload":
      return {
        icon: Upload,
        iconColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
        title: "Document Uploaded",
        summary: `Initial upload (${metadata.name || "document"})`,
      };
    case "document.view":
      return {
        icon: Eye,
        iconColor: "text-blue-400 bg-blue-500/10 border-blue-500/30",
        title: "Document Accessed",
        summary: `Document file viewed or downloaded (${metadata.disposition || "inline"})`,
      };
    case "document.version_create":
      return {
        icon: FileText,
        iconColor: "text-teal-400 bg-teal-500/10 border-teal-500/30",
        title: `Version ${metadata.versionNumber || ""} Created`,
        summary: metadata.changeNote || "New version uploaded",
      };
    case "document.version_revert":
      return {
        icon: RotateCcw,
        iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/30",
        title: `Reverted to Version ${metadata.revertedToVersion || ""}`,
        summary: `Created new active version ${metadata.newVersionNumber || ""}`,
      };
    case "document.move":
      return {
        icon: ArrowRightLeft,
        iconColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
        title: "Document Moved",
        summary: metadata.targetFolderId
          ? "Moved to a new folder"
          : "Moved to root folder",
      };
    case "document.trash":
      return {
        icon: Trash2,
        iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/30",
        title: "Moved to Trash",
        summary: "Document marked as trash",
      };
    case "document.restore":
      return {
        icon: RotateCcw,
        iconColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
        title: "Document Restored",
        summary: "Restored back to active status",
      };
    case "document.delete":
      return {
        icon: Trash2,
        iconColor: "text-rose-400 bg-rose-500/10 border-rose-500/30",
        title: "Permanently Deleted",
        summary: `Deleted from system and S3 storage (${metadata.freedBytes || 0} bytes freed)`,
      };
    case "permission.grant":
    case "permission.update":
      return {
        icon: Shield,
        iconColor: "text-purple-400 bg-purple-500/10 border-purple-500/30",
        title: action === "permission.grant" ? "Permission Granted" : "Permission Updated",
        summary: `Granted ${metadata.principalType || "user"} permissions: ${(metadata.actions || []).join(", ")}`,
      };
    case "permission.revoke":
      return {
        icon: Lock,
        iconColor: "text-rose-400 bg-rose-500/10 border-rose-500/30",
        title: "Permission Revoked",
        summary: `Revoked access for ${metadata.principalType || "principal"}`,
      };
    case "share_link.create":
      return {
        icon: Share2,
        iconColor: "text-sky-400 bg-sky-500/10 border-sky-500/30",
        title: "Share Link Created",
        summary: `Public link created (${(metadata.actions || []).join(", ")})`,
      };
    case "share_link.revoke":
      return {
        icon: Lock,
        iconColor: "text-zinc-400 bg-zinc-800 border-zinc-700",
        title: "Share Link Revoked",
        summary: "Share link disabled",
      };
    case "access_request.create":
      return {
        icon: UserCheck,
        iconColor: "text-purple-400 bg-purple-500/10 border-purple-500/30",
        title: "Access Requested",
        summary: metadata.message ? `"${metadata.message}"` : "Access requested by a user",
      };
    case "access_request.resolve":
      return {
        icon: UserCheck,
        iconColor: "text-blue-400 bg-blue-500/10 border-blue-500/30",
        title: `Access Request ${metadata.status || "Resolved"}`,
        summary: metadata.status === "approved" ? "Request approved" : "Request denied",
      };
    default:
      return {
        icon: Activity,
        iconColor: "text-zinc-400 bg-zinc-800 border-zinc-700",
        title: action || "Event",
        summary: "Document activity recorded",
      };
  }
}

function formatDate(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const DocumentTimelineModal = ({
  isOpen,
  onClose,
  document,
  workspaceId,
}) => {
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDocumentAudit = useCallback(async () => {
    if (!document || !workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      // Query workspace audit logs filtered by resourceType: "document" with a comprehensive limit
      const res = await api.get(
        `/api/workspaces/${workspaceId}/audit?resourceType=document&limit=100`
      );
      const allEvents = res.data.events || [];

      // Filter events belonging to this specific document ID
      const matched = allEvents.filter(
        (ev) =>
          String(ev.resourceId) === String(document._id) ||
          String(ev.metadata?.documentId) === String(document._id)
      );

      setTimelineEvents(matched);
    } catch (err) {
      console.error("Failed to load document timeline:", err);
      setError(
        err.response?.data?.message || "Failed to load document activity timeline"
      );
    } finally {
      setLoading(false);
    }
  }, [document, workspaceId]);

  useEffect(() => {
    if (isOpen && document) {
      fetchDocumentAudit();
    }
  }, [isOpen, document, fetchDocumentAudit]);

  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in-50">
      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5 truncate">
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2 text-blue-400 shrink-0">
              <Activity className="h-5 w-5" />
            </div>
            <div className="truncate">
              <h3 className="text-base font-semibold text-zinc-100 truncate">
                Activity Timeline
              </h3>
              <p className="text-xs text-zinc-400 truncate">
                {document.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchDocumentAudit}
              disabled={loading}
              title="Refresh timeline"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Timeline Body */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
              <span className="text-xs">Loading activity timeline...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-400 text-sm px-4">
              <AlertCircle className="mx-auto h-6 w-6 mb-2" />
              <p>{error}</p>
            </div>
          ) : timelineEvents.length === 0 ? (
            <div className="py-14 text-center text-zinc-500 px-4">
              <div className="rounded-full bg-zinc-800 p-3 w-fit mx-auto mb-2">
                <Clock className="h-6 w-6 text-zinc-400" />
              </div>
              <p className="font-medium text-zinc-300 text-sm">
                No Activity Records Found
              </p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                Actions such as views, edits, permissions, and versions will be tracked here.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
              {timelineEvents.map((ev) => {
                const details = getTimelineDetails(ev);
                const Icon = details.icon;
                const actorName =
                  ev.actorId?.name || ev.actorEmail || "User";

                return (
                  <div key={ev._id} className="relative group">
                    {/* Node Dot */}
                    <div
                      className={`absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border shadow-sm ring-4 ring-zinc-900 ${details.iconColor}`}
                    >
                      <Icon className="h-2.5 w-2.5" />
                    </div>

                    {/* Timeline Item Content */}
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5 space-y-1.5 transition-colors hover:border-zinc-700">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-zinc-200">
                          {details.title}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                          {formatDate(ev.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        {details.summary}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 pt-0.5">
                        <span className="font-medium text-zinc-400">Actor:</span>
                        <span>{actorName}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentTimelineModal;
