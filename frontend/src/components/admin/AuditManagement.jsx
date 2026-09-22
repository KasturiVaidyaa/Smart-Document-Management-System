import { useState, useEffect, useCallback } from "react";
import {
  History,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  FileText,
  Folder,
  MessageSquare,
  Share2,
  Lock,
  Eye,
  Trash2,
  RotateCcw,
  Upload,
  UserCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Calendar,
  Layers,
  Sparkles,
  ArrowRightLeft,
} from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import api from "../../utils/api";

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "document.upload", label: "Document Upload" },
  { value: "document.view", label: "Document View" },
  { value: "document.version_create", label: "New Version" },
  { value: "document.version_revert", label: "Version Reverted" },
  { value: "document.move", label: "Document Moved" },
  { value: "document.trash", label: "Document Trashed" },
  { value: "document.restore", label: "Document Restored" },
  { value: "document.delete", label: "Document Deleted" },
  { value: "permission.grant", label: "Permission Granted" },
  { value: "permission.update", label: "Permission Updated" },
  { value: "permission.revoke", label: "Permission Revoked" },
  { value: "share_link.create", label: "Share Link Created" },
  { value: "share_link.revoke", label: "Share Link Revoked" },
  { value: "access_request.create", label: "Access Requested" },
  { value: "access_request.resolve", label: "Access Request Resolved" },
  { value: "ai.qa", label: "AI Q&A Chat" },
];

const RESOURCE_OPTIONS = [
  { value: "", label: "All Resource Types" },
  { value: "document", label: "Document" },
  { value: "folder", label: "Folder" },
  { value: "chat_session", label: "Chat Session" },
];

