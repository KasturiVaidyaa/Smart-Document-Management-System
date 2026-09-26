import {
  useEffect, useState, useMemo, useRef, useCallback,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FileText, FileSpreadsheet, FileImage, File,
  History, Trash2, RotateCcw, CornerDownRight,
  ChevronRight, MessageSquare, Upload, AlertTriangle,
  FolderOpen, Home, CheckSquare, Square, Search, X,
  Eye, Download, Shield, ShieldCheck, Link2, Building2, Activity,
  Brain, RefreshCw, ChevronDown, ChevronUp, Tag,
  Filter, CalendarDays, Sparkles, MoreVertical, Plus,
  FolderPlus,
} from "lucide-react";
import api from "../utils/api";
import { useWorkspace } from "../context/WorkspaceContext";
import { FolderTree } from "../components/documents/FolderTree";
import {
  CreateFolderModal, RenameFolderModal, DeleteFolderModal, MoveDocumentModal,
} from "../components/documents/FolderModals";
import { VersionHistoryModal } from "../components/documents/VersionHistoryModal";
import { BulkActionBar } from "../components/documents/BulkActionBar";
import { PermissionsModal } from "../components/documents/PermissionsModal";
import { ShareLinkModal } from "../components/documents/ShareLinkModal";
import { DocumentTimelineModal } from "../components/documents/DocumentTimelineModal";
import AccessRequestModal from "../components/documents/AccessRequestModal";
import { DocumentSkeleton } from "../components/documents/DocumentSkeleton";

/* ─── Helpers ─────────────────────────────────────────────────── */
const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mimeType = "", name = "") => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (mimeType.startsWith("image/")) return <FileImage className="h-4 w-4 text-purple-400 shrink-0" />;
  if (mimeType === "application/pdf" || ext === "pdf") return <FileText className="h-4 w-4 text-rose-400 shrink-0" />;
  if (mimeType.includes("sheet") || mimeType.includes("csv") || ["csv","xlsx","xls"].includes(ext))
    return <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />;
  return <File className="h-4 w-4 text-blue-400 shrink-0" />;
};

const formatRelative = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const days = Math.floor(hr / 24);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/* ─── Processing status badge ─────────────────────────────────── */
const ProcessingStatusBadge = ({ processing, jobStatus }) => {
  let status = "none";
  if (jobStatus === "running" || jobStatus === "queued") status = "running";
  else if (jobStatus === "failed" || processing?.embed === "failed" || processing?.extract === "failed") status = "failed";
  else if (jobStatus === "ready" || processing?.embed === "ready") status = "ready";
  else if (processing?.embed === "pending" || processing?.extract === "pending") status = "pending";
  if (status === "none") return null;

  const labels = { pending: "Pending", running: "Processing…", ready: "AI Ready", failed: "AI Failed" };
  const cls = { pending: "status-pending", running: "status-running", ready: "status-ready", failed: "status-failed" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls[status]}`}>
      {status === "running" && <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />}
      {labels[status]}
    </span>
  );
};

/* ─── Highlighted snippet ─────────────────────────────────────── */
const HighlightedSnippet = ({ text = "" }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <mark key={i} className="search-highlight">{part.slice(2, -2)}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
};

/* ─── AI Inline Panel ─────────────────────────────────────────── */
const AiPanel = ({ doc, workspaceId, onReprocessed }) => {
  const [autoTagging, setAutoTagging] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const { data } = await api.post(`/api/workspaces/${workspaceId}/documents/${doc._id}/reprocess`);
      toast.success("Reprocessing started — AI will update summary, category, and keywords shortly.");
      if (onReprocessed) onReprocessed(data.document);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Reprocess failed");
    } finally {
      setReprocessing(false);
    }
  };

  const handleAutoTag = async () => {
    setAutoTagging(true);
    try {
      const { data } = await api.post(`/api/workspaces/${workspaceId}/documents/${doc._id}/suggest-tags?apply=true`);
      if (data.suggestions?.length > 0) {
        toast.success(`Added ${data.suggestions.length} tags successfully.`);
        if (onReprocessed) {
          // Just trigger a re-fetch of the document list basically
          onReprocessed(doc);
        }
      } else {
        toast.info("No new tags suggested.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Auto-tagging failed");
    } finally {
      setAutoTagging(false);
    }
  };

  const hasAiData = doc.summary || doc.aiCategory || (doc.aiKeywords?.length > 0);
  return (
    <div className="mx-4 mb-3 rounded-lg border border-zinc-700/50 bg-zinc-950/50 px-3 py-2.5 text-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <span className="text-zinc-400 font-medium">AI Intelligence</span>
          <ProcessingStatusBadge processing={doc.processing} jobStatus={doc.jobStatus} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoTag}
            disabled={autoTagging}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-emerald-300 disabled:opacity-50 transition-colors"
          >
            <Tag className={`h-3 w-3 ${autoTagging ? "animate-pulse" : ""}`} />
            {autoTagging ? "Tagging…" : "Auto-Tag"}
          </button>
          <button
            type="button"
            onClick={handleReprocess}
            disabled={reprocessing}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-blue-300 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${reprocessing ? "animate-spin" : ""}`} />
            {reprocessing ? "Starting…" : "Re-process"}
          </button>
        </div>
      </div>

      {hasAiData ? (
        <>
          {doc.aiCategory && (
            <div className="flex items-start gap-2">
              <Tag className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-zinc-500 mr-1">AI Category:</span>
                <span className="inline-flex items-center rounded-full bg-indigo-900/40 border border-indigo-700/50 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                  {doc.aiCategory}
                </span>
              </div>
            </div>
          )}
          {doc.aiKeywords?.length > 0 && (
            <div className="flex items-start gap-2">
              <Brain className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-zinc-500 mr-1.5">Keywords:</span>
                <span className="flex flex-wrap gap-1 mt-0.5">
                  {doc.aiKeywords.slice(0, 8).map((kw, i) => (
                    <span key={i} className="rounded-md bg-emerald-900/30 border border-emerald-700/40 px-1.5 py-0.5 text-[10px] text-emerald-300">{kw}</span>
                  ))}
                  {doc.aiKeywords.length > 8 && <span className="text-zinc-500">+{doc.aiKeywords.length - 8} more</span>}
                </span>
              </div>
            </div>
          )}
          {doc.summary && (
            <div className="flex items-start gap-2">
              <FileText className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-zinc-500 mr-1">Summary:</span>
                <span className="text-zinc-300 leading-relaxed">{doc.summary}</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-zinc-500 pl-5">
          {doc.processing?.embed === "pending" || doc.processing?.extract === "pending"
            ? "AI processing is queued. Results will appear here once complete."
            : "No AI data yet. Click Re-process to analyze this document."}
        </p>
      )}
    </div>
  );
};

