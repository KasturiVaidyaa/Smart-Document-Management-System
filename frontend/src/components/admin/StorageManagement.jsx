import React, { useState, useEffect, useCallback } from "react";
import {
  HardDrive,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileCode,
  File,
  Building2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Layers,
  PieChart,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../utils/api";
import { useWorkspace } from "../../context/WorkspaceContext";

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const MIME_ICONS = {
  PDF: FileText,
  Images: FileImage,
  "Word/Docs": FileText,
  Spreadsheets: FileSpreadsheet,
  Presentations: Layers,
  "Plain Text/Code": FileCode,
  Other: File,
};

export const StorageManagement = () => {
  const { currentWorkspaceId, current, fetchWorkspaces } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [storageData, setStorageData] = useState(null);

  // Authorization checks based on existing RBAC
  const canViewStorage =
    Boolean(current?.isOwner) ||
    Boolean(current?.permissions?.includes("storage.view"));

  const canRecalculate =
    Boolean(current?.isOwner) ||
    Boolean(current?.permissions?.includes("roles.manage"));

  const loadStorage = useCallback(async () => {
    if (!currentWorkspaceId || !canViewStorage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/storage`);
      setStorageData(data);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load storage statistics");
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, canViewStorage]);

  useEffect(() => {
    loadStorage();
  }, [loadStorage]);

  const handleRecalculate = async () => {
    if (!canRecalculate) return;
    setRecalculating(true);
    try {
      const { data } = await api.post(
        `/api/workspaces/${currentWorkspaceId}/storage/recalculate`
      );
      toast.success(data.message || "Storage recalculated successfully");
      await loadStorage();
      if (fetchWorkspaces) {
        await fetchWorkspaces();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to recalculate storage");
    } finally {
      setRecalculating(false);
    }
  };

  if (!canViewStorage) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-center max-w-xl mx-auto mt-6">
        <Lock className="mx-auto h-8 w-8 text-amber-400" />
        <h3 className="mt-3 text-base font-semibold text-zinc-200">
          Storage Analytics Restricted
        </h3>
        <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
          You do not have the <code className="text-amber-300 font-mono">storage.view</code> permission
          required to inspect workspace storage metrics. Contact your workspace administrator for access.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
        <span className="ml-3 text-sm text-zinc-400">Loading storage metrics...</span>
      </div>
    );
  }

  const storage = storageData?.storage || {};
  const counts = storageData?.counts || {};
  const mimeBreakdown = storageData?.breakdownByMimeType || [];
  const deptBreakdown = storageData?.breakdownByDepartment || [];

  const percentage = storage.percentage || 0;
  const isOverQuota = storage.isOverQuota;

  // Gauge status colors
  const progressColor = isOverQuota
    ? "bg-rose-500"
    : percentage > 85
    ? "bg-amber-500"
    : "bg-emerald-500";

  return (
    <div className="space-y-6">
      {/* Header & Reconcile Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-blue-400" />
            Storage & Quota Management
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time storage consumption, quota tracking, and departmental distribution for{" "}
            <span className="text-zinc-200 font-medium">{current?.workspace?.name}</span>.
          </p>
        </div>

        {canRecalculate && (
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition disabled:opacity-50"
            title="Re-aggregate usage directly from active and trash document files"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${recalculating ? "animate-spin" : ""}`} />
            <span>{recalculating ? "Reconciling..." : "Reconcile Storage"}</span>
          </button>
        )}
      </div>

      {/* Main Quota Gauge Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Workspace Quota Allocation
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-zinc-100 font-mono">
                {formatBytes(storage.usedBytes)}
              </span>
              <span className="text-xs text-zinc-500">
                of {formatBytes(storage.quotaBytes)} ({percentage}%)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOverQuota ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Quota Exceeded
              </span>
            ) : percentage > 85 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                High Utilization
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Normal Capacity
              </span>
            )}
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-3 w-full rounded-full bg-zinc-800/80 overflow-hidden p-0.5 border border-zinc-700/40">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
            <span>0 Bytes</span>
            <span>Available: {formatBytes(storage.availableBytes)}</span>
            <span>{formatBytes(storage.quotaBytes)}</span>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Active Documents</span>
            <FileText className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-100 font-mono">
            {counts.active || 0}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Live accessible documents in workspace</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Trash Bin Documents</span>
            <Trash2 className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-100 font-mono">
            {counts.trash || 0}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Pending permanent deletion (counts toward quota)
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Total Stored Objects</span>
            <Layers className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-100 font-mono">
            {counts.total || 0}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Combined active and trashed items</p>
        </div>
      </div>

      {/* Distribution by File / MIME Type */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-zinc-200">
              Storage Breakdown by Document Format
            </h3>
          </div>
          <span className="text-xs text-zinc-500">Presentation Aggregation</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mimeBreakdown.map((item) => {
            const Icon = MIME_ICONS[item.category] || File;
            return (
              <div
                key={item.category}
                className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                    <Icon className="h-4 w-4 text-zinc-400" />
                    <span>{item.category}</span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {item.count} {item.count === 1 ? "doc" : "docs"}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-zinc-100 font-mono">
                    {formatBytes(item.totalBytes)}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {item.percentage}%
                  </span>
                </div>
                {/* Visual mini bar */}
                <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500/80 rounded-full"
                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Distribution by Department */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-200">
              Department Storage Allocation
            </h3>
          </div>
          <span className="text-xs text-zinc-500">Phase 4 Scoped Attributes</span>
        </div>

        {deptBreakdown.length === 0 ? (
          <p className="text-xs text-zinc-500">No department storage data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="border-b border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Documents</th>
                  <th className="py-2.5 px-3">Storage Consumed</th>
                  <th className="py-2.5 px-3 text-right">Share of Workspace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {deptBreakdown.map((dept) => {
                  const share =
                    storage.usedBytes > 0
                      ? Math.round((dept.totalBytes / storage.usedBytes) * 10000) / 100
                      : 0;

                  return (
                    <tr key={String(dept.departmentId || "unassigned")} className="hover:bg-zinc-800/30">
                      <td className="py-2.5 px-3 font-medium text-zinc-200 flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-zinc-500" />
                        <span>{dept.name}</span>
                        {dept.departmentId === null && (
                          <span className="text-[10px] rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
                            Default
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-zinc-400">{dept.count}</td>
                      <td className="py-2.5 px-3 font-mono font-medium text-zinc-200">
                        {formatBytes(dept.totalBytes)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-zinc-400">
                        {share}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