function getActionBadge(action) {
  switch (action) {
    case "document.upload":
      return {
        icon: Upload,
        label: "Uploaded",
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      };
    case "document.view":
      return {
        icon: Eye,
        label: "Viewed",
        color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      };
    case "document.version_create":
      return {
        icon: FileText,
        label: "New Version",
        color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
      };
    case "document.version_revert":
      return {
        icon: RotateCcw,
        label: "Reverted Version",
        color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      };
    case "document.move":
      return {
        icon: ArrowRightLeft,
        label: "Moved",
        color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      };
    case "document.trash":
      return {
        icon: Trash2,
        label: "Trashed",
        color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      };
    case "document.restore":
      return {
        icon: RotateCcw,
        label: "Restored",
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      };
    case "document.delete":
      return {
        icon: Trash2,
        label: "Deleted",
        color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
      };
    case "permission.grant":
      return {
        icon: Shield,
        label: "Permission Granted",
        color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
      };
    case "permission.update":
      return {
        icon: Shield,
        label: "Permission Updated",
        color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
      };
    case "permission.revoke":
      return {
        icon: Lock,
        label: "Permission Revoked",
        color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
      };
    case "share_link.create":
      return {
        icon: Share2,
        label: "Link Created",
        color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
      };
    case "share_link.revoke":
      return {
        icon: Lock,
        label: "Link Revoked",
        color: "text-zinc-400 bg-zinc-800 border-zinc-700",
      };
    case "access_request.create":
      return {
        icon: UserCheck,
        label: "Access Requested",
        color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
      };
    case "access_request.resolve":
      return {
        icon: UserCheck,
        label: "Request Resolved",
        color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      };
    case "ai.qa":
      return {
        icon: Sparkles,
        label: "AI Chat Q&A",
        color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
      };
    default:
      return {
        icon: History,
        label: action || "Event",
        color: "text-zinc-400 bg-zinc-800 border-zinc-700",
      };
  }
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export const AuditManagement = () => {
  const { currentWorkspaceId, current } = useWorkspace();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState(null);

  // Filters state
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Expanded row details
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchAuditLogs = useCallback(
    async (targetPage = 1) => {
      if (!currentWorkspaceId) return;
      setLoading(true);
      setError(null);
      setForbidden(false);

      try {
        const params = {
          page: targetPage,
          limit,
        };
        if (actionFilter) params.action = actionFilter;
        if (resourceFilter) params.resourceType = resourceFilter;
        if (fromDate) params.from = fromDate;
        if (toDate) params.to = toDate;

        const res = await api.get(
          `/api/workspaces/${currentWorkspaceId}/audit`,
          { params }
        );

        setEvents(res.data.events || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
          setPage(res.data.pagination.page);
        }
      } catch (err) {
        console.error("Audit log fetch error:", err);
        if (err.response?.status === 403) {
          setForbidden(true);
        } else {
          setError(err.response?.data?.message || "Failed to load audit logs");
        }
      } finally {
        setLoading(false);
      }
    },
    [currentWorkspaceId, actionFilter, resourceFilter, fromDate, toDate, limit]
  );

  useEffect(() => {
    fetchAuditLogs(1);
  }, [fetchAuditLogs]);

  const handleResetFilters = () => {
    setActionFilter("");
    setResourceFilter("");
    setFromDate("");
    setToDate("");
  };

  if (forbidden) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8 text-center max-w-xl mx-auto mt-6">
        <Shield className="mx-auto h-10 w-10 text-rose-400" />
        <h2 className="mt-4 text-lg font-bold text-zinc-100">
          Access Restricted
        </h2>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          Viewing workspace audit logs requires the{" "}
          <span className="font-semibold text-zinc-200">audit.view</span> role
          permission or Workspace Ownership. Please contact your workspace
          administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 backdrop-blur space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-zinc-200">
              Filter Audit Logs
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline transition-colors px-2 py-1"
            >
              Reset Filters
            </button>
            <button
              onClick={() => fetchAuditLogs(page)}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Action Filter */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Action
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Resource Type Filter */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Resource Type
            </label>
            <select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
            >
              {RESOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* From Date Filter */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* To Date Filter */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-lg">
        {loading && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
            <span className="text-sm font-medium">Loading audit events...</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-rose-400 text-sm px-4">
            <AlertCircle className="mx-auto h-8 w-8 mb-2" />
            <p>{error}</p>
            <button
              onClick={() => fetchAuditLogs(page)}
              className="mt-3 rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-700"
            >
              Retry
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 px-4">
            <div className="rounded-full bg-zinc-800 p-3 w-fit mx-auto mb-3">
              <History className="h-6 w-6 text-zinc-400" />
            </div>
            <p className="font-semibold text-zinc-300">No Audit Events Found</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              {actionFilter || resourceFilter || fromDate || toDate
                ? "Try adjusting your filter criteria to view more records."
                : "Activity such as uploads, views, shares, and permission updates will appear here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="border-b border-zinc-800 bg-zinc-900/90 text-zinc-400 text-[11px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {events.map((event) => {
                  const badge = getActionBadge(event.action);
                  const Icon = badge.icon;
                  const isExpanded = expandedRows.has(event._id);
                  const actorName =
                    event.actorId?.name ||
                    event.actorEmail ||
                    event.actorId?.email ||
                    "System";

                  return (
                    <tr
                      key={event._id}
                      className="hover:bg-zinc-800/30 transition-colors group"
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-400 font-mono text-[11px]">
                        {formatDate(event.createdAt)}
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-[11px] font-bold text-blue-400">
                            {actorName[0]?.toUpperCase() || "U"}
                          </div>
                          <div className="truncate max-w-[160px]">
                            <p className="font-medium text-zinc-200 truncate">
                              {actorName}
                            </p>
                            {event.actorEmail && event.actorId?.name && (
                              <p className="text-[10px] text-zinc-500 truncate">
                                {event.actorEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Action Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${badge.color}`}
                        >
                          <Icon className="h-3 w-3" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Resource */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {event.resourceType === "document" ? (
                            <FileText className="h-3.5 w-3.5 text-zinc-400" />
                          ) : event.resourceType === "folder" ? (
                            <Folder className="h-3.5 w-3.5 text-amber-400" />
                          ) : event.resourceType === "chat_session" ? (
                            <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Layers className="h-3.5 w-3.5 text-zinc-500" />
                          )}
                          <span className="font-medium text-zinc-200">
                            {event.metadata?.name ||
                              event.metadata?.documentName ||
                              event.resourceType ||
                              "—"}
                          </span>
                        </div>
                      </td>

                      {/* Details Expander Button */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => toggleRow(event._id)}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-800/80 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                        >
                          <span>{isExpanded ? "Hide" : "Inspect"}</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Expanded Metadata Sub-rows (Rendered below table or modal) */}
        {events.some((e) => expandedRows.has(e._id)) && (
          <div className="border-t border-zinc-800 bg-zinc-950/70 p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Selected Event Details
            </h4>
            {events
              .filter((e) => expandedRows.has(e._id))
              .map((event) => (
                <div
                  key={event._id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs space-y-2 font-mono"
                >
                  <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800 pb-1.5 font-sans">
                    <span className="font-semibold text-zinc-200">
                      {event.action} (ID: {event._id})
                    </span>
                    <button
                      onClick={() => toggleRow(event._id)}
                      className="text-zinc-500 hover:text-zinc-300 text-xs"
                    >
                      Close
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-zinc-300 font-sans">
                    <div>
                      <span className="text-zinc-500">Resource ID:</span>{" "}
                      <span className="font-mono text-[11px]">
                        {event.resourceId || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Actor Email:</span>{" "}
                      <span>{event.actorEmail || "N/A"}</span>
                    </div>
                  </div>
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="mt-2">
                      <span className="text-zinc-500 block mb-1 font-sans">
                        Event Metadata:
                      </span>
                      <pre className="rounded bg-zinc-950 p-2 text-[11px] text-emerald-400 overflow-x-auto border border-zinc-800">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3 bg-zinc-900/80 text-xs text-zinc-400">
            <div>
              Showing page{" "}
              <span className="font-medium text-zinc-200">
                {pagination.page}
              </span>{" "}
              of{" "}
              <span className="font-medium text-zinc-200">
                {pagination.totalPages}
              </span>{" "}
              ({pagination.total} total events)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAuditLogs(page - 1)}
                disabled={page <= 1 || loading}
                className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => fetchAuditLogs(page + 1)}
                disabled={page >= pagination.totalPages || loading}
                className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditManagement;