/* ─── Context Menu ────────────────────────────────────────────── */
const DocContextMenu = ({ x, y, doc, activeTab, onClose, onOpen, onDownload, onVersion, onShare, onActivity, onPermissions, onDepartment, onMove, onTrash, onRestore, onPermDelete, onRequestAccess, workspaceId }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const escHandler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", escHandler); };
  }, [onClose]);

  // Clamp to viewport
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const clampedX = Math.min(x, window.innerWidth - rect.width - 8);
      const clampedY = Math.min(y, window.innerHeight - rect.height - 8);
      setPos({ x: clampedX, y: clampedY });
    }
  }, [x, y]);

  return (
    <div
      ref={(el) => { ref.current = el; menuRef.current = el; }}
      className="ctx-menu"
      style={{ left: pos.x, top: pos.y }}
    >
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 select-none truncate max-w-[180px]">
        {doc.name}
      </p>
      <div className="ctx-separator" />

      {activeTab === "files" ? (
        <>
          <button className="ctx-item" onClick={() => { onOpen(doc); onClose(); }}>
            <Eye className="h-4 w-4 text-blue-400" /> Open / Preview
          </button>
          <button className="ctx-item" onClick={() => { onDownload(doc); onClose(); }}>
            <Download className="h-4 w-4 text-zinc-400" /> Download
          </button>
          <Link
            to={`/app/chat?documentId=${doc._id}`}
            className="ctx-item"
            onClick={onClose}
          >
            <MessageSquare className="h-4 w-4 text-emerald-400" /> Chat with AI
          </Link>
          <div className="ctx-separator" />
          <button className="ctx-item" onClick={() => { onVersion(doc); onClose(); }}>
            <History className="h-4 w-4 text-zinc-400" /> Version History
          </button>
          <button className="ctx-item" onClick={() => { onActivity(doc); onClose(); }}>
            <Activity className="h-4 w-4 text-blue-400" /> Activity Timeline
          </button>
          <div className="ctx-separator" />
          <button className="ctx-item" onClick={() => { onRequestAccess(doc); onClose(); }}>
            <ShieldCheck className="h-4 w-4 text-blue-400" /> Request Access
          </button>
          <button className="ctx-item" onClick={() => { onShare(doc); onClose(); }}>
            <Link2 className="h-4 w-4 text-emerald-400" /> Share Link
          </button>
          <button className="ctx-item" onClick={() => { onPermissions(doc); onClose(); }}>
            <Shield className="h-4 w-4 text-amber-400" /> Permissions
          </button>
          <button className="ctx-item" onClick={() => { onDepartment(doc); onClose(); }}>
            <Building2 className="h-4 w-4 text-indigo-400" /> Assign Department
          </button>
          <button className="ctx-item" onClick={() => { onMove([doc]); onClose(); }}>
            <CornerDownRight className="h-4 w-4 text-blue-400" /> Move to Folder
          </button>
          <div className="ctx-separator" />
          <button className="ctx-item danger" onClick={() => { onTrash(doc); onClose(); }}>
            <Trash2 className="h-4 w-4" /> Move to Trash
          </button>
        </>
      ) : (
        <>
          <button className="ctx-item" onClick={() => { onRestore(doc); onClose(); }}>
            <RotateCcw className="h-4 w-4 text-emerald-400" /> Restore
          </button>
          <div className="ctx-separator" />
          <button className="ctx-item danger" onClick={() => { onPermDelete([doc]); onClose(); }}>
            <Trash2 className="h-4 w-4" /> Delete Permanently
          </button>
        </>
      )}
    </div>
  );
};

