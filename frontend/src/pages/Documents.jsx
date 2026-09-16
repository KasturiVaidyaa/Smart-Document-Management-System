import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../utils/api";
import { useWorkspace } from "../context/WorkspaceContext";

const formatBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isPreviewable = (mimeType = "") =>
  mimeType.startsWith("image/") || mimeType === "application/pdf";

const Documents = () => {
  const { currentWorkspaceId, current, fetchWorkspaces } = useWorkspace();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const loadDocuments = async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/documents`
      );
      setDocuments(data.documents || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    setPreview(null);
  }, [currentWorkspaceId]);

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

  const onUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !currentWorkspaceId) return;

    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    try {
      await api.post(`/api/workspaces/${currentWorkspaceId}/documents`, form);
      toast.success("File uploaded. AI processing starts in the background for PDF/DOCX/PPTX/TXT.");
      await loadDocuments();
      await fetchWorkspaces();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-zinc-400">
            {current?.workspace?.name || "Workspace"} — upload and preview files
          </p>
        </div>
        <label className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
          {uploading ? "Uploading..." : "Upload file"}
          <input
            type="file"
            className="hidden"
            disabled={uploading || !currentWorkspaceId}
            onChange={onUpload}
          />
        </label>
      </div>

      <form onSubmit={onSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, category, or meaning"
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        />
        <button className="rounded-md border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">
          {searching ? "Searching..." : "Search"}
        </button>
      </form>

      {loading ? (
        <p className="text-zinc-400">Loading documents...</p>
      ) : documents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
          No files yet. Upload a PDF or image to get started.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900">
          {documents.map((doc) => (
            <li
              key={doc._id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-medium">{doc.name}</p>
                <p className="text-xs text-zinc-500">
                  {doc.aiCategory || doc.mimeType || "file"}
                  {doc.sizeBytes ? ` · ${formatBytes(doc.sizeBytes)}` : ""}
                  {doc.processing?.embed === "pending" ? " · processing" : ""}
                  {doc.processing?.embed === "failed" ? " · AI failed" : ""}
                </p>
                {(doc.snippet || doc.summary) && (
                  <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                    {doc.snippet || doc.summary}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Link
                  to={`/app/chat?documentId=${doc._id}`}
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
                >
                  Chat
                </Link>
                <button
                  onClick={() => openDocument(doc)}
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
                >
                  Open
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-medium">{preview.name}</p>
            <button
              onClick={() => setPreview(null)}
              className="text-sm text-zinc-400 hover:text-white"
            >
              Close
            </button>
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
    </div>
  );
};

export default Documents;
