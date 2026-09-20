import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  ShieldCheck,
  ShieldX,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  UserCircle,
} from "lucide-react";
import api from "../../utils/api";
import { useWorkspace } from "../../context/WorkspaceContext";

const ACTIONS = ["view", "edit", "download", "share", "delete"];

const AccessRequestsPanel = () => {
  const { currentWorkspaceId, current } = useWorkspace();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionsByRequest, setActionsByRequest] = useState({});

  useEffect(() => {
    if (currentWorkspaceId) {
      loadRequests();
    }
  }, [currentWorkspaceId, statusFilter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/access-requests`,
        { params: { status: statusFilter } }
      );
      setRequests(data.requests || []);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to load access requests"
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleAction = (requestId, action) => {
    setActionsByRequest((prev) => {
      const current = prev[requestId] || ["view"];
      const updated = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      return { ...prev, [requestId]: updated.length > 0 ? updated : ["view"] };
    });
  };

  const handleResolve = async (requestId, status) => {
    try {
      const actions = actionsByRequest[requestId] || ["view"];
      const { data } = await api.patch(
        `/api/workspaces/${currentWorkspaceId}/access-requests/${requestId}`,
        { status, actions: status === "approved" ? actions : undefined }
      );
      toast.success(data.message);
      await loadRequests();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to process request");
    }
  };

  const statusBadge = (status) => {
    const styles = {
      pending:
        "bg-amber-600/15 text-amber-300 border-amber-500/20",
      approved:
        "bg-emerald-600/15 text-emerald-300 border-emerald-500/20",
      denied:
        "bg-rose-600/15 text-rose-300 border-rose-500/20",
    };
    const icons = {
      pending: <Clock className="h-3 w-3" />,
      approved: <CheckCircle2 className="h-3 w-3" />,
      denied: <XCircle className="h-3 w-3" />,
    };

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles[status]}`}
      >
        {icons[status]}
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-blue-400" />
          Access Requests
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {current?.workspace?.name || "Workspace"} — review and manage document
          access requests
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["pending", "approved", "denied"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors capitalize ${
              statusFilter === s
                ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Requests list */}
      {loading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-sm text-zinc-400">
          Loading requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
          <ShieldX className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
          <p className="text-sm font-medium text-zinc-300">
            No {statusFilter} access requests
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {statusFilter === "pending"
              ? "When workspace members request access to documents, they'll appear here."
              : `No requests with status "${statusFilter}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const actionsForReq = actionsByRequest[req._id] || ["view"];

            return (
              <div
                key={req._id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* User + document info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="rounded-full bg-zinc-800 p-2 shrink-0">
                      <UserCircle className="h-5 w-5 text-zinc-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100">
                        {req.requesterId?.name || "Unknown user"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {req.requesterId?.email}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <FileText className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <span className="text-xs text-zinc-300 truncate">
                          {req.documentId?.name || "Unknown document"}
                        </span>
                        {statusBadge(req.status)}
                      </div>
                      {req.message && (
                        <p className="mt-2 text-xs text-zinc-400 italic bg-zinc-950/40 rounded-md px-3 py-1.5 border border-zinc-800/50">
                          "{req.message}"
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-zinc-600">
                        {new Date(req.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  {req.status === "pending" && (
                    <div className="flex flex-col gap-2 shrink-0">
                      {/* Action selector */}
                      <div className="flex flex-wrap gap-1">
                        {ACTIONS.map((action) => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => toggleAction(req._id, action)}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors ${
                              actionsForReq.includes(action)
                                ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                                : "bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            {action}
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolve(req._id, "approved")}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleResolve(req._id, "denied")}
                          className="flex items-center gap-1 rounded-lg border border-rose-600/40 bg-rose-600/20 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-600/30 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Deny
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AccessRequestsPanel;
