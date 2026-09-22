import React, { useState, useEffect } from "react";
import {
  Settings,
  Building2,
  Share2,
  Clock,
  Sparkles,
  HardDrive,
  Tag,
  Save,
  CheckCircle2,
  Lock,
  Copy,
  Check,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../utils/api";
import { useWorkspace } from "../../context/WorkspaceContext";

export const WorkspaceSettings = ({ onNavigateTab }) => {
  const { currentWorkspaceId, current, fetchWorkspaces } = useWorkspace();

  const [name, setName] = useState("");
  const [allowExternalSharing, setAllowExternalSharing] = useState(true);
  const [defaultLinkExpiryHours, setDefaultLinkExpiryHours] = useState(72);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Authorization check based on existing RBAC
  const canManageSettings =
    Boolean(current?.isOwner) ||
    Boolean(current?.permissions?.includes("roles.manage"));

  // Sync state from current workspace object
  useEffect(() => {
    if (current?.workspace) {
      setName(current.workspace.name || "");
      const s = current.workspace.settings || {};
      setAllowExternalSharing(
        s.allowExternalSharing !== undefined ? s.allowExternalSharing : true
      );
      setDefaultLinkExpiryHours(
        s.defaultLinkExpiryHours !== undefined ? s.defaultLinkExpiryHours : 72
      );
      setAiEnabled(s.aiEnabled !== undefined ? s.aiEnabled : true);
    }
  }, [current]);

  const handleCopyId = () => {
    if (!currentWorkspaceId) return;
    navigator.clipboard.writeText(currentWorkspaceId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManageSettings) return;

    if (!name.trim()) {
      toast.error("Workspace name cannot be empty");
      return;
    }

    const expiryNum = parseInt(defaultLinkExpiryHours, 10);
    if (isNaN(expiryNum) || expiryNum < 1 || expiryNum > 8760) {
      toast.error("Default link expiry must be between 1 and 8760 hours");
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/api/workspaces/${currentWorkspaceId}`, {
        name: name.trim(),
        settings: {
          allowExternalSharing,
          defaultLinkExpiryHours: expiryNum,
          aiEnabled,
        },
      });

      toast.success("Workspace settings updated successfully");
      await fetchWorkspaces();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to update workspace settings"
      );
    } finally {
      setSaving(false);
    }
  };

  const ws = current?.workspace;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-400" />
          Workspace Settings
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Configure organization identity, document collaboration rules, and security policies.
        </p>
      </div>

      {!canManageSettings && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300">
          <Lock className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            You have view-only access to workspace settings. Only Workspace Owners and administrators can modify settings.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. General Organization Profile */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
            <Building2 className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-zinc-100">
              Organization Profile
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Workspace Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!canManageSettings || saving}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="e.g. Acme Corporation"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                The name displayed in the workspace switcher and navigation bar.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Workspace Type
              </label>
              <div className="flex items-center gap-2 pt-1">
                <span className="rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 text-xs font-medium uppercase tracking-wider">
                  {ws?.type || "organization"}
                </span>
                <span className="text-[11px] text-zinc-500">
                  Multi-member team workspace
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/60">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Workspace ID
              </label>
              <div className="flex items-center gap-2">
                <code className="rounded bg-zinc-950 px-2 py-1 text-[11px] font-mono text-zinc-300 border border-zinc-800 select-all">
                  {currentWorkspaceId}
                </code>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="rounded p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  title="Copy Workspace ID"
                >
                  {copiedId ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Workspace Slug
              </label>
              <p className="text-xs text-zinc-300 pt-1 font-mono">
                {ws?.slug || "—"}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Collaboration & Sharing Policies */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
            <Share2 className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-100">
              Collaboration & Public Sharing Policies
            </h3>
          </div>

          <div className="space-y-4">
            {/* allowExternalSharing toggle */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <label className="text-xs font-medium text-zinc-200 cursor-pointer">
                  Allow External Public Link Sharing
                </label>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  When enabled, workspace members with sharing privileges can create public or password-protected view/download links for documents.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  disabled={!canManageSettings || saving}
                  checked={allowExternalSharing}
                  onChange={(e) => setAllowExternalSharing(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 disabled:opacity-50"></div>
              </label>
            </div>

            {/* defaultLinkExpiryHours */}
            <div className="pt-3 border-t border-zinc-800/60">
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                Default Share Link Expiry Duration (Hours)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="8760"
                  disabled={!canManageSettings || saving}
                  value={defaultLinkExpiryHours}
                  onChange={(e) => setDefaultLinkExpiryHours(e.target.value)}
                  className="w-32 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-60"
                />
                <span className="text-xs text-zinc-400">
                  ≈ {(parseInt(defaultLinkExpiryHours, 10) / 24).toFixed(1)} days
                </span>
                <div className="flex items-center gap-1.5 ml-auto text-[11px]">
                  {[24, 72, 168, 720].map((h) => (
                    <button
                      key={h}
                      type="button"
                      disabled={!canManageSettings || saving}
                      onClick={() => setDefaultLinkExpiryHours(h)}
                      className={`rounded px-2 py-0.5 border transition-colors ${
                        parseInt(defaultLinkExpiryHours, 10) === h
                          ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                          : "border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {h === 24 ? "24h" : h === 72 ? "3d (Default)" : h === 168 ? "7d" : "30d"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                Applied automatically to newly generated document share links when an explicit expiration date is omitted.
              </p>
            </div>
          </div>
        </div>

        {/* 3. AI & Document Intelligence Configuration */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-zinc-100">
              AI Intelligence & Processing Policies
            </h3>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <label className="text-xs font-medium text-zinc-200 cursor-pointer">
                Enable AI Document Intelligence & Vector Embeddings
              </label>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                When enabled, newly uploaded PDF, DOCX, and TXT documents are parsed, indexed with vector embeddings, automatically classified, and made available for RAG interactive chat.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
              <input
                type="checkbox"
                disabled={!canManageSettings || saving}
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600 disabled:opacity-50"></div>
            </label>
          </div>
        </div>

        {/* Save Actions */}
        {canManageSettings && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 shadow-md shadow-blue-900/20 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? "Saving Changes..." : "Save Workspace Settings"}</span>
            </button>
          </div>
        )}
      </form>

      {/* 4. Active Storage & Category Modules (Phase 7 & Phase 8) */}
      <div className="pt-4 border-t border-zinc-800/80 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Integrated Administrative Modules
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Phase 7 Active Card */}
          <div
            onClick={() => onNavigateTab?.("storage")}
            className="group rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 space-y-2.5 hover:border-zinc-700 cursor-pointer transition"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-200 font-medium text-xs group-hover:text-blue-400 transition">
                <HardDrive className="h-4 w-4 text-blue-400" />
                <span>Storage Quota & Analytics</span>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 border border-emerald-500/20 font-semibold">
                Phase 7 Active
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Real-time workspace storage usage metrics, quota consumption tracking, and breakdown by file format and departments.
            </p>
            <div className="flex items-center gap-1 text-[11px] font-medium text-blue-400 group-hover:translate-x-0.5 transition">
              <span>Open Storage Dashboard</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>

          {/* Phase 8 Active Card */}
          <div
            onClick={() => onNavigateTab?.("categories")}
            className="group rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 space-y-2.5 hover:border-zinc-700 cursor-pointer transition"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-200 font-medium text-xs group-hover:text-blue-400 transition">
                <Tag className="h-4 w-4 text-blue-400" />
                <span>AI Document Categories</span>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 border border-emerald-500/20 font-semibold">
                Phase 8 Active
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Custom category taxonomy management for automated AI classification, metadata tagging, and smart document sorting.
            </p>
            <div className="flex items-center gap-1 text-[11px] font-medium text-blue-400 group-hover:translate-x-0.5 transition">
              <span>Manage Category Taxonomy</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
