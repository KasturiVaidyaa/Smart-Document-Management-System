import React, { useState, useEffect, useCallback } from "react";
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Sparkles,
  FileText,
  Info,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../utils/api";
import { useWorkspace } from "../../context/WorkspaceContext";

export const CategoriesManagement = () => {
  const { currentWorkspaceId, current } = useWorkspace();

  const [categories, setCategories] = useState([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals & form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [submittingAdd, setSubmittingAdd] = useState(false);

  const [renameTarget, setRenameTarget] = useState(null);
  const [renamedName, setRenamedName] = useState("");
  const [submittingRename, setSubmittingRename] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [submittingReset, setSubmittingReset] = useState(false);

  // Authorization check based on existing RBAC
  const canManageCategories =
    Boolean(current?.isOwner) ||
    Boolean(current?.permissions?.includes("roles.manage"));

  const loadCategories = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/categories`
      );
      setCategories(data.categories || []);
      setUnassignedCount(data.unassignedCount || 0);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Handle Add Category
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!canManageCategories || !newCategoryName.trim()) return;

    setSubmittingAdd(true);
    try {
      await api.post(`/api/workspaces/${currentWorkspaceId}/categories`, {
        name: newCategoryName.trim(),
      });
      toast.success(`Category "${newCategoryName.trim()}" created successfully`);
      setNewCategoryName("");
      setShowAddModal(false);
      await loadCategories();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create category");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Handle Rename Category
  const handleRenameCategory = async (e) => {
    e.preventDefault();
    if (!canManageCategories || !renameTarget || !renamedName.trim()) return;

    setSubmittingRename(true);
    try {
      const { data } = await api.patch(
        `/api/workspaces/${currentWorkspaceId}/categories/${encodeURIComponent(
          renameTarget.name
        )}`,
        { newName: renamedName.trim() }
      );
      const affected = data.affectedDocuments || 0;
      toast.success(
        `Category renamed to "${renamedName.trim()}". ${affected} document${
          affected === 1 ? "" : "s"
        } updated.`
      );
      setRenameTarget(null);
      setRenamedName("");
      await loadCategories();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to rename category");
    } finally {
      setSubmittingRename(false);
    }
  };

  // Handle Delete Category
  const handleDeleteCategory = async () => {
    if (!canManageCategories || !deleteTarget) return;

    setSubmittingDelete(true);
    try {
      const { data } = await api.delete(
        `/api/workspaces/${currentWorkspaceId}/categories/${encodeURIComponent(
          deleteTarget.name
        )}`
      );
      const affected = data.affectedDocuments || 0;
      toast.success(
        `Category "${deleteTarget.name}" deleted. ${affected} document${
          affected === 1 ? "" : "s"
        } unassigned.`
      );
      setDeleteTarget(null);
      await loadCategories();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete category");
    } finally {
      setSubmittingDelete(false);
    }
  };

  // Handle Reset to Defaults
  const handleResetDefaults = async () => {
    if (!canManageCategories) return;

    setSubmittingReset(true);
    try {
      const { data } = await api.post(
        `/api/workspaces/${currentWorkspaceId}/categories/reset`
      );
      const affected = data.affectedDocuments || 0;
      toast.success(
        `Categories reset to default taxonomy. ${affected} non-default document${
          affected === 1 ? "" : "s"
        } unassigned.`
      );
      setShowResetModal(false);
      await loadCategories();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to reset categories");
    } finally {
      setSubmittingReset(false);
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Tag className="h-5 w-5 text-blue-400" />
            AI Document Categories Taxonomy
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Configure the classification taxonomy used for automated AI categorizing, document
            tagging, and search filters.
          </p>
        </div>

        {canManageCategories && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResetModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition"
              title="Reset taxonomy back to system standard default categories"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Defaults</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-sm transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Category</span>
            </button>
          </div>
        )}
      </div>

      {/* RBAC Read-Only Banner */}
      {!canManageCategories && (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 text-xs text-zinc-400">
          <Lock className="h-4 w-4 text-amber-400 shrink-0" />
          <span>
            You are viewing categories in read-only mode. Modifying the workspace taxonomy requires the{" "}
            <code className="text-amber-300 font-mono">roles.manage</code> permission or Workspace Owner
            role.
          </span>
        </div>
      )}

      {/* Quick Summary & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="rounded-full bg-zinc-800/90 border border-zinc-700/60 px-2.5 py-1 font-mono text-zinc-300">
            {categories.length} Categories
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-zinc-500" />
            <strong className="text-zinc-200 font-mono">{unassignedCount}</strong> unassigned docs
          </span>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter categories..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Categories Grid */}
      {loading ? (
        <div className="text-center p-12 text-sm text-zinc-400">Loading categories...</div>
      ) : filteredCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
          <Tag className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-2 text-sm text-zinc-400">No categories found matching your query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredCategories.map((cat) => (
            <div
              key={cat.name}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3 hover:border-zinc-700 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400 border border-blue-500/20">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100">{cat.name}</h4>
                    {cat.isDefault && (
                      <span className="text-[10px] text-zinc-500 font-medium">System Standard</span>
                    )}
                  </div>
                </div>

                <span className="rounded-full bg-zinc-800/80 border border-zinc-700/60 px-2.5 py-0.5 text-xs font-mono text-zinc-300">
                  {cat.documentCount} {cat.documentCount === 1 ? "doc" : "docs"}
                </span>
              </div>

              {canManageCategories && (
                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-zinc-800/60">
                  <button
                    onClick={() => {
                      setRenameTarget(cat);
                      setRenamedName(cat.name);
                    }}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
                    title="Rename category and update references"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Rename</span>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(cat)}
                    disabled={categories.length <= 1}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition disabled:opacity-30 disabled:hover:bg-transparent"
                    title={
                      categories.length <= 1
                        ? "A workspace must have at least one category"
                        : "Delete category"
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-400" />
                Add Category
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Marketing, Compliance, Operations"
                  maxLength={30}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  2 to 30 characters. Letters, numbers, and basic symbols.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd || !newCategoryName.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50"
                >
                  {submittingAdd ? "Creating..." : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Category Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-blue-400" />
                Rename Category
              </h3>
              <button
                onClick={() => setRenameTarget(null)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRenameCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  New Name for "{renameTarget.name}"
                </label>
                <input
                  type="text"
                  required
                  value={renamedName}
                  onChange={(e) => setRenamedName(e.target.value)}
                  maxLength={30}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-300 flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  All documents currently categorized as <strong>"{renameTarget.name}"</strong> in this
                  workspace will automatically be updated to <strong>"{renamedName.trim() || "..."}"</strong>.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRename || !renamedName.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50"
                >
                  {submittingRename ? "Renaming..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Delete Category
              </h3>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to delete category <strong>"{deleteTarget.name}"</strong>?
            </p>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {deleteTarget.documentCount} document{deleteTarget.documentCount === 1 ? "" : "s"}{" "}
                tagged with this category will become <strong>Unassigned</strong>. The files themselves will
                not be deleted.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
                disabled={submittingDelete}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition disabled:opacity-50"
              >
                {submittingDelete ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-amber-400" />
                Reset Category Taxonomy
              </h3>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              This will restore the standard workspace categories:{" "}
              <code className="text-blue-300 font-mono">HR, Finance, Projects, Legal, General</code>.
            </p>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Any custom categories will be removed, and documents assigned to non-standard categories
                will have their category set to <strong>null</strong>.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={submittingReset}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition disabled:opacity-50"
              >
                {submittingReset ? "Resetting..." : "Reset to Defaults"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