/* ─── Change Department Modal ─────────────────────────────────── */
const ChangeDepartmentModal = ({ isOpen, onClose, document: doc, departments = [], workspaceId, onUpdated }) => {
  const [selectedDept, setSelectedDept] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (doc) setSelectedDept(doc.departmentId || ""); }, [doc, isOpen]);

  if (!isOpen || !doc) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/workspaces/${workspaceId}/documents/${doc._id}/department`, { departmentId: selectedDept || null });
      toast.success("Department updated");
      onClose();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update department");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-100 font-semibold">
            <Building2 className="h-5 w-5 text-indigo-400" />
            <h3>Assign Department</h3>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white rounded-lg p-1 hover:bg-zinc-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <p className="text-xs text-zinc-400 mb-2">
              Select department for <span className="text-white font-medium">{doc.name}</span>:
            </p>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">None (Unassigned)</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Permanent Delete Confirm ────────────────────────────────── */
const PermDeleteDialog = ({ docs, onCancel, onConfirm }) => {
  if (!docs) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-800 text-rose-400 font-semibold">
          <div className="rounded-full bg-rose-500/10 p-2"><AlertTriangle className="h-5 w-5 text-rose-500" /></div>
          <h3>Permanent Deletion</h3>
        </div>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-zinc-300">
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold text-white">
              {docs.length === 1 ? `"${docs[0].name}"` : `${docs.length} documents`}
            </span>?
          </p>
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            <p className="font-semibold mb-1">This action cannot be undone.</p>
            All versions, metadata, and files stored on AWS S3 will be permanently removed.
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800">Cancel</button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500">
            Permanently Delete
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Component ──────────────────────────────────────────── */
const Documents = () => {
  const { currentWorkspaceId, current, fetchWorkspaces } = useWorkspace();
  const [searchParams] = useSearchParams();
  const uploadRef = useRef(null);

  // Core data
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Navigation & filtering
  const [activeTab, setActiveTab] = useState("files");
  const [selectedFolderId, setSelectedFolderId] = useState("all");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("all");

  // Search
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterAiCategory, setFilterAiCategory] = useState("all");
  const [filterExtension, setFilterExtension] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterTags, setFilterTags] = useState("");

  // Drag-drop
  const [isDragOver, setIsDragOver] = useState(false);
  const dropZoneRef = useRef(null);

  // Selection
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());

  // AI panel
  const [expandedAiDocId, setExpandedAiDocId] = useState(null);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, doc }
  const [accessRequestDoc, setAccessRequestDoc] = useState(null);

  // Modals
  const [createFolderParentId, setCreateFolderParentId] = useState(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [docsToMove, setDocsToMove] = useState([]);
  const [versionDoc, setVersionDoc] = useState(null);
  const [departmentDoc, setDepartmentDoc] = useState(null);
  const [permissionsDoc, setPermissionsDoc] = useState(null);
  const [shareLinkDoc, setShareLinkDoc] = useState(null);
  const [activityDoc, setActivityDoc] = useState(null);
  const [permDeleteConfirmDocs, setPermDeleteConfirmDocs] = useState(null);

  // Highlight from URL
  const highlightId = searchParams.get("highlight");

  /* ── Data loading ─────────────────────────────────────────── */
  const loadCategories = async () => {
    if (!currentWorkspaceId) return;
    try {
      const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/categories`);
      setCategories((data.categories || []).map(c => (typeof c === "string" ? c : c.name)));
    } catch { /* silent */ }
  };

  const loadDepartments = async () => {
    if (!currentWorkspaceId) return;
    try {
      const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/departments`);
      setDepartments(data.departments || []);
    } catch { /* silent */ }
  };

  const loadFolders = async () => {
    if (!currentWorkspaceId) return;
    try {
      const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/folders`);
      setFolders(data.folders || []);
    } catch { /* silent */ }
  };

  const loadDocuments = async (silent = false) => {
    if (!currentWorkspaceId) return;
    if (!silent) setLoading(true);
    if (!silent) setIsSearchMode(false);
    try {
      const params = {};
      if (activeTab === "trash") {
        params.status = "trash";
      } else {
        params.status = "active";
        if (selectedFolderId !== "all") params.folderId = selectedFolderId ?? "root";
      }
      if (selectedDepartmentId !== "all") params.departmentId = selectedDepartmentId;
      if (filterAiCategory !== "all" && filterAiCategory) params.aiCategory = filterAiCategory;

      const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/documents`, { params });
      setDocuments(data.documents || []);
    } catch (error) {
      if (!silent) toast.error(error?.response?.data?.message || "Could not load documents");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (currentWorkspaceId) {
      loadFolders();
      loadDepartments();
      loadDocuments();
      loadCategories();
      setSelectedDocIds(new Set());
      setExpandedAiDocId(null);
      setCtxMenu(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspaceId, activeTab, selectedFolderId, selectedDepartmentId, filterAiCategory]);

  // Poll for document status updates if any document is processing
  useEffect(() => {
    const hasPending = documents.some((d) => {
      const proc = d.currentVersionId?.processing;
      return (
        proc?.extract === "pending" || proc?.extract === "running" ||
        proc?.embed === "pending" || proc?.embed === "running" ||
        proc?.classify === "pending" || proc?.classify === "running"
      );
    });

    if (hasPending && !isSearchMode) {
      const interval = setInterval(() => {
        loadDocuments(true);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [documents, currentWorkspaceId, activeTab, selectedFolderId, selectedDepartmentId, filterAiCategory, isSearchMode]);

  // Scroll to highlighted doc
  useEffect(() => {
    if (highlightId && !loading) {
      const el = document.getElementById(`doc-${highlightId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, loading]);

  /* ── Search ───────────────────────────────────────────────── */
  const onSearch = async (e) => {
    e?.preventDefault();
    const hasFilters = filterExtension !== "all" || filterDateFrom || filterDateTo || filterTags.trim();
    if (!query.trim() && !hasFilters) { loadDocuments(); return; }
    if (!currentWorkspaceId) return;

    setSearching(true);
    setIsSearchMode(true);
    try {
      const params = { q: query.trim() };
      if (filterAiCategory && filterAiCategory !== "all") params.aiCategory = filterAiCategory;
      if (filterExtension && filterExtension !== "all") params.extension = filterExtension;
      if (filterDateFrom) params.dateFrom = filterDateFrom;
      if (filterDateTo) params.dateTo = filterDateTo;
      if (filterTags.trim()) params.tags = filterTags.trim();

      const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/search`, { params });
      setDocuments(data.documents || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setFilterAiCategory("all");
    setFilterExtension("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterTags("");
    setShowFilters(false);
    loadDocuments();
  };

  /* ── Drag-drop ────────────────────────────────────────────── */
  const handleDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget)) setIsDragOver(false);
  }, []);

  /* ── Upload ───────────────────────────────────────────────── */
  const uploadFile = async (file) => {
    if (!file || !currentWorkspaceId) return;
    const form = new FormData();
    form.append("file", file);
    if (selectedFolderId && selectedFolderId !== "all") form.append("folderId", selectedFolderId);
    if (selectedDepartmentId && selectedDepartmentId !== "all" && selectedDepartmentId !== "unassigned") {
      form.append("departmentId", selectedDepartmentId);
    }
    setUploading(true);
    try {
      const { data } = await api.post(`/api/workspaces/${currentWorkspaceId}/documents`, form);
      toast.success(data.isNewVersion ? (data.message || "New version uploaded") : "File uploaded successfully.");
      await loadDocuments();
      await fetchWorkspaces();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  const onUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await uploadFile(file);
  };

  /* ── Document actions ─────────────────────────────────────── */
  const openDocument = async (doc) => {
    try {
      const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/file`, { params: { disposition: "inline" } });
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      if (error?.response?.status === 403) {
        toast.error("You need access to view this document.");
        setAccessRequestDoc(doc);
      } else {
        toast.error(error?.response?.data?.message || "Could not open file preview");
      }
    }
  };

  const downloadDocument = async (doc) => {
    try {
      const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/file`, { params: { disposition: "attachment" } });
      if (data.url) {
        const link = window.document.createElement("a");
        link.href = data.url;
        link.setAttribute("download", data.name || doc.name);
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
      }
    } catch (error) {
      if (error?.response?.status === 403) {
        toast.error("You need access to download this document.");
        setAccessRequestDoc(doc);
      } else {
        toast.error(error?.response?.data?.message || "Could not download file");
      }
    }
  };

  const onTrashDoc = async (doc) => {
    try {
      await api.patch(`/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/trash`);
      toast.info(`"${doc.name}" moved to Trash`);
      setSelectedDocIds(prev => { const n = new Set(prev); n.delete(doc._id); return n; });
      await loadDocuments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not delete document");
    }
  };

  const onRestoreDoc = async (doc) => {
    try {
      await api.post(`/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/restore`);
      toast.success(`"${doc.name}" restored`);
      setSelectedDocIds(prev => { const n = new Set(prev); n.delete(doc._id); return n; });
      await loadDocuments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not restore document");
    }
  };

  const onConfirmPermanentDelete = async () => {
    if (!permDeleteConfirmDocs?.length) return;
    try {
      if (permDeleteConfirmDocs.length === 1) {
        await api.delete(`/api/workspaces/${currentWorkspaceId}/documents/${permDeleteConfirmDocs[0]._id}/permanent`);
        toast.success(`"${permDeleteConfirmDocs[0].name}" permanently deleted`);
      } else {
        const documentIds = permDeleteConfirmDocs.map(d => d._id);
        await api.post(`/api/workspaces/${currentWorkspaceId}/documents/bulk-delete`, { documentIds });
        toast.success(`${documentIds.length} documents permanently deleted`);
      }
      setPermDeleteConfirmDocs(null);
      await loadDocuments();
      await fetchWorkspaces();
      setSelectedDocIds(new Set());
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not permanently delete");
    }
  };

  const onConfirmMoveDocs = async (targetFolderId) => {
    try {
      if (docsToMove.length === 1) {
        await api.patch(`/api/workspaces/${currentWorkspaceId}/documents/${docsToMove[0]._id}/move`, { folderId: targetFolderId });
        toast.success(`"${docsToMove[0].name}" moved`);
      } else {
        const documentIds = docsToMove.map(d => d._id);
        await api.post(`/api/workspaces/${currentWorkspaceId}/documents/bulk-move`, { documentIds, folderId: targetFolderId });
        toast.success(`${documentIds.length} documents moved`);
      }
      setDocsToMove([]);
      await loadDocuments();
      setSelectedDocIds(new Set());
    } catch (error) {
      toast.error(error?.response?.data?.message || "Move failed");
    }
  };

  /* ── Folder CRUD ──────────────────────────────────────────── */
  const handleCreateFolder = async ({ name, parentId }) => {
    try {
      await api.post(`/api/workspaces/${currentWorkspaceId}/folders`, { name, parentId });
      toast.success("Folder created");
      await loadFolders();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to create folder");
    }
  };

  const handleRenameFolder = async (folderId, newName) => {
    try {
      await api.patch(`/api/workspaces/${currentWorkspaceId}/folders/${folderId}`, { name: newName });
      toast.success("Folder renamed");
      await loadFolders();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to rename folder");
    }
  };

  const handleDeleteFolder = async (folderId) => {
    try {
      await api.delete(`/api/workspaces/${currentWorkspaceId}/folders/${folderId}`);
      toast.success("Folder deleted");
      // Fix: reset to "all" (show all docs), not null (root only)
      if (selectedFolderId === folderId) setSelectedFolderId("all");
      await loadFolders();
      await loadDocuments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete folder");
    }
  };

  /* ── Bulk operations ──────────────────────────────────────── */
  const handleBulkTrash = async () => {
    const ids = Array.from(selectedDocIds);
    try {
      await api.post(`/api/workspaces/${currentWorkspaceId}/documents/bulk-trash`, { documentIds: ids });
      toast.info(`${ids.length} documents moved to Trash`);
      setSelectedDocIds(new Set());
      await loadDocuments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Bulk delete failed");
    }
  };

  const handleBulkRestore = async () => {
    const ids = Array.from(selectedDocIds);
    try {
      await api.post(`/api/workspaces/${currentWorkspaceId}/documents/bulk-restore`, { documentIds: ids });
      toast.success(`${ids.length} documents restored`);
      setSelectedDocIds(new Set());
      await loadDocuments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Bulk restore failed");
    }
  };

  const handleBulkMove = () => setDocsToMove(documents.filter(d => selectedDocIds.has(d._id)));
  const handleBulkPermanentDelete = () => setPermDeleteConfirmDocs(documents.filter(d => selectedDocIds.has(d._id)));

  /* ── Selection ────────────────────────────────────────────── */
  const toggleSelectDoc = (docId) => setSelectedDocIds(prev => {
    const n = new Set(prev);
    n.has(docId) ? n.delete(docId) : n.add(docId);
    return n;
  });
  const toggleSelectAll = () => {
    if (selectedDocIds.size === documents.length) setSelectedDocIds(new Set());
    else setSelectedDocIds(new Set(documents.map(d => d._id)));
  };

  const handleDocReprocessed = (updatedDoc) => {
    setDocuments(prev => prev.map(d => String(d._id) === String(updatedDoc._id) ? { ...d, ...updatedDoc } : d));
  };

  /* ── Context menu ─────────────────────────────────────────── */
  const openCtxMenu = (e, doc) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, doc });
  };

  // Close ctx menu on any scroll
  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, []);

  /* ── Computed ─────────────────────────────────────────────── */
  const breadcrumbTrail = useMemo(() => {
    if (activeTab === "trash") return [{ id: "trash", name: "Trash" }];
    if (selectedFolderId === "all") return [{ id: "all", name: "All Files" }];
    if (selectedFolderId === null) return [{ id: null, name: "Root" }];

    const map = new Map(folders.map(f => [f._id, f]));
    const trail = [];
    let curr = map.get(selectedFolderId);
    while (curr) {
      trail.unshift({ id: curr._id, name: curr.name });
      curr = curr.parentId ? map.get(curr.parentId) : null;
    }
    trail.unshift({ id: null, name: "Root" });
    return trail;
  }, [activeTab, selectedFolderId, folders]);

  const folderNameMap = useMemo(() => { const m = new Map(); folders.forEach(f => m.set(f._id, f.name)); return m; }, [folders]);
  const departmentNameMap = useMemo(() => { const m = new Map(); departments.forEach(d => m.set(d._id, d.name)); return m; }, [departments]);

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div
      className="flex flex-col h-full"
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-950/60 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-blue-400 bg-blue-900/40 px-14 py-10 text-center shadow-2xl">
            <Upload className="mx-auto h-10 w-10 text-blue-400 mb-3" />
            <p className="text-lg font-semibold text-blue-200">Drop to upload</p>
            <p className="text-sm text-blue-400 mt-1">Max 25 MB per file</p>
          </div>
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <form onSubmit={onSearch} className="flex flex-1 min-w-0 items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search files by name, category, or meaning…"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
          >
            {searching ? "…" : "Search"}
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${showFilters ? "border-blue-600 bg-blue-600/10 text-blue-300" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}
            title="Toggle filters"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>
          {isSearchMode && (
            <button type="button" onClick={clearSearch} className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        {/* Department filter */}
        {departments.length > 0 && (
          <select
            value={selectedDepartmentId}
            onChange={e => setSelectedDepartmentId(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Depts</option>
            <option value="unassigned">Unassigned</option>
            {departments.map(dept => <option key={dept._id} value={dept._id}>{dept.name}</option>)}
          </select>
        )}

        {/* Upload button */}
        {activeTab === "files" && (
          <label className={`flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer shadow-md shadow-blue-900/30 transition hover:bg-blue-500 ${uploading ? "opacity-70 pointer-events-none" : ""}`}>
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload"}
            <input type="file" className="hidden" disabled={uploading || !currentWorkspaceId} onChange={onUpload} ref={uploadRef} />
          </label>
        )}
      </div>

      {/* ── Collapsible Filters ──────────────────────────────── */}
      {showFilters && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3 mb-4">
          <p className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" /> Advanced Filters
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">AI Category</label>
              <select value={filterAiCategory} onChange={e => setFilterAiCategory(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500">
                <option value="all">All Categories</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">File Type</label>
              <select value={filterExtension} onChange={e => setFilterExtension(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500">
                <option value="all">All Types</option>
                {["pdf","docx","pptx","xlsx","txt","md","png","jpg","csv"].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1 flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Date From</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1 flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Date To</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-zinc-500 mb-1 flex items-center gap-1"><Tag className="h-3 w-3" /> Tags (comma-separated)</label>
              <input type="text" value={filterTags} onChange={e => setFilterTags(e.target.value)} placeholder="e.g. contract, finance, Q3" className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="col-span-2 flex items-end gap-2">
              <button type="button" onClick={onSearch} className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors">Apply Filters</button>
              <button type="button" onClick={clearSearch} className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">Clear All</button>
            </div>
          </div>
        </div>
      )}

      {/* Search mode banner */}
      {isSearchMode && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-800/30 bg-blue-900/10 px-3 py-2 text-xs text-blue-300 mb-4">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>{documents.length}</strong> result{documents.length !== 1 ? "s" : ""}
            {query && <> for <strong className="text-white">"{query}"</strong></>}
          </span>
          <button onClick={clearSearch} className="ml-auto hover:text-rose-400 transition-colors"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* AI Category quick filter pills */}
      {!isSearchMode && activeTab === "files" && categories.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <span className="text-[11px] text-zinc-500 flex items-center gap-1 shrink-0">
            <Sparkles className="h-3 w-3" /> Category:
          </span>
          <button
            onClick={() => setFilterAiCategory("all")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium border transition-colors ${filterAiCategory === "all" ? "border-blue-600 bg-blue-600/10 text-blue-300" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
          >All</button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterAiCategory(cat === filterAiCategory ? "all" : cat)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium border transition-colors ${filterAiCategory === cat ? "border-indigo-600 bg-indigo-600/10 text-indigo-300" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
            >{cat}</button>
          ))}
        </div>
      )}

      {/* ── Main split: Folder tree + Doc list ───────────────── */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 items-start min-h-0">
        {/* Folder sidebar */}
        <FolderTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={(id) => { setSelectedFolderId(id); setQuery(""); setIsSearchMode(false); }}
          activeTab={activeTab}
          onSelectTab={(tab) => { setActiveTab(tab); setQuery(""); setIsSearchMode(false); }}
          onOpenCreateModal={(parentId) => { setCreateFolderParentId(parentId); setIsCreateFolderOpen(true); }}
          onOpenRenameModal={(folder) => setFolderToRename(folder)}
          onOpenDeleteModal={(folder) => setFolderToDelete(folder)}
        />

        {/* Document list area */}
        <div className="flex-1 w-full min-w-0">
          {/* Breadcrumb + count bar */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2 mb-3">
            <nav className="flex items-center gap-1.5 text-xs text-zinc-400 overflow-x-auto">
              {breadcrumbTrail.map((crumb, idx) => {
                const isLast = idx === breadcrumbTrail.length - 1;
                return (
                  <div key={crumb.id ?? idx} className="flex items-center gap-1.5 shrink-0">
                    {idx === 0 && <Home className="h-3.5 w-3.5 text-zinc-500" />}
                    <button
                      type="button"
                      disabled={isLast || activeTab === "trash"}
                      onClick={() => setSelectedFolderId(crumb.id)}
                      className={`hover:text-white transition-colors ${isLast ? "font-semibold text-zinc-100" : "text-zinc-400 hover:underline"}`}
                    >
                      {crumb.name}
                    </button>
                    {!isLast && <ChevronRight className="h-3 w-3 text-zinc-600" />}
                  </div>
                );
              })}
            </nav>
            <div className="flex items-center gap-2 text-xs text-zinc-500 shrink-0">
              <span>{documents.length} {documents.length === 1 ? "file" : "files"}</span>
              {/* Chat about this folder */}
              {activeTab === "files" && selectedFolderId && selectedFolderId !== "all" && (
                <Link
                  to={`/app/chat?folderId=${selectedFolderId}`}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-700/50 bg-violet-900/15 px-2.5 py-1 text-violet-300 hover:bg-violet-800/30 transition-colors text-xs font-medium"
                  title="Chat with AI about documents in this folder"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Chat folder
                </Link>
              )}
              {activeTab === "files" && (
                <label
                  className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-zinc-700/80 bg-zinc-800/80 px-2.5 py-1 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors text-xs font-medium"
                  title="Upload file"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New file
                  <input type="file" className="hidden" disabled={uploading || !currentWorkspaceId} onChange={onUpload} />
                </label>
              )}
            </div>
          </div>

          {/* Document rows */}
          {loading ? (
            <DocumentSkeleton count={6} />
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-14 text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-zinc-700 mb-3" />
              <p className="text-sm font-medium text-zinc-300">
                {activeTab === "trash" ? "Trash is empty." : isSearchMode ? "No results found." : "No files here yet."}
              </p>
              <p className="text-xs text-zinc-600 mt-1.5">
                {activeTab === "trash"
                  ? "Deleted documents appear here."
                  : isSearchMode
                  ? "Try different keywords or adjust filters."
                  : "Upload a PDF, image, or office document — or drag and drop files."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
              {/* Table header */}
              <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-950/40 px-4 py-2.5 text-xs font-semibold text-zinc-500">
                <button type="button" onClick={toggleSelectAll} className="text-zinc-500 hover:text-zinc-300 shrink-0">
                  {selectedDocIds.size === documents.length && documents.length > 0
                    ? <CheckSquare className="h-4 w-4 text-blue-400" />
                    : <Square className="h-4 w-4" />}
                </button>
                <span className="flex-1">Name</span>
                <span className="hidden sm:block w-24 text-right">Modified</span>
                <span className="hidden md:block w-16 text-right">Size</span>
                <span className="w-8" />
              </div>

              {/* Rows */}
              <ul className="divide-y divide-zinc-800/60">
                {documents.map((doc) => {
                  const isSelected = selectedDocIds.has(doc._id);
                  const isHighlighted = highlightId && String(doc._id) === String(highlightId);
                  const folderName = doc.folderId ? folderNameMap.get(doc.folderId) : null;
                  const isAiExpanded = expandedAiDocId === doc._id;

                  return (
                    <li
                      key={doc._id}
                      id={`doc-${doc._id}`}
                      className={`group transition-colors ${
                        isHighlighted
                          ? "bg-blue-950/30 border-l-2 border-blue-500"
                          : isSelected
                          ? "bg-blue-950/15"
                          : "hover:bg-zinc-800/30"
                      }`}
                      onContextMenu={e => openCtxMenu(e, doc)}
                    >
                      <div className="flex items-center gap-3 px-4 py-2.5">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleSelectDoc(doc._id)}
                          className="text-zinc-500 hover:text-zinc-300 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                          style={isSelected ? { opacity: 1 } : {}}
                        >
                          {isSelected ? <CheckSquare className="h-4 w-4 text-blue-400" /> : <Square className="h-4 w-4" />}
                        </button>

                        {/* File icon */}
                        <div className="shrink-0">{getFileIcon(doc.mimeType, doc.name)}</div>

                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => openDocument(doc)}
                              className="font-medium text-sm text-zinc-100 hover:text-blue-400 cursor-pointer truncate transition-colors max-w-xs sm:max-w-sm"
                            >
                              {doc.name}
                            </button>

                            {/* Badges row */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {doc.processing && (
                                <ProcessingStatusBadge processing={doc.processing} jobStatus={doc.jobStatus} />
                              )}
                              {doc.aiCategory && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-950/50 px-2 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-800/40">
                                  <Sparkles className="h-2.5 w-2.5" /> {doc.aiCategory}
                                </span>
                              )}
                              {selectedFolderId === "all" && folderName && (
                                <span className="rounded-md bg-zinc-800/60 px-1.5 py-0.5 text-[10px] text-zinc-400 border border-zinc-700/50">📁 {folderName}</span>
                              )}
                              {doc.departmentId && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-indigo-950/30 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-800/40">
                                  <Building2 className="h-2.5 w-2.5" />
                                  {departmentNameMap.get(doc.departmentId) || "Dept"}
                                </span>
                              )}
                              {doc.versionCount > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setVersionDoc(doc)}
                                  className="flex items-center gap-0.5 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700 border border-zinc-700/60 transition-colors"
                                >
                                  <History className="h-2.5 w-2.5 text-blue-400" /> v{doc.versionCount}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Snippet / Summary */}
                          {(doc.snippet || doc.summary) && (
                            <p className="mt-0.5 text-xs text-zinc-500 line-clamp-1">
                              <HighlightedSnippet text={doc.snippet || doc.summary} />
                            </p>
                          )}
                        </div>

                        {/* Modified date */}
                        <span className="hidden sm:block text-xs text-zinc-500 w-24 text-right shrink-0">
                          {formatRelative(doc.updatedAt)}
                        </span>

                        {/* File size */}
                        <span className="hidden md:block text-xs text-zinc-600 w-16 text-right shrink-0">
                          {doc.sizeBytes ? formatBytes(doc.sizeBytes) : "—"}
                        </span>

                        {/* Action buttons — shown on hover */}
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {activeTab === "files" ? (
                            <>
                              <button
                                title="Toggle AI panel"
                                type="button"
                                onClick={() => setExpandedAiDocId(isAiExpanded ? null : doc._id)}
                                className={`rounded-md p-1.5 text-xs transition-colors ${isAiExpanded ? "bg-indigo-600/15 text-indigo-300" : "text-zinc-400 hover:bg-zinc-700 hover:text-indigo-400"}`}
                              >
                                <Brain className="h-3.5 w-3.5" />
                              </button>
                              <button
                                title="Open"
                                type="button"
                                onClick={() => openDocument(doc)}
                                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-blue-400 transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                title="More actions"
                                type="button"
                                onClick={e => openCtxMenu(e, doc)}
                                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                title="Restore"
                                type="button"
                                onClick={() => onRestoreDoc(doc)}
                                className="rounded-md px-2.5 py-1.5 text-xs font-medium border border-emerald-600/30 bg-emerald-600/10 text-emerald-300 hover:bg-emerald-600/20 transition-colors"
                              >
                                Restore
                              </button>
                              <button
                                title="Delete permanently"
                                type="button"
                                onClick={() => setPermDeleteConfirmDocs([doc])}
                                className="rounded-md px-2.5 py-1.5 text-xs font-medium border border-rose-600/30 bg-rose-600/10 text-rose-300 hover:bg-rose-600/20 transition-colors"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* AI panel (expanded) */}
                      {isAiExpanded && activeTab === "files" && (
                        <AiPanel doc={doc} workspaceId={currentWorkspaceId} onReprocessed={handleDocReprocessed} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk action bar ──────────────────────────────────── */}
      <BulkActionBar
        selectedCount={selectedDocIds.size}
        activeTab={activeTab}
        onClearSelection={() => setSelectedDocIds(new Set())}
        onBulkMove={handleBulkMove}
        onBulkTrash={handleBulkTrash}
        onBulkRestore={handleBulkRestore}
        onBulkPermanentDelete={handleBulkPermanentDelete}
      />

      {/* ── Context menu ────────────────────────────────────── */}
      {ctxMenu && (
        <DocContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          doc={ctxMenu.doc}
          activeTab={activeTab}
          onClose={() => setCtxMenu(null)}
          onOpen={openDocument}
          onDownload={downloadDocument}
          onVersion={(doc) => setVersionDoc(doc)}
          onShare={(doc) => setShareLinkDoc(doc)}
          onActivity={(doc) => setActivityDoc(doc)}
          onPermissions={(doc) => setPermissionsDoc(doc)}
          onDepartment={(doc) => setDepartmentDoc(doc)}
          onMove={(docs) => setDocsToMove(docs)}
          onTrash={onTrashDoc}
          onRestore={onRestoreDoc}
          onPermDelete={(docs) => setPermDeleteConfirmDocs(docs)}
          onRequestAccess={(doc) => setAccessRequestDoc(doc)}
          workspaceId={currentWorkspaceId}
        />
      )}

      {/* ── Modals ──────────────────────────────────────────── */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onSubmit={handleCreateFolder}
        folders={folders}
        initialParentId={createFolderParentId}
      />
      <RenameFolderModal
        isOpen={Boolean(folderToRename)}
        onClose={() => setFolderToRename(null)}
        folder={folderToRename}
        onSubmit={handleRenameFolder}
      />
      <DeleteFolderModal
        isOpen={Boolean(folderToDelete)}
        onClose={() => setFolderToDelete(null)}
        folder={folderToDelete}
        onConfirm={handleDeleteFolder}
      />
      <MoveDocumentModal
        isOpen={docsToMove.length > 0}
        onClose={() => setDocsToMove([])}
        documents={docsToMove}
        folders={folders}
        onConfirm={onConfirmMoveDocs}
      />
      <VersionHistoryModal
        isOpen={Boolean(versionDoc)}
        onClose={() => setVersionDoc(null)}
        document={versionDoc}
        workspaceId={currentWorkspaceId}
        onVersionUpdated={loadDocuments}
      />
      <PermissionsModal
        isOpen={Boolean(permissionsDoc)}
        onClose={() => setPermissionsDoc(null)}
        document={permissionsDoc}
        workspaceId={currentWorkspaceId}
      />
      <ShareLinkModal
        isOpen={Boolean(shareLinkDoc)}
        onClose={() => setShareLinkDoc(null)}
        document={shareLinkDoc}
        workspaceId={currentWorkspaceId}
      />
      <DocumentTimelineModal
        isOpen={Boolean(activityDoc)}
        onClose={() => setActivityDoc(null)}
        document={activityDoc}
        workspaceId={currentWorkspaceId}
      />
      <ChangeDepartmentModal
        isOpen={Boolean(departmentDoc)}
        onClose={() => setDepartmentDoc(null)}
        document={departmentDoc}
        departments={departments}
        workspaceId={currentWorkspaceId}
        onUpdated={loadDocuments}
      />
      <PermDeleteDialog
        docs={permDeleteConfirmDocs}
        onCancel={() => setPermDeleteConfirmDocs(null)}
        onConfirm={onConfirmPermanentDelete}
      />
      {accessRequestDoc && (
        <AccessRequestModal
          workspaceId={currentWorkspaceId}
          document={accessRequestDoc}
          onClose={() => setAccessRequestDoc(null)}
        />
      )}
    </div>
  );
};

export default Documents;
