import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  History,
  Trash2,
  RotateCcw,
  CornerDownRight,
  ChevronRight,
  MessageSquare,
  ExternalLink,
  Upload,
  AlertTriangle,
  FolderOpen,
  Home,
  CheckSquare,
  Square,
  Search,
  X,
  Eye,
  Download,
  Shield,
  Link2,
  Building2,
  Activity,
  Brain,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Tag,
  Filter,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import api from "../utils/api";
import { useWorkspace } from "../context/WorkspaceContext";
import { FolderTree } from "../components/documents/FolderTree";
import {
  CreateFolderModal,
  RenameFolderModal,
  DeleteFolderModal,
  MoveDocumentModal,
} from "../components/documents/FolderModals";
import { VersionHistoryModal } from "../components/documents/VersionHistoryModal";
import { BulkActionBar } from "../components/documents/BulkActionBar";
import { PermissionsModal } from "../components/documents/PermissionsModal";
import { ShareLinkModal } from "../components/documents/ShareLinkModal";
import { DocumentTimelineModal } from "../components/documents/DocumentTimelineModal";
import { DocumentSkeleton } from "../components/documents/DocumentSkeleton";

const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mimeType = "", name = "") => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (mimeType.startsWith("image/")) {
    return <FileImage className="h-5 w-5 text-purple-400" />;
  }
  if (mimeType === "application/pdf" || ext === "pdf") {
    return <FileText className="h-5 w-5 text-rose-400" />;
  }
  if (
    mimeType.includes("sheet") ||
    mimeType.includes("csv") ||
    ["csv", "xlsx", "xls"].includes(ext)
  ) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-400" />;
  }
  return <File className="h-5 w-5 text-blue-400" />;
};

