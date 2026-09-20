import React, { useState, useEffect } from "react";
import {
  History,
  X,
  Upload,
  Download,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../utils/api";

const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const VersionHistoryModal = ({
  isOpen,
  onClose,
  document,
  workspaceId,
  onVersionUpdated, // callback to refresh document list
}) => {
  const [versions, setVersions] = useState([]);
  const [currentVersionId, setCurrentVersionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [revertingId, setRevertingId] = useState(null);

  // Upload new version form
  const [newVersionFile, setNewVersionFile] = useState(null);
  const [changeNote, setChangeNote] = useState("");

  const loadVersions = async () => {
    if (!document || !workspaceId) return;
    setLoading(true);
    try {
      const { data } = await api.get(
        `/api/workspaces/${workspaceId}/documents/${document._id}/versions`
      );
      setVersions(data.versions || []);
      setCurrentVersionId(data.currentVersionId);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load version history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && document) {
      loadVersions();
      setNewVersionFile(null);
      setChangeNote("");
    }
  }, [isOpen, document]);

  if (!isOpen || !document) return null;

  const handleUploadVersion = async (e) => {
    e.preventDefault();
    if (!newVersionFile) {
      toast.warn("Please select a file to upload");
      return;
    }

    const form = new FormData();
    form.append("file", newVersionFile);
    if (changeNote.trim()) {
      form.append("changeNote", changeNote.trim());
    }

    setUploading(true);
    try {
      await api.post(
        `/api/workspaces/${workspaceId}/documents/${document._id}/versions`,
        form
      );
      toast.success("New version uploaded successfully");
      setNewVersionFile(null);
      setChangeNote("");
      await loadVersions();
      if (onVersionUpdated) onVersionUpdated();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Upload version failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadVersion = async (version) => {
    try {
      const { data } = await api.get(
        `/api/workspaces/${workspaceId}/documents/${document._id}/versions/${version._id}/file`
      );
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to get version file");
    }
  };

  const handleRevert = async (version) => {
    const confirmMessage = `Revert document to Version ${version.versionNumber}? This will create a new current version referencing Version ${version.versionNumber}, preserving full history.`;
    if (!window.confirm(confirmMessage)) return;

    setRevertingId(version._id);
    try {
      await api.post(
        `/api/workspaces/${workspaceId}/documents/${document._id}/versions/${version._id}/revert`
      );
      toast.success(`Reverted to version ${version.versionNumber}`);
      await loadVersions();
      if (onVersionUpdated) onVersionUpdated();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Revert failed");
    } finally {
      setRevertingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-600/10 p-2 text-blue-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-100 text-lg">
                Version History
              </h3>
              <p className="text-xs text-zinc-400 truncate max-w-md">
                {document.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white rounded-lg p-1.5 hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Upload New Version Section */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Upload className="h-4 w-4 text-blue-400" />
              Upload New Version
            </h4>
            <form onSubmit={handleUploadVersion} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="file"
                  onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
                  className="flex-1 text-sm text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                />
                <input
                  type="text"
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  placeholder="Change summary / note (optional)"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploading || !newVersionFile}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "Uploading..." : "Upload Version"}
                </button>
              </div>
            </form>
          </div>

          {/* Versions List */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              All Versions ({versions.length})
            </h4>

            {loading ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                Loading version history...
              </div>
            ) : versions.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                No version records found.
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
                {versions.map((ver) => {
                  const isCurrent =
                    String(ver._id) === String(currentVersionId);
                  return (
                    <li
                      key={ver._id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 transition-colors ${
                        isCurrent
                          ? "bg-blue-950/20 border-l-4 border-blue-500"
                          : "hover:bg-zinc-900/50"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-100">
                            Version {ver.versionNumber}
                          </span>
                          {isCurrent && (
                            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/30">
                              Current
                            </span>
                          )}
                          <span className="text-xs text-zinc-400">
                            · {formatBytes(ver.sizeBytes)}
                          </span>
                        </div>

                        {ver.changeNote && (
                          <p className="text-xs text-zinc-300 italic">
                            "{ver.changeNote}"
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                          <span>
                            By {ver.uploadedBy?.name || "Workspace Member"}
                          </span>
                          <span>•</span>
                          <span>{formatDate(ver.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadVersion(ver)}
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>File</span>
                        </button>

                        {!isCurrent && (
                          <button
                            type="button"
                            disabled={revertingId === ver._id}
                            onClick={() => handleRevert(ver)}
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-amber-400 hover:bg-amber-950/40 hover:border-amber-500/40 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>
                              {revertingId === ver._id
                                ? "Reverting..."
                                : "Revert"}
                            </span>
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-zinc-800 bg-zinc-950/40">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
