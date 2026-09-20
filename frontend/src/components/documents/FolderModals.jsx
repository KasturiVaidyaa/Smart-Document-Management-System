import React, { useState, useEffect } from "react";
import { Folder, X, AlertTriangle, CornerDownRight } from "lucide-react";

export const CreateFolderModal = ({
  isOpen,
  onClose,
  onSubmit,
  folders = [],
  initialParentId = null,
}) => {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState(initialParentId || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName("");
    setParentId(initialParentId || "");
  }, [isOpen, initialParentId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), parentId: parentId || null });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-100 font-semibold">
            <Folder className="h-5 w-5 text-blue-400" />
            <h3>Create New Folder</h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white rounded-lg p-1 hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Folder Name
            </label>
            <input
              autoFocus
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Invoices, Contracts, Design Assets"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Parent Folder (Optional)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Root (No Parent)</option>
              {folders.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.path || f.name}
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
              disabled={loading || !name.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Folder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const RenameFolderModal = ({ isOpen, onClose, folder, onSubmit }) => {
  const [name, setName] = useState(folder?.name || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(folder?.name || "");
  }, [folder]);

  if (!isOpen || !folder) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit(folder._id, name.trim());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-100 font-semibold">
            <Folder className="h-5 w-5 text-blue-400" />
            <h3>Rename Folder</h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white rounded-lg p-1 hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Folder Name
            </label>
            <input
              autoFocus
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
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
              disabled={loading || !name.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Renaming..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const DeleteFolderModal = ({ isOpen, onClose, folder, onConfirm }) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !folder) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(folder._id);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-800 text-rose-400 font-semibold">
          <div className="rounded-full bg-rose-500/10 p-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
          </div>
          <h3>Delete Folder</h3>
        </div>

        <div className="mt-4 space-y-3">
          <p className="text-sm text-zinc-300">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-white">"{folder.name}"</span>?
          </p>
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            Any subfolders will also be deleted. Active documents inside this folder
            hierarchy will safely be moved to <span className="font-semibold">Trash</span>.
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {loading ? "Deleting..." : "Delete Folder"}
          </button>
        </div>
      </div>
    </div>
  );
};

export const MoveDocumentModal = ({
  isOpen,
  onClose,
  documents = [], // array of document objects or IDs
  folders = [],
  onConfirm,
}) => {
  const [targetFolderId, setTargetFolderId] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen || documents.length === 0) return null;

  const count = documents.length;
  const title =
    count === 1
      ? `Move "${documents[0].name || 'Document'}"`
      : `Move ${count} Documents`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(targetFolderId || null);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-100 font-semibold">
            <CornerDownRight className="h-5 w-5 text-blue-400" />
            <h3 className="truncate">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white rounded-lg p-1 hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Select Destination Folder
            </label>
            <select
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Root Directory</option>
              {folders.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.path || f.name}
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
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Moving..." : "Move Here"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