/** Renders a processing status badge with colored classes */
const ProcessingStatusBadge = ({ processing, jobStatus }) => {
  // Determine the most meaningful status to show
  let status = "none";
  if (jobStatus === "running" || jobStatus === "queued") {
    status = "running";
  } else if (jobStatus === "failed" || processing?.embed === "failed" || processing?.extract === "failed") {
    status = "failed";
  } else if (jobStatus === "ready" || processing?.embed === "ready") {
    status = "ready";
  } else if (processing?.embed === "pending" || processing?.extract === "pending") {
    status = "pending";
  }

  if (status === "none") return null;

  const labels = { pending: "Pending", running: "Processing…", ready: "AI Ready", failed: "AI Failed" };
  const classMap = {
    pending: "status-pending",
    running: "status-running",
    ready: "status-ready",
    failed: "status-failed",
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classMap[status]}`}>
      {status === "running" && (
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
      )}
      {labels[status]}
    </span>
  );
};

/**
 * Highlights query terms in a snippet string.
 * Converts **term** markers (from backend) into <mark> elements.
 */
const HighlightedSnippet = ({ text = "" }) => {
  if (!text) return null;

  // Backend sends **term** markers; convert to JSX highlights
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <mark key={i} className="search-highlight">
              {part.slice(2, -2)}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

/** Collapsible AI Intelligence panel for a document row */
const AiPanel = ({ doc, workspaceId, onReprocessed }) => {
  const [reprocessing, setReprocessing] = useState(false);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const { data } = await api.post(
        `/api/workspaces/${workspaceId}/documents/${doc._id}/reprocess`
      );
      toast.success("Reprocessing started — AI will update summary, category, and keywords shortly.");
      if (onReprocessed) onReprocessed(data.document);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Reprocess failed");
    } finally {
      setReprocessing(false);
    }
  };

  const hasAiData = doc.summary || doc.aiCategory || (doc.aiKeywords && doc.aiKeywords.length > 0);

  return (
    <div className="mt-2 rounded-lg border border-zinc-700/50 bg-zinc-950/40 px-3 py-2.5 text-xs space-y-2">
      {/* Processing status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <span className="text-zinc-400 font-medium">AI Intelligence</span>
          <ProcessingStatusBadge processing={doc.processing} jobStatus={doc.jobStatus} />
        </div>
        <button
          type="button"
          onClick={handleReprocess}
          disabled={reprocessing}
          title="Re-trigger AI processing for this document"
          className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-blue-300 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${reprocessing ? "animate-spin" : ""}`} />
          {reprocessing ? "Starting…" : "Re-process"}
        </button>
      </div>

      {hasAiData ? (
        <>
          {/* AI Category */}
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

          {/* AI Keywords */}
          {doc.aiKeywords && doc.aiKeywords.length > 0 && (
            <div className="flex items-start gap-2">
              <Brain className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-zinc-500 mr-1.5">Keywords:</span>
                <span className="flex flex-wrap gap-1 mt-0.5">
                  {doc.aiKeywords.slice(0, 8).map((kw, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-emerald-900/30 border border-emerald-700/40 px-1.5 py-0.5 text-[10px] text-emerald-300"
                    >
                      {kw}
                    </span>
                  ))}
                  {doc.aiKeywords.length > 8 && (
                    <span className="text-zinc-500">+{doc.aiKeywords.length - 8} more</span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* AI Summary */}
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

// ─── Main Component ─────────────────────────────────────────────────────────

const Documents = () => {
  const { currentWorkspaceId, current, fetchWorkspaces } = useWorkspace();
  const [searchParams] = useSearchParams();

  // Core Data
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Navigation & Filtering State
  const [activeTab, setActiveTab] = useState("files");
  const [selectedFolderId, setSelectedFolderId] = useState("all");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("all");
  const [uploadDepartmentId, setUploadDepartmentId] = useState("");

  // AI / Search Filters
  const [filterAiCategory, setFilterAiCategory] = useState("all");
  const [filterExtension, setFilterExtension] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterTags, setFilterTags] = useState("");
  const [showSearchFilters, setShowSearchFilters] = useState(false);

  // AI Panel visibility
  const [expandedAiDocId, setExpandedAiDocId] = useState(null);

  // Drag-and-drop
  const [isDragOver, setIsDragOver] = useState(false);
  const dropZoneRef = useRef(null);

  // Multi-Selection State
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());

  // Modals State
  const [createFolderParentId, setCreateFolderParentId] = useState(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [docsToMove, setDocsToMove] = useState([]);
  const [versionDoc, setVersionDoc] = useState(null);
  const [departmentDoc, setDepartmentDoc] = useState(null);

  // Permissions, Share Link & Timeline Modals
  const [permissionsDoc, setPermissionsDoc] = useState(null);
  const [shareLinkDoc, setShareLinkDoc] = useState(null);
  const [activityDoc, setActivityDoc] = useState(null);

  // Permanent Delete Confirmation Modal
  const [permDeleteConfirmDocs, setPermDeleteConfirmDocs] = useState(null);

  // Highlight document from URL param (e.g. ?highlight=id from chat citations)
  const highlightId = searchParams.get("highlight");

  // Fetch Categories
  const loadCategories = async () => {
    if (!currentWorkspaceId) return;
    try {
      const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/categories`);
      setCategories(data.categories || []);
    } catch {
      // silently ignore
    }
  };

  // Fetch Departments
  const loadDepartments = async () => {
    if (!currentWorkspaceId) return;
    try {
      const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/departments`);
      setDepartments(data.departments || []);
    } catch (error) {
      console.error("Failed to load departments:", error);
    }
  };

  // Fetch Folders
  const loadFolders = async () => {
    if (!currentWorkspaceId) return;
    try {
      const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/folders`);
      setFolders(data.folders || []);
    } catch (error) {
      console.error("Failed to load folders:", error);
    }
  };

  // Fetch Documents
  const loadDocuments = async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    setIsSearchMode(false);
    try {
      const params = {};
      if (activeTab === "trash") {
        params.status = "trash";
      } else {
        params.status = "active";
        if (selectedFolderId !== "all") {
          params.folderId = selectedFolderId || "root";
        }
      }

      if (selectedDepartmentId !== "all") {
        params.departmentId = selectedDepartmentId;
      }

      // AI category filter on listing
      if (filterAiCategory !== "all" && filterAiCategory) {
        params.aiCategory = filterAiCategory;
      }

      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/documents`,
        { params }
      );
      setDocuments(data.documents || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentWorkspaceId) {
      loadFolders();
      loadDepartments();
      loadDocuments();
      loadCategories();
      setPreview(null);
      setSelectedDocIds(new Set());
      setExpandedAiDocId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspaceId, activeTab, selectedFolderId, selectedDepartmentId, filterAiCategory]);

  // Search
  const onSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim() && !filterExtension && !filterDateFrom && !filterDateTo && !filterTags) {
      loadDocuments();
      return;
    }
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

      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/search`,
        { params }
      );
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
    setShowSearchFilters(false);
    loadDocuments();
  };

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  // Upload (shared between click and drag-drop)
  const uploadFile = async (file) => {
    if (!file || !currentWorkspaceId) return;
    const form = new FormData();
    form.append("file", file);
    if (selectedFolderId && selectedFolderId !== "all") {
      form.append("folderId", selectedFolderId);
    }
    if (uploadDepartmentId) {
      form.append("departmentId", uploadDepartmentId);
    } else if (
      selectedDepartmentId &&
      selectedDepartmentId !== "all" &&
      selectedDepartmentId !== "unassigned"
    ) {
      form.append("departmentId", selectedDepartmentId);
    }

    setUploading(true);
    try {
      const { data } = await api.post(`/api/workspaces/${currentWorkspaceId}/documents`, form);
      if (data.isNewVersion) {
        toast.success(data.message || "New version uploaded successfully");
      } else {
        toast.success("File uploaded. AI processing starts in the background for PDF/DOCX/PPTX/TXT.");
      }
      await loadDocuments();
      await fetchWorkspaces();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !currentWorkspaceId) return;
    await uploadFile(file);
  };

  // Upload via file input
  const onUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await uploadFile(file);
  };

  // Open Preview
  const openDocument = async (doc) => {
    try {
      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/file`,
        { params: { disposition: "inline" } }
      );
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not open file preview");
    }
  };

  // Download
  const downloadDocument = async (doc) => {
    try {
      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/file`,
        { params: { disposition: "attachment" } }
      );
      if (data.url) {
        const link = window.document.createElement("a");
        link.href = data.url;
        link.setAttribute("download", data.name || doc.name);
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not download file");
    }
  };

  // Soft Delete (Trash)
  const onTrashDoc = async (doc) => {
    try {
      await api.patch(`/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/trash`);
      toast.info(`"${doc.name}" moved to Trash`);
      await loadDocuments();
      setSelectedDocIds((prev) => {
        const next = new Set(prev);
        next.delete(doc._id);
        return next;
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not delete document");
    }
  };

  // Restore
  const onRestoreDoc = async (doc) => {
    try {
      await api.post(`/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/restore`);
      toast.success(`"${doc.name}" restored`);
      await loadDocuments();
      setSelectedDocIds((prev) => {
        const next = new Set(prev);
        next.delete(doc._id);
        return next;
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not restore document");
    }
  };

  // Permanent Delete
  const onConfirmPermanentDelete = async () => {
    if (!permDeleteConfirmDocs || permDeleteConfirmDocs.length === 0) return;
    try {
      if (permDeleteConfirmDocs.length === 1) {
        const doc = permDeleteConfirmDocs[0];
        await api.delete(`/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/permanent`);
        toast.success(`"${doc.name}" permanently deleted`);
      } else {
        const documentIds = permDeleteConfirmDocs.map((d) => d._id);
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

  // Move document(s)
  const onConfirmMoveDocs = async (targetFolderId) => {
    try {
      if (docsToMove.length === 1) {
        const doc = docsToMove[0];
        await api.patch(`/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/move`, { folderId: targetFolderId });
        toast.success(`"${doc.name}" moved`);
      } else {
        const documentIds = docsToMove.map((d) => d._id);
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

  // Folder CRUD handlers
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
      if (selectedFolderId === folderId) setSelectedFolderId(null);
      await loadFolders();
      await loadDocuments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete folder");
    }
  };

  // Bulk Operations
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

  const handleBulkMove = () => {
    const selectedDocs = documents.filter((d) => selectedDocIds.has(d._id));
    setDocsToMove(selectedDocs);
  };

  const handleBulkPermanentDelete = () => {
    const selectedDocs = documents.filter((d) => selectedDocIds.has(d._id));
    setPermDeleteConfirmDocs(selectedDocs);
  };

  // Selection toggle
  const toggleSelectDoc = (docId) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.size === documents.length) setSelectedDocIds(new Set());
    else setSelectedDocIds(new Set(documents.map((d) => d._id)));
  };

  // Update a single doc in the list (after reprocess)
  const handleDocReprocessed = (updatedDoc) => {
    setDocuments((prev) =>
      prev.map((d) => (String(d._id) === String(updatedDoc._id) ? { ...d, ...updatedDoc } : d))
    );
  };

  // Compute Breadcrumb trail
  const breadcrumbTrail = useMemo(() => {
    if (activeTab === "trash") return [{ id: "trash", name: "Trash" }];
    if (selectedFolderId === "all") return [{ id: "all", name: "All Documents" }];
    if (selectedFolderId === null) return [{ id: null, name: "Root Directory" }];

    const map = new Map(folders.map((f) => [f._id, f]));
    const trail = [];
    let curr = map.get(selectedFolderId);
    while (curr) {
      trail.unshift({ id: curr._id, name: curr.name });
      curr = curr.parentId ? map.get(curr.parentId) : null;
    }
    trail.unshift({ id: null, name: "Root" });
    return trail;
  }, [activeTab, selectedFolderId, folders]);

  const folderNameMap = useMemo(() => {
    const map = new Map();
    folders.forEach((f) => map.set(f._id, f.name));
    return map;
  }, [folders]);

  const departmentNameMap = useMemo(() => {
    const map = new Map();
    departments.forEach((d) => map.set(d._id, d.name));
    return map;
  }, [departments]);

  return (
    <div
      className="space-y-6"
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag-and-drop overlay */}
      {isDragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-950/60 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-blue-400 bg-blue-900/40 px-12 py-10 text-center shadow-2xl">
            <Upload className="mx-auto h-12 w-12 text-blue-400 mb-3" />
            <p className="text-lg font-semibold text-blue-200">Drop file to upload</p>
            <p className="text-sm text-blue-400 mt-1">Max 25MB</p>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Documents</h1>
          <p className="text-sm text-zinc-400">
            {current?.workspace?.name || "Workspace"} — manage, organize, and version your files
          </p>
        </div>

        {activeTab === "files" && (
          <div className="flex items-center gap-2">
            {departments.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/90 px-2.5 py-1.5 text-xs">
                <Building2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <select
                  value={uploadDepartmentId}
                  onChange={(e) => setUploadDepartmentId(e.target.value)}
                  title="Assign department to new upload"
                  className="bg-transparent text-xs text-zinc-300 focus:outline-none cursor-pointer"
                >
                  <option value="" className="bg-zinc-900 text-zinc-300">
                    {selectedDepartmentId && selectedDepartmentId !== "all" && selectedDepartmentId !== "unassigned"
                      ? `Upload Dept (${departmentNameMap.get(selectedDepartmentId) || "Selected"})`
                      : "No Department"}
                  </option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id} className="bg-zinc-900 text-zinc-200">
                      Dept: {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <label
              className={`flex items-center gap-2 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 shadow-md shadow-blue-900/30 transition-all ${isDragOver ? "bg-blue-500" : ""}`}
              title="Click to browse or drag a file anywhere on the page"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading..." : "Upload file"}
              <input
                type="file"
                className="hidden"
                disabled={uploading || !currentWorkspaceId}
                onChange={onUpload}
              />
            </label>
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <form onSubmit={onSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents by name, category, or meaning..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/90 pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              {searching ? "Searching..." : "Search"}
            </button>
            <button
              type="button"
              onClick={() => setShowSearchFilters((v) => !v)}
              title="Toggle search filters"
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${showSearchFilters ? "border-blue-600 bg-blue-600/10 text-blue-300" : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"}`}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
            {isSearchMode && (
              <button
                type="button"
                onClick={clearSearch}
                title="Clear search"
                className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/90 px-3 py-2 text-xs">
              <Building2 className="h-4 w-4 text-zinc-400 shrink-0" />
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                aria-label="Filter documents by department"
                className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-zinc-900 text-zinc-200">All Departments</option>
                <option value="unassigned" className="bg-zinc-900 text-zinc-200">Unassigned</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id} className="bg-zinc-900 text-zinc-200">
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Collapsible Search Filter Panel */}
        {showSearchFilters && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <p className="text-xs font-semibold text-zinc-400 flex items-center gap-2">
              <Filter className="h-3.5 w-3.5" /> Advanced Filters
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* AI Category */}
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">AI Category</label>
                <select
                  value={filterAiCategory}
                  onChange={(e) => setFilterAiCategory(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* File Type */}
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">File Type</label>
                <select
                  value={filterExtension}
                  onChange={(e) => setFilterExtension(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="pdf">PDF</option>
                  <option value="docx">DOCX</option>
                  <option value="pptx">PPTX</option>
                  <option value="xlsx">XLSX</option>
                  <option value="txt">TXT</option>
                  <option value="md">Markdown</option>
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                  <option value="csv">CSV</option>
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1 flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Date From
                </label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1 flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Date To
                </label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Tags */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-zinc-500 mb-1 flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={filterTags}
                  onChange={(e) => setFilterTags(e.target.value)}
                  placeholder="e.g. contract, finance, Q3"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Apply / Clear buttons */}
              <div className="sm:col-span-2 flex items-end gap-2">
                <button
                  type="button"
                  onClick={onSearch}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search mode banner */}
        {isSearchMode && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-800/40 bg-blue-900/10 px-3 py-2 text-xs text-blue-300">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span>
              Showing <strong>{documents.length}</strong> result{documents.length !== 1 ? "s" : ""}
              {query && <> for <strong className="text-white">"{query}"</strong></>}
            </span>
            <button onClick={clearSearch} className="ml-auto hover:text-rose-400 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* AI Category Quick Filter */}
      {!isSearchMode && activeTab === "files" && categories.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> AI Category:
          </span>
          <button
            onClick={() => setFilterAiCategory("all")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium border transition-colors ${filterAiCategory === "all" ? "border-blue-600 bg-blue-600/10 text-blue-300" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterAiCategory(cat === filterAiCategory ? "all" : cat)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium border transition-colors ${filterAiCategory === cat ? "border-indigo-600 bg-indigo-600/10 text-indigo-300" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Main Layout: Folder Sidebar + Documents View */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Folder Tree Sidebar */}
        <FolderTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={(id) => {
            setSelectedFolderId(id);
            setQuery("");
            setIsSearchMode(false);
          }}
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setQuery("");
            setIsSearchMode(false);
          }}
          onOpenCreateModal={(parentId) => {
            setCreateFolderParentId(parentId);
            setIsCreateFolderOpen(true);
          }}
          onOpenRenameModal={(folder) => setFolderToRename(folder)}
          onOpenDeleteModal={(folder) => setFolderToDelete(folder)}
        />

        {/* Right Documents Main Content Area */}
        <div className="flex-1 w-full space-y-4">
          {/* Breadcrumb Bar */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 backdrop-blur-sm">
            <nav className="flex items-center gap-1.5 text-xs text-zinc-400 overflow-x-auto">
              {breadcrumbTrail.map((crumb, idx) => {
                const isLast = idx === breadcrumbTrail.length - 1;
                return (
                  <div key={crumb.id || idx} className="flex items-center gap-1.5 shrink-0">
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

            <div className="text-xs text-zinc-500">
              {documents.length} {documents.length === 1 ? "file" : "files"}
            </div>
          </div>

          {/* Documents Table / List */}
          {loading ? (
            <DocumentSkeleton count={6} />
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
              <p className="text-sm font-medium text-zinc-300">
                {activeTab === "trash" ? "Trash is empty." : isSearchMode ? "No results found." : "No documents in this location."}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {activeTab === "trash"
                  ? "Deleted documents will appear here."
                  : isSearchMode
                  ? "Try different search terms or adjust filters."
                  : "Upload a PDF, image, or office document to get started. You can also drag and drop files."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-sm">
              {/* Table Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/40 px-4 py-2.5 text-xs font-semibold text-zinc-400">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    {selectedDocIds.size === documents.length && documents.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-blue-400" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                  <span>Name</span>
                </div>
                <span>Actions</span>
              </div>

              {/* Rows */}
              <ul className="divide-y divide-zinc-800/80">
                {documents.map((doc) => {
                  const isSelected = selectedDocIds.has(doc._id);
                  const isHighlighted = highlightId && String(doc._id) === String(highlightId);
                  const folderName = doc.folderId ? folderNameMap.get(doc.folderId) : null;
                  const isAiExpanded = expandedAiDocId === doc._id;

                  return (
                    <li
                      key={doc._id}
                      id={`doc-${doc._id}`}
                      className={`flex flex-col gap-2 px-4 py-3 transition-colors ${
                        isHighlighted
                          ? "bg-blue-950/30 border-l-2 border-blue-500"
                          : isSelected
                          ? "bg-blue-950/20"
                          : "hover:bg-zinc-800/40"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleSelectDoc(doc._id)}
                            className="mt-1 sm:mt-0 text-zinc-500 hover:text-zinc-300 shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-blue-400" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>

                          <div className="shrink-0 mt-0.5 sm:mt-0">
                            {getFileIcon(doc.mimeType, doc.name)}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                onClick={() => openDocument(doc)}
                                className="font-medium text-sm text-zinc-100 hover:text-blue-400 cursor-pointer truncate"
                              >
                                {doc.name}
                              </span>

                              {/* Version Badge */}
                              <button
                                type="button"
                                onClick={() => setVersionDoc(doc)}
                                title="Click to view version history"
                                className="flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700 transition-colors"
                              >
                                <History className="h-3 w-3 text-blue-400" />
                                <span>v{doc.versionCount || 1}</span>
                              </button>

                              {/* AI Status Badge (inline) */}
                              {doc.processing && (
                                <ProcessingStatusBadge processing={doc.processing} />
                              )}

                              {/* AI Category Badge */}
                              {doc.aiCategory && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-950/40 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-800/50">
                                  <Sparkles className="h-2.5 w-2.5 text-indigo-400" />
                                  {doc.aiCategory}
                                </span>
                              )}

                              {/* Folder badge */}
                              {selectedFolderId === "all" && folderName && (
                                <span className="rounded-md bg-zinc-800/60 px-1.5 py-0.5 text-[10px] text-zinc-400 border border-zinc-700/60">
                                  📁 {folderName}
                                </span>
                              )}

                              {/* Department badge */}
                              {doc.departmentId && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-md bg-indigo-950/40 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-800/50"
                                  title={`Department: ${departmentNameMap.get(doc.departmentId) || "Assigned"}`}
                                >
                                  <Building2 className="h-2.5 w-2.5 text-indigo-400" />
                                  <span>{departmentNameMap.get(doc.departmentId) || "Department"}</span>
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-zinc-500 mt-0.5">
                              {doc.mimeType || "file"}
                              {doc.sizeBytes ? ` · ${formatBytes(doc.sizeBytes)}` : ""}
                            </p>

                            {/* Snippet / Summary with highlighting */}
                            {(doc.snippet || doc.summary) && (
                              <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                                <HighlightedSnippet
                                  text={doc.snippet || doc.summary}
                                  query={isSearchMode ? query : ""}
                                />
                              </p>
                            )}

                            {/* Tags */}
                            {doc.tags && doc.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {doc.tags.slice(0, 5).map((tag, i) => (
                                  <span
                                    key={i}
                                    className="rounded-md bg-zinc-800/60 px-1.5 py-0.5 text-[10px] text-zinc-400 border border-zinc-700/60"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 flex-wrap">
                          {activeTab === "files" ? (
                            <>
                              {/* AI Intelligence toggle */}
                              <button
                                title="View AI intelligence panel"
                                type="button"
                                onClick={() => setExpandedAiDocId(isAiExpanded ? null : doc._id)}
                                className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${isAiExpanded ? "border-indigo-600/50 bg-indigo-600/10 text-indigo-300" : "border-zinc-700/80 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700 hover:text-indigo-400"}`}
                              >
                                <Brain className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">AI</span>
                                {isAiExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>

                              <button
                                title="Preview document in new tab"
                                type="button"
                                onClick={() => openDocument(doc)}
                                className="flex items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5 text-blue-400" />
                                <span className="hidden sm:inline">Open</span>
                              </button>

                              <button
                                title="Download document"
                                type="button"
                                onClick={() => downloadDocument(doc)}
                                className="flex items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                              >
                                <Download className="h-3.5 w-3.5 text-zinc-300" />
                                <span className="hidden sm:inline">Download</span>
                              </button>

                              <button
                                title="Upload new version"
                                type="button"
                                onClick={() => setVersionDoc(doc)}
                                className="flex items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                              >
                                <Upload className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="hidden md:inline">New Version</span>
                              </button>

                              <Link
                                to={`/app/chat?documentId=${doc._id}`}
                                title="Chat with document AI"
                                className="flex items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                              >
                                <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="hidden sm:inline">Chat</span>
                              </Link>

                              <button
                                title="Share link"
                                type="button"
                                onClick={() => setShareLinkDoc(doc)}
                                className="rounded-md border border-zinc-700/80 bg-zinc-800/80 p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                              >
                                <Link2 className="h-3.5 w-3.5 text-emerald-400" />
                              </button>

                              <button
                                title="Activity timeline"
                                type="button"
                                onClick={() => setActivityDoc(doc)}
                                className="rounded-md border border-zinc-700/80 bg-zinc-800/80 p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                              >
                                <Activity className="h-3.5 w-3.5 text-blue-400" />
                              </button>

                              <button
                                title="Permissions"
                                type="button"
                                onClick={() => setPermissionsDoc(doc)}
                                className="rounded-md border border-zinc-700/80 bg-zinc-800/80 p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                              >
                                <Shield className="h-3.5 w-3.5 text-amber-400" />
                              </button>

                              <button
                                title="Department"
                                type="button"
                                onClick={() => setDepartmentDoc(doc)}
                                className="rounded-md border border-zinc-700/80 bg-zinc-800/80 p-1.5 text-zinc-300 hover:text-indigo-400 hover:bg-zinc-700 transition-colors"
                              >
                                <Building2 className="h-3.5 w-3.5" />
                              </button>

                              <button
                                title="Move document"
                                type="button"
                                onClick={() => setDocsToMove([doc])}
                                className="rounded-md border border-zinc-700/80 bg-zinc-800/80 p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                              >
                                <CornerDownRight className="h-3.5 w-3.5 text-blue-400" />
                              </button>

                              <button
                                title="Move to trash"
                                type="button"
                                onClick={() => onTrashDoc(doc)}
                                className="rounded-md border border-zinc-700/80 bg-zinc-800/80 p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-700 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                title="Restore document"
                                type="button"
                                onClick={() => onRestoreDoc(doc)}
                                className="flex items-center gap-1 rounded-md border border-emerald-600/30 bg-emerald-600/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-600/20 transition-colors"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Restore</span>
                              </button>

                              <button
                                title="Delete permanently"
                                type="button"
                                onClick={() => setPermDeleteConfirmDocs([doc])}
                                className="flex items-center gap-1 rounded-md border border-rose-600/40 bg-rose-600/20 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-600/30 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* AI Panel — shown when AI button clicked */}
                      {isAiExpanded && activeTab === "files" && (
                        <AiPanel
                          doc={doc}
                          workspaceId={currentWorkspaceId}
                          onReprocessed={handleDocReprocessed}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedDocIds.size}
        activeTab={activeTab}
        onClearSelection={() => setSelectedDocIds(new Set())}
        onBulkMove={handleBulkMove}
        onBulkTrash={handleBulkTrash}
        onBulkRestore={handleBulkRestore}
        onBulkPermanentDelete={handleBulkPermanentDelete}
      />

      {/* Preview Container */}
      {preview && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <FileText className="h-4 w-4 text-blue-400 shrink-0" />
              <p className="font-medium text-sm text-zinc-100 truncate">{preview.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
              <button
                onClick={() => setPreview(null)}
                className="rounded-md p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {preview.mimeType?.startsWith("image/") ? (
            <img
              src={preview.url}
              alt={preview.name}
              className="max-h-[70vh] w-full rounded-md object-contain bg-black"
            />
          ) : (
            <iframe
              title={preview.name}
              src={preview.url}
              className="h-[70vh] w-full rounded-md bg-white"
            />
          )}
        </div>
      )}

      {/* Modals */}
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

      {/* Permanent Delete Confirmation Dialog */}
      {permDeleteConfirmDocs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-800 text-rose-400 font-semibold">
              <div className="rounded-full bg-rose-500/10 p-2">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
              </div>
              <h3>Permanent Deletion</h3>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm text-zinc-300">
                Are you sure you want to permanently delete{" "}
                <span className="font-semibold text-white">
                  {permDeleteConfirmDocs.length === 1
                    ? `"${permDeleteConfirmDocs[0].name}"`
                    : `${permDeleteConfirmDocs.length} documents`}
                </span>
                ?
              </p>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                <p className="font-semibold mb-1">This action cannot be undone.</p>
                All versions, metadata, and files stored on AWS S3 will be completely and irreversibly removed.
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPermDeleteConfirmDocs(null)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmPermanentDelete}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── ChangeDepartmentModal (unchanged from original) ─────────────────────────

const ChangeDepartmentModal = ({
  isOpen,
  onClose,
  document: doc,
  departments = [],
  workspaceId,
  onUpdated,
}) => {
  const [selectedDept, setSelectedDept] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (doc) {
      setSelectedDept(doc.departmentId || "");
    }
  }, [doc, isOpen]);

  if (!isOpen || !doc) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(
        `/api/workspaces/${workspaceId}/documents/${doc._id}/department`,
        { departmentId: selectedDept || null }
      );
      toast.success("Document department updated");
      onClose();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update document department");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-100 font-semibold">
            <Building2 className="h-5 w-5 text-indigo-400" />
            <h3>Assign Department</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white rounded-lg p-1 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <p className="text-xs text-zinc-400 mb-2">
              Select department assignment for{" "}
              <span className="text-white font-medium">{doc.name}</span>:
            </p>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">None (Unassigned)</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Documents;
