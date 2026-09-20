import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
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

const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isPreviewable = (mimeType = "") =>
  mimeType.startsWith("image/") || mimeType === "application/pdf";

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

const Documents = () => {
  const { currentWorkspaceId, current, fetchWorkspaces } = useWorkspace();

  // Core Data
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  // Navigation State: activeTab: "files" | "trash"
  const [activeTab, setActiveTab] = useState("files");
  // selectedFolderId: "all" | null (Root) | folderId
  const [selectedFolderId, setSelectedFolderId] = useState("all");

  // Multi-Selection State
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());

  // Modals State
  const [createFolderParentId, setCreateFolderParentId] = useState(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [docsToMove, setDocsToMove] = useState([]);
  const [versionDoc, setVersionDoc] = useState(null);

  // Permanent Delete Confirmation Modal
  const [permDeleteConfirmDocs, setPermDeleteConfirmDocs] = useState(null);

  // Fetch Folders
  const loadFolders = async () => {
    if (!currentWorkspaceId) return;
    try {
      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/folders`
      );
      setFolders(data.folders || []);
    } catch (error) {
      console.error("Failed to load folders:", error);
    }
  };

  // Fetch Documents
  const loadDocuments = async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
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
      loadDocuments();
      setPreview(null);
      setSelectedDocIds(new Set());
    }
  }, [currentWorkspaceId, activeTab, selectedFolderId]);

  // Search
  const onSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() || !currentWorkspaceId) {
      loadDocuments();
      return;
    }
    setSearching(true);
    try {
      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/search`,
        { params: { q: query.trim() } }
      );
      setDocuments(data.documents || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  // Upload
  const onUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !currentWorkspaceId) return;

    const form = new FormData();
    form.append("file", file);
    if (selectedFolderId && selectedFolderId !== "all") {
      form.append("folderId", selectedFolderId);
    }

    setUploading(true);
    try {
      await api.post(`/api/workspaces/${currentWorkspaceId}/documents`, form);
      toast.success(
        "File uploaded. AI processing starts in the background for PDF/DOCX/PPTX/TXT."
      );
      await loadDocuments();
      await fetchWorkspaces();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Open Preview
  const openDocument = async (doc) => {
    try {
      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/file`
      );
      if (isPreviewable(data.mimeType)) {
        setPreview(data);
      } else {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not open file");
    }
  };

  // Soft Delete (Trash)
  const onTrashDoc = async (doc) => {
    try {
      await api.patch(
        `/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/trash`
      );
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
      await api.post(
        `/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/restore`
      );
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
        await api.delete(
          `/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/permanent`
        );
        toast.success(`"${doc.name}" permanently deleted`);
      } else {
        const documentIds = permDeleteConfirmDocs.map((d) => d._id);
        await api.post(
          `/api/workspaces/${currentWorkspaceId}/documents/bulk-delete`,
          { documentIds }
        );
        toast.success(`${documentIds.length} documents permanently deleted`);
      }
      setPermDeleteConfirmDocs(null);
      await loadDocuments();
      await fetchWorkspaces();
      setSelectedDocIds(new Set());
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not permanently delete"
      );
    }
  };

  // Move document(s)
  const onConfirmMoveDocs = async (targetFolderId) => {
    try {
      if (docsToMove.length === 1) {
        const doc = docsToMove[0];
        await api.patch(
          `/api/workspaces/${currentWorkspaceId}/documents/${doc._id}/move`,
          { folderId: targetFolderId }
        );
        toast.success(`"${doc.name}" moved`);
      } else {
        const documentIds = docsToMove.map((d) => d._id);
        await api.post(
          `/api/workspaces/${currentWorkspaceId}/documents/bulk-move`,
          { documentIds, folderId: targetFolderId }
        );
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
      await api.post(`/api/workspaces/${currentWorkspaceId}/folders`, {
        name,
        parentId,
      });
      toast.success("Folder created");
      await loadFolders();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to create folder");
    }
  };

  const handleRenameFolder = async (folderId, newName) => {
    try {
      await api.patch(
        `/api/workspaces/${currentWorkspaceId}/folders/${folderId}`,
        { name: newName }
      );
      toast.success("Folder renamed");
      await loadFolders();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to rename folder");
    }
  };

  const handleDeleteFolder = async (folderId) => {
    try {
      await api.delete(
        `/api/workspaces/${currentWorkspaceId}/folders/${folderId}`
      );
      toast.success("Folder deleted");
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
      }
      await loadFolders();
      await loadDocuments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete folder");
    }
  };

  // Bulk Operations Handlers
  const handleBulkTrash = async () => {
    const ids = Array.from(selectedDocIds);
    try {
      await api.post(
        `/api/workspaces/${currentWorkspaceId}/documents/bulk-trash`,
        { documentIds: ids }
      );
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
      await api.post(
        `/api/workspaces/${currentWorkspaceId}/documents/bulk-restore`,
        { documentIds: ids }
      );
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
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.size === documents.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(documents.map((d) => d._id)));
    }
  };

  // Compute Breadcrumb trail
  const breadcrumbTrail = useMemo(() => {
    if (activeTab === "trash") {
      return [{ id: "trash", name: "Trash" }];
    }
    if (selectedFolderId === "all") {
      return [{ id: "all", name: "All Documents" }];
    }
    if (selectedFolderId === null) {
      return [{ id: null, name: "Root Directory" }];
    }

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

  // Folder lookup map for document badges
  const folderNameMap = useMemo(() => {
    const map = new Map();
    folders.forEach((f) => map.set(f._id, f.name));
    return map;
  }, [folders]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Documents
          </h1>
          <p className="text-sm text-zinc-400">
            {current?.workspace?.name || "Workspace"} — manage, organize, and
            version your files
          </p>
        </div>

        {activeTab === "files" && (
          <label className="flex items-center gap-2 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 shadow-md shadow-blue-900/30 transition-all">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload file"}
            <input
              type="file"
              className="hidden"
              disabled={uploading || !currentWorkspaceId}
              onChange={onUpload}
            />
          </label>
        )}
      </div>

      {/* Search Bar */}
      <form onSubmit={onSearch} className="flex gap-2">
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
      </form>

      {/* Main Layout: Folder Sidebar + Documents View */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Folder Tree Sidebar */}
        <FolderTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={(id) => {
            setSelectedFolderId(id);
            setQuery("");
          }}
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setQuery("");
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
                      onClick={() => {
                        setSelectedFolderId(crumb.id);
                      }}
                      className={`hover:text-white transition-colors ${
                        isLast
                          ? "font-semibold text-zinc-100"
                          : "text-zinc-400 hover:underline"
                      }`}
                    >
                      {crumb.name}
                    </button>
                    {!isLast && (
                      <ChevronRight className="h-3 w-3 text-zinc-600" />
                    )}
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
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-sm text-zinc-400">
              Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
              <p className="text-sm font-medium text-zinc-300">
                {activeTab === "trash"
                  ? "Trash is empty."
                  : "No documents in this location."}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {activeTab === "trash"
                  ? "Deleted documents will appear here."
                  : "Upload a PDF, image, or office document to get started."}
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
                    {selectedDocIds.size === documents.length &&
                    documents.length > 0 ? (
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
                  const folderName = doc.folderId
                    ? folderNameMap.get(doc.folderId)
                    : null;

                  return (
                    <li
                      key={doc._id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 transition-colors ${
                        isSelected
                          ? "bg-blue-950/20"
                          : "hover:bg-zinc-800/40"
                      }`}
                    >
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

                            {/* Version Badge (Click opens version history) */}
                            <button
                              type="button"
                              onClick={() => setVersionDoc(doc)}
                              title="Click to view version history"
                              className="flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700 transition-colors"
                            >
                              <History className="h-3 w-3 text-blue-400" />
                              <span>v{doc.versionCount || 1}</span>
                            </button>

                            {/* Folder badge if in all files view */}
                            {selectedFolderId === "all" && folderName && (
                              <span className="rounded-md bg-zinc-800/60 px-1.5 py-0.5 text-[10px] text-zinc-400 border border-zinc-700/60">
                                📁 {folderName}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-zinc-500 mt-0.5">
                            {doc.aiCategory || doc.mimeType || "file"}
                            {doc.sizeBytes
                              ? ` · ${formatBytes(doc.sizeBytes)}`
                              : ""}
                            {doc.processing?.embed === "pending"
                              ? " · AI processing"
                              : ""}
                            {doc.processing?.embed === "failed"
                              ? " · AI failed"
                              : ""}
                          </p>

                          {(doc.snippet || doc.summary) && (
                            <p className="mt-1 text-xs text-zinc-400 line-clamp-1">
                              {doc.snippet || doc.summary}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        {activeTab === "files" ? (
                          <>
                            <button
                              title="Preview or open document"
                              type="button"
                              onClick={() => openDocument(doc)}
                              className="flex items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Open</span>
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
              <p className="font-medium text-sm text-zinc-100 truncate">
                {preview.name}
              </p>
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

export default Documents;
