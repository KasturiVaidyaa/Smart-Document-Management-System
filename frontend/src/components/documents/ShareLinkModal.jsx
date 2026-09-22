import { useEffect, useState } from "react";
import { X, Link2, Copy, Trash2, Eye, Download, Lock, Clock, CheckCircle } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../utils/api";

export const ShareLinkModal = ({ isOpen, onClose, document, workspaceId }) => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(null);

  // Create form state
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxViews, setMaxViews] = useState("");
  const [selectedActions, setSelectedActions] = useState(["view"]);

  useEffect(() => {
    if (isOpen && document && workspaceId) {
      loadLinks();
    }
  }, [isOpen, document?._id, workspaceId]);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/api/workspaces/${workspaceId}/documents/${document._id}/links`
      );
      setLinks(data.links || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load share links");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await api.post(
        `/api/workspaces/${workspaceId}/documents/${document._id}/links`,
        {
          password: password.trim() || undefined,
          expiresAt: expiresAt || undefined,
          maxViews: maxViews ? Number(maxViews) : undefined,
          actions: selectedActions,
        }
      );
      toast.success("Share link created");

      // Copy to clipboard automatically
      if (data.shareUrl) {
        await navigator.clipboard.writeText(data.shareUrl);
        toast.info("Link copied to clipboard!");
      }

      setPassword("");
      setExpiresAt("");
      setMaxViews("");
      setSelectedActions(["view"]);
      await loadLinks();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to create share link");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (linkId) => {
    try {
      await api.delete(`/api/workspaces/${workspaceId}/links/${linkId}`);
      toast.success("Share link revoked");
      await loadLinks();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to revoke link");
    }
  };

  const copyShareUrl = async (linkId) => {
    // We can't reconstruct the token from the link data (it's hashed), 
    // so we inform the user the link was copied at creation time.
    toast.info("Share link URL was provided at creation time. Please copy it when creating a new link.");
    setCopied(linkId);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleAction = (action) => {
    setSelectedActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-500/10 p-2">
              <Link2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-100">Share Links</h3>
              <p className="text-xs text-zinc-400 truncate max-w-[300px]">
                {document?.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Create Link Form */}
          <form
            onSubmit={handleCreate}
            className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
          >
            <h4 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-emerald-400" />
              Generate new link
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Password */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Password (optional)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty for no password"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
                />
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Expires at
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              {/* Max Views */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1">
                  <Eye className="h-3 w-3" /> Max views (optional)
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxViews}
                  onChange={(e) => setMaxViews(e.target.value)}
                  placeholder="Unlimited"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
                />
              </div>

              {/* Actions */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Actions</label>
                <div className="flex gap-2">
                  {["view", "download"].map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => toggleAction(action)}
                      className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                        selectedActions.includes(action)
                          ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-300"
                          : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {action === "view" ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60 transition-colors"
            >
              {creating ? "Creating..." : "Create & Copy Link"}
            </button>
          </form>

          {/* Active Links */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-200 mb-3">
              Active links ({links.filter((l) => !l.isExpired && !l.isMaxViewsReached).length})
            </h4>
            {loading ? (
              <p className="text-xs text-zinc-500">Loading...</p>
            ) : links.length === 0 ? (
              <p className="text-xs text-zinc-500 bg-zinc-950/30 rounded-lg p-3 border border-zinc-800">
                No share links for this document yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {links.map((link) => {
                  const isDisabled = link.isExpired || link.isMaxViewsReached;

                  return (
                    <li
                      key={link._id}
                      className={`rounded-lg border px-4 py-3 ${
                        isDisabled
                          ? "border-zinc-800/40 bg-zinc-950/10 opacity-60"
                          : "border-zinc-800 bg-zinc-950/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          {link.actions?.map((a) => (
                            <span
                              key={a}
                              className="rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-500/20"
                            >
                              {a}
                            </span>
                          ))}

                          {link.hasPassword && (
                            <span className="flex items-center gap-0.5 rounded-full bg-amber-600/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/20">
                              <Lock className="h-2.5 w-2.5" />
                              Protected
                            </span>
                          )}

                          {link.isExpired && (
                            <span className="rounded-full bg-rose-600/15 px-2 py-0.5 text-[10px] font-medium text-rose-300 border border-rose-500/20">
                              Expired
                            </span>
                          )}

                          {link.isMaxViewsReached && (
                            <span className="rounded-full bg-rose-600/15 px-2 py-0.5 text-[10px] font-medium text-rose-300 border border-rose-500/20">
                              Max views reached
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleRevoke(link._id)}
                          className="rounded-md p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors shrink-0"
                          title="Revoke link"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
                        <span>
                          Views: {link.viewCount || 0}
                          {link.maxViews ? ` / ${link.maxViews}` : ""}
                        </span>
                        {link.expiresAt && (
                          <span>
                            Expires: {new Date(link.expiresAt).toLocaleString()}
                          </span>
                        )}
                        <span>
                          Created: {new Date(link.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
