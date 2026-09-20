import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FileText,
  Lock,
  Eye,
  Download,
  AlertTriangle,
  LinkIcon,
  FileImage,
  File,
  Loader2,
} from "lucide-react";
import api from "../utils/api";

const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mimeType = "") => {
  if (mimeType.startsWith("image/")) {
    return <FileImage className="h-10 w-10 text-purple-400" />;
  }
  if (mimeType === "application/pdf") {
    return <FileText className="h-10 w-10 text-rose-400" />;
  }
  return <File className="h-10 w-10 text-blue-400" />;
};

const ShareLinkAccess = () => {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [linkInfo, setLinkInfo] = useState(null);
  const [password, setPassword] = useState("");
  const [accessing, setAccessing] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [fileData, setFileData] = useState(null);

  useEffect(() => {
    if (token) {
      resolveLink();
    }
  }, [token]);

  const resolveLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/api/share/${token}`);
      setLinkInfo(data);

      // If no password required, auto-access
      if (!data.requiresPassword) {
        await accessFile("");
      }
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || "This share link is not available";
      if (status === 410) {
        setError({ type: "expired", message: msg });
      } else if (status === 404) {
        setError({ type: "notfound", message: msg });
      } else {
        setError({ type: "error", message: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const accessFile = async (pwd) => {
    setAccessing(true);
    setPasswordError("");
    try {
      const { data } = await api.post(`/api/share/${token}/file`, {
        password: pwd || undefined,
      });
      setFileData(data);
    } catch (err) {
      const msg = err?.response?.data?.message || "Could not access file";
      if (err?.response?.status === 401) {
        setPasswordError(msg);
      } else {
        setError({ type: "error", message: msg });
      }
    } finally {
      setAccessing(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    accessFile(password);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Loading share link...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl text-center">
          <div className="mx-auto mb-4 rounded-full bg-rose-500/10 p-4 w-fit">
            <AlertTriangle className="h-8 w-8 text-rose-400" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100 mb-2">
            {error.type === "expired"
              ? "Link Unavailable"
              : error.type === "notfound"
              ? "Link Not Found"
              : "Access Error"}
          </h1>
          <p className="text-sm text-zinc-400 mb-6">{error.message}</p>
          <Link
            to="/"
            className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // Password gate
  if (linkInfo?.requiresPassword && !fileData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 rounded-full bg-amber-500/10 p-4 w-fit">
              <Lock className="h-8 w-8 text-amber-400" />
            </div>
            <h1 className="text-xl font-bold text-zinc-100 mb-1">
              Password Protected
            </h1>
            <p className="text-sm text-zinc-400">
              This shared document requires a password to access.
            </p>
          </div>

          {/* Document info */}
          {linkInfo?.document && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              {getFileIcon(linkInfo.document.mimeType)}
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">
                  {linkInfo.document.name}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatBytes(linkInfo.document.sizeBytes)}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {passwordError && (
                <p className="mt-2 text-xs text-rose-400">{passwordError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={accessing || !password.trim()}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
            >
              {accessing ? "Verifying..." : "Access Document"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // File accessible — show preview/download
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-500/10 p-2">
              <LinkIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="font-semibold text-zinc-100">Shared Document</h1>
              <p className="text-xs text-zinc-500">via Smart Cloud DMS</p>
            </div>
          </div>
          <Link
            to="/"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Go to DMS
          </Link>
        </div>

        {/* Document info */}
        <div className="p-6">
          {linkInfo?.document && (
            <div className="mb-6 flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              {getFileIcon(linkInfo.document.mimeType)}
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-zinc-100 truncate">
                  {linkInfo.document.name}
                </p>
                <p className="text-sm text-zinc-500">
                  {linkInfo.document.mimeType} · {formatBytes(linkInfo.document.sizeBytes)}
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {fileData?.url && (
              <>
                <a
                  href={fileData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors shadow-md shadow-blue-900/30"
                >
                  <Eye className="h-4 w-4" />
                  View Document
                </a>

                {linkInfo?.actions?.includes("download") && (
                  <a
                    href={fileData.url}
                    download={fileData.name}
                    className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                )}
              </>
            )}
          </div>

          {/* Preview for images/PDFs */}
          {fileData?.url && fileData?.mimeType?.startsWith("image/") && (
            <div className="mt-6 rounded-xl border border-zinc-800 overflow-hidden">
              <img
                src={fileData.url}
                alt={fileData.name}
                className="max-h-[60vh] w-full object-contain bg-black"
              />
            </div>
          )}

          {fileData?.url && fileData?.mimeType === "application/pdf" && (
            <div className="mt-6 rounded-xl border border-zinc-800 overflow-hidden">
              <iframe
                title={fileData.name}
                src={fileData.url}
                className="h-[60vh] w-full bg-white"
              />
            </div>
          )}

          {/* View count info */}
          {fileData?.viewCount != null && (
            <p className="mt-4 text-xs text-zinc-600">
              This link has been accessed {fileData.viewCount} time
              {fileData.viewCount !== 1 ? "s" : ""}.
              {linkInfo?.maxViews && (
                <span> (Max: {linkInfo.maxViews})</span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareLinkAccess;
