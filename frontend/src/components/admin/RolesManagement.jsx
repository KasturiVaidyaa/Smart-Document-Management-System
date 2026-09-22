import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield,
  Lock,
  Plus,
  Search,
  Check,
  X,
  Trash2,
  Edit3,
  AlertTriangle,
  Grid,
  List,
  Users,
  Info,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../utils/api";
import { useWorkspace } from "../../context/WorkspaceContext";

export const RolesManagement = () => {
  const { currentWorkspaceId, current } = useWorkspace();

  const [roles, setRoles] = useState([]);
  const [permissionsData, setPermissionsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("matrix"); // "matrix" | "cards"

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState(null);
  const [roleToDelete, setRoleToDelete] = useState(null);

  // Form state (for create/edit)
  const [formName, setFormName] = useState("");
  const [formPermissions, setFormPermissions] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canManageRoles =
    current?.isOwner || current?.permissions?.includes("roles.manage");

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    if (!currentWorkspaceId) return;
    try {
      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/roles`
      );
      setRoles(data.roles || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load roles");
      toast.error(err?.response?.data?.message || "Failed to load roles");
    }
  }, [currentWorkspaceId]);

  // Fetch available permissions
  const fetchPermissions = useCallback(async () => {
    if (!currentWorkspaceId) return;
    try {
      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/roles/permissions`
      );
      setPermissionsData(data.permissions || []);
    } catch (err) {
      console.error("Failed to load permissions metadata:", err);
    }
  }, [currentWorkspaceId]);

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      await Promise.all([fetchRoles(), fetchPermissions()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchRoles, fetchPermissions]);

  // Group permissions by category
  const categorizedPermissions = useMemo(() => {
    const groups = {};
    for (const p of permissionsData) {
      const cat = p.category || "General";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    }
    return groups;
  }, [permissionsData]);

  // Filtered roles based on search
  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles;
    const q = searchQuery.toLowerCase().trim();
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.permissions?.some((p) => p.toLowerCase().includes(q))
    );
  }, [roles, searchQuery]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormName("");
    setFormPermissions(new Set(["dashboard.view"]));
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (role) => {
    if (role.isOwner || role.isSystem) return;
    setRoleToEdit(role);
    setFormName(role.name);
    setFormPermissions(new Set(role.permissions || []));
  };

  // Toggle permission in form
  const togglePermission = (permId) => {
    setFormPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      return next;
    });
  };

  // Select all / clear all in form
  const selectAllPermissions = () => {
    setFormPermissions(new Set(permissionsData.map((p) => p.id)));
  };

  const clearAllPermissions = () => {
    setFormPermissions(new Set());
  };

  // Submit Create Role
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Role name is required");
      return;
    }
    if (formPermissions.size === 0) {
      toast.error("Please select at least one permission");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/api/workspaces/${currentWorkspaceId}/roles`, {
        name: formName.trim(),
        permissions: Array.from(formPermissions),
      });
      toast.success(`Custom role "${formName.trim()}" created successfully`);
      setIsCreateOpen(false);
      await fetchRoles();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create role");
    } finally {
      setSaving(false);
    }
  };

  // Submit Edit Role
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!roleToEdit) return;
    if (!formName.trim()) {
      toast.error("Role name is required");
      return;
    }
    if (formPermissions.size === 0) {
      toast.error("Please select at least one permission");
      return;
    }

    setSaving(true);
    try {
      await api.patch(
        `/api/workspaces/${currentWorkspaceId}/roles/${roleToEdit._id}`,
        {
          name: formName.trim(),
          permissions: Array.from(formPermissions),
        }
      );
      toast.success(`Role "${formName.trim()}" updated successfully`);
      setRoleToEdit(null);
      await fetchRoles();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update role");
    } finally {
      setSaving(false);
    }
  };

  // Submit Delete Role
  const handleDeleteSubmit = async () => {
    if (!roleToDelete) return;
    setDeleting(true);
    try {
      await api.delete(
        `/api/workspaces/${currentWorkspaceId}/roles/${roleToDelete._id}`
      );
      toast.success(
        `Role "${roleToDelete.name}" deleted. Any members left with zero roles were reassigned to Employee.`
      );
      setRoleToDelete(null);
      await fetchRoles();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete role");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-400" />
            Roles & Permission Matrix
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Manage built-in system roles and configure custom roles with a tailored permission matrix.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900 p-1 text-xs">
            <button
              onClick={() => setViewMode("matrix")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
                viewMode === "matrix"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
              <span>Matrix View</span>
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
                viewMode === "cards"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Role Cards</span>
            </button>
          </div>

          {canManageRoles && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 shadow-sm shadow-blue-900/20 transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>New Custom Role</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search roles or permissions..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/90 pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-sm text-zinc-400">
          Loading workspace roles and permissions...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-6 text-center text-sm text-rose-400">
          {error}
        </div>
      ) : filteredRoles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
          <Shield className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
          <p className="text-sm font-medium text-zinc-300">No matching roles found.</p>
          <p className="text-xs text-zinc-500 mt-1">
            Try adjusting your search criteria or create a new custom role.
          </p>
        </div>
      ) : viewMode === "matrix" ? (
        /* ------------------ PERMISSION MATRIX VIEW ------------------ */
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400">
                  <th className="py-3 px-4 min-w-[240px] font-semibold sticky left-0 bg-zinc-950/90 backdrop-blur-sm z-10 border-r border-zinc-800/80">
                    Permissions / Actions
                  </th>
                  {filteredRoles.map((role) => (
                    <th
                      key={role._id}
                      className="py-3 px-4 min-w-[140px] font-semibold text-center"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1 font-semibold text-zinc-200">
                          {role.isSystem ? (
                            <Lock className="h-3 w-3 text-zinc-500" />
                          ) : (
                            <Shield className="h-3 w-3 text-indigo-400" />
                          )}
                          <span>{role.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium border ${
                              role.isOwner
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : role.isSystem
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            }`}
                          >
                            {role.isOwner
                              ? "Owner"
                              : role.isSystem
                              ? "System"
                              : "Custom"}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {role.memberCount} {role.memberCount === 1 ? "mbr" : "mbrs"}
                          </span>
                        </div>
                        {!role.isSystem && canManageRoles && (
                          <div className="flex items-center gap-1 mt-1">
                            <button
                              onClick={() => handleOpenEdit(role)}
                              title="Edit Role"
                              className="rounded p-1 text-zinc-400 hover:text-indigo-300 hover:bg-zinc-800 transition-colors"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setRoleToDelete(role)}
                              title="Delete Role"
                              className="rounded p-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {Object.entries(categorizedPermissions).map(
                  ([category, perms]) => (
                    <React.Fragment key={category}>
                      {/* Category Header Row */}
                      <tr className="bg-zinc-950/40">
                        <td
                          colSpan={filteredRoles.length + 1}
                          className="py-2 px-4 text-[10px] font-bold uppercase tracking-wider text-blue-400 border-b border-zinc-800/60"
                        >
                          {category}
                        </td>
                      </tr>
                      {/* Permission Rows */}
                      {perms.map((p) => (
                        <tr
                          key={p.id}
                          className="hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-2.5 px-4 sticky left-0 bg-zinc-900/90 backdrop-blur-sm z-10 border-r border-zinc-800/80">
                            <div>
                              <p className="font-medium text-zinc-200">
                                {p.label}
                              </p>
                              <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">
                                {p.description}
                              </p>
                              <code className="text-[9px] font-mono text-zinc-500">
                                {p.id}
                              </code>
                            </div>
                          </td>
                          {filteredRoles.map((role) => {
                            const hasPerm =
                              role.isOwner ||
                              role.permissions?.includes(p.id);

                            return (
                              <td
                                key={role._id}
                                className="py-2.5 px-4 text-center"
                              >
                                <div className="flex justify-center">
                                  {hasPerm ? (
                                    <div
                                      className={`rounded-full p-1 ${
                                        role.isOwner
                                          ? "bg-amber-500/15 text-amber-400"
                                          : role.isSystem
                                          ? "bg-emerald-500/15 text-emerald-400"
                                          : "bg-indigo-500/15 text-indigo-400"
                                      }`}
                                      title={`Granted to ${role.name}`}
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </div>
                                  ) : (
                                    <div
                                      className="rounded-full p-1 bg-zinc-800/40 text-zinc-600"
                                      title={`Not granted to ${role.name}`}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ------------------ ROLE CARDS VIEW ------------------ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoles.map((role) => (
            <div
              key={role._id}
              className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm hover:border-zinc-700 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-1.5">
                      {role.isSystem ? (
                        <Lock className="h-4 w-4 text-zinc-500" />
                      ) : (
                        <Shield className="h-4 w-4 text-indigo-400" />
                      )}
                      <span>{role.name}</span>
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                          role.isOwner
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : role.isSystem
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        }`}
                      >
                        {role.isOwner
                          ? "Workspace Owner"
                          : role.isSystem
                          ? "System Role"
                          : "Custom Role"}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-zinc-400">
                        <Users className="h-3 w-3 text-zinc-500" />
                        {role.memberCount} active {role.memberCount === 1 ? "member" : "members"}
                      </span>
                    </div>
                  </div>

                  {!role.isSystem && canManageRoles && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(role)}
                        title="Edit Custom Role"
                        className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setRoleToDelete(role)}
                        title="Delete Custom Role"
                        className="rounded-lg p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/80">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                    <span className="font-medium">Permissions Granted</span>
                    <span className="text-zinc-500">
                      {role.isOwner
                        ? "All Permissions"
                        : `${role.permissions?.length || 0} permissions`}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                    {role.isOwner ? (
                      <span className="rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px]">
                        Full Workspace Authority (Root)
                      </span>
                    ) : (role.permissions || []).length === 0 ? (
                      <span className="text-[10px] text-zinc-500 italic">
                        No permissions assigned
                      </span>
                    ) : (
                      role.permissions.map((p) => {
                        const meta = permissionsData.find((pm) => pm.id === p);
                        return (
                          <span
                            key={p}
                            title={meta?.description || p}
                            className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 border border-zinc-700/60"
                          >
                            {meta?.label || p}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-500 flex items-center justify-between">
                <span>
                  {role.isSystem
                    ? "Built-in System Baseline (Immutable)"
                    : "Configurable Workspace Role"}
                </span>
                {role.isSystem && <Lock className="h-3 w-3 text-zinc-600" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ----------------- CREATE / EDIT CUSTOM ROLE MODAL ----------------- */}
      {(isCreateOpen || Boolean(roleToEdit)) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-full bg-blue-500/10 p-2 text-blue-400">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">
                    {roleToEdit ? "Edit Custom Role" : "Create Custom Role"}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Configure role name and customize the granted permission matrix.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setRoleToEdit(null);
                }}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form
              onSubmit={roleToEdit ? handleEditSubmit : handleCreateSubmit}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Role Name */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Role Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Document Auditor, Project Lead"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Reserved names (Owner, Admin, Manager, Employee) cannot be used.
                  </p>
                </div>

                {/* Permissions Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-zinc-300">
                      Permissions Checklist <span className="text-rose-400">*</span>
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={selectAllPermissions}
                        className="text-blue-400 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-zinc-600">·</span>
                      <button
                        type="button"
                        onClick={clearAllPermissions}
                        className="text-zinc-400 hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 max-h-72 overflow-y-auto">
                    {Object.entries(categorizedPermissions).map(
                      ([category, perms]) => (
                        <div key={category} className="space-y-2">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-400 border-b border-zinc-800/80 pb-1">
                            {category}
                          </h4>
                          <div className="grid grid-cols-1 gap-2">
                            {perms.map((p) => {
                              const isChecked = formPermissions.has(p.id);
                              return (
                                <label
                                  key={p.id}
                                  className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                                    isChecked
                                      ? "border-blue-500/40 bg-blue-500/10"
                                      : "border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-800/40"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => togglePermission(p.id)}
                                    className="hidden"
                                  />
                                  <div className="mt-0.5 text-blue-400">
                                    {isChecked ? (
                                      <CheckSquare className="h-4 w-4" />
                                    ) : (
                                      <Square className="h-4 w-4 text-zinc-600" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-xs font-medium text-zinc-200">
                                        {p.label}
                                      </span>
                                      <code className="text-[9px] font-mono text-zinc-500">
                                        {p.id}
                                      </code>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 mt-0.5">
                                      {p.description}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-6 py-3 bg-zinc-950/40">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setRoleToEdit(null);
                  }}
                  className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {saving
                    ? "Saving..."
                    : roleToEdit
                    ? "Update Role"
                    : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- DELETE CUSTOM ROLE MODAL ----------------- */}
      {roleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-3 text-rose-400 font-semibold">
              <div className="rounded-full bg-rose-500/10 p-2 text-rose-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-base text-zinc-100">Delete Custom Role</h3>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-zinc-300 leading-relaxed">
                Are you sure you want to delete custom role{" "}
                <strong className="text-white">"{roleToDelete.name}"</strong>?
              </p>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Automatic Member Cleanup & Fallback:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-200/90 pl-1">
                  <li>
                    Role references will be safely removed from all {roleToDelete.memberCount} members in this workspace.
                  </li>
                  <li>
                    Any member left with zero roles will automatically receive the workspace's default <strong>Employee</strong> role.
                  </li>
                  <li>
                    Members with other assigned roles will simply retain their remaining roles.
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setRoleToDelete(null)}
                className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteSubmit}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting..." : "Delete Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
