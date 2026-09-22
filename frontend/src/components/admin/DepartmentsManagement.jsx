import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Building2,
  Plus,
  Trash2,
  Edit3,
  Search,
  Users,
  AlertTriangle,
  X,
  RefreshCw,
  UserCheck,
  CornerDownRight,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../utils/api";
import { useWorkspace } from "../../context/WorkspaceContext";

export const DepartmentsManagement = () => {
  const { currentWorkspaceId, current } = useWorkspace();

  const [departments, setDepartments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptToDelete, setDeptToDelete] = useState(null);
  const [managingMembersDept, setManagingMembersDept] = useState(null);

  // Create Form State
  const [createName, setCreateName] = useState("");
  const [createParentId, setCreateParentId] = useState("");
  const [createManagerId, setCreateManagerId] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit Form State
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState("");
  const [editManagerId, setEditManagerId] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Member Assignment State
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState("");
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Delete State
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Permission check
  const canManageDepts =
    current?.isOwner || current?.permissions?.includes("departments.manage");

  // Fetch departments
  const fetchDepartments = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/departments`
      );
      setDepartments(data.departments || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load departments");
      toast.error(err?.response?.data?.message || "Failed to load departments");
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId]);

  // Fetch active members for manager selection and assignment
  const fetchMembers = useCallback(async () => {
    if (!currentWorkspaceId) return;
    try {
      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/members?status=active`
      );
      setMembers(data.members || []);
    } catch {
      // Non-critical, member dropdown will simply be empty
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    fetchDepartments();
    fetchMembers();
  }, [fetchDepartments, fetchMembers]);

  // Filtered departments
  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) return departments;
    const q = searchQuery.toLowerCase().trim();
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.manager?.name?.toLowerCase().includes(q) ||
        d.parentId?.name?.toLowerCase().includes(q)
    );
  }, [departments, searchQuery]);

  // Handle Create
  const handleOpenCreate = () => {
    setCreateName("");
    setCreateParentId("");
    setCreateManagerId("");
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createName.trim()) {
      toast.error("Department name is required");
      return;
    }

    setCreateSubmitting(true);
    try {
      const { data } = await api.post(
        `/api/workspaces/${currentWorkspaceId}/departments`,
        {
          name: createName.trim(),
          parentId: createParentId || undefined,
          managerId: createManagerId || undefined,
        }
      );
      toast.success(data.message || "Department created successfully");
      setIsCreateOpen(false);
      await fetchDepartments();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create department");
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Handle Edit
  const handleOpenEdit = (dept) => {
    setEditingDept(dept);
    setEditName(dept.name);
    setEditParentId(dept.parentId?._id || "");
    setEditManagerId(dept.manager?._id || "");
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingDept || !editName.trim()) return;

    setEditSubmitting(true);
    try {
      const payload = {
        name: editName.trim(),
        parentId: editParentId || null,
        managerId: editManagerId || null,
      };

      const { data } = await api.patch(
        `/api/workspaces/${currentWorkspaceId}/departments/${editingDept._id}`,
        payload
      );
      toast.success(data.message || "Department updated successfully");
      setEditingDept(null);
      await fetchDepartments();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update department");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Delete
  const handleDeleteSubmit = async () => {
    if (!deptToDelete) return;

    setDeleteSubmitting(true);
    try {
      const { data } = await api.delete(
        `/api/workspaces/${currentWorkspaceId}/departments/${deptToDelete._id}`
      );
      toast.success(data.message || "Department deleted successfully");
      setDeptToDelete(null);
      await fetchDepartments();
      await fetchMembers();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete department");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Members currently assigned to the selected department
  const assignedMembers = useMemo(() => {
    if (!managingMembersDept) return [];
    return members.filter((m) =>
      (m.departments || []).some(
        (d) => String(d._id) === String(managingMembersDept._id)
      )
    );
  }, [managingMembersDept, members]);

  // Members not yet assigned to the selected department
  const unassignedMembers = useMemo(() => {
    if (!managingMembersDept) return [];
    return members.filter(
      (m) =>
        !(m.departments || []).some(
          (d) => String(d._id) === String(managingMembersDept._id)
        )
    );
  }, [managingMembersDept, members]);

  // Assign Member
  const handleAddMemberToDept = async () => {
    if (!selectedMemberToAdd || !managingMembersDept) return;

    setAssignSubmitting(true);
    try {
      await api.post(
        `/api/workspaces/${currentWorkspaceId}/departments/${managingMembersDept._id}/members`,
        { memberIds: [selectedMemberToAdd] }
      );
      toast.success("Member assigned to department");
      setSelectedMemberToAdd("");
      await fetchMembers();
      await fetchDepartments();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to assign member");
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Remove Member from Department
  const handleRemoveMemberFromDept = async (memberId) => {
    if (!managingMembersDept) return;

    try {
      await api.delete(
        `/api/workspaces/${currentWorkspaceId}/departments/${managingMembersDept._id}/members/${memberId}`
      );
      toast.success("Member removed from department");
      await fetchMembers();
      await fetchDepartments();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to remove member");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            Departments
          </h2>
          <p className="text-sm text-zinc-400">
            Organize members into functional departments and designate team managers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchDepartments();
              fetchMembers();
            }}
            title="Refresh departments"
            className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {canManageDepts && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-500 shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Department
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search departments..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Main Content */}
      {loading && departments.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-12 text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-400" />
          <p className="mt-3 text-sm text-zinc-400">Loading departments...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-400" />
          <p className="mt-2 text-sm font-medium text-rose-300">{error}</p>
          <button
            onClick={fetchDepartments}
            className="mt-3 inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-zinc-600" />
          <h3 className="mt-3 text-base font-semibold text-zinc-200">
            No departments found
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            {searchQuery
              ? "No departments match your search."
              : "Get started by creating your first organizational department."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/90 text-xs font-semibold uppercase text-zinc-400">
                <tr>
                  <th className="px-5 py-3">Department Name</th>
                  <th className="px-4 py-3">Parent Department</th>
                  <th className="px-4 py-3">Manager</th>
                  <th className="px-4 py-3">Active Members</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {filteredDepartments.map((d) => (
                  <tr
                    key={d._id}
                    className="hover:bg-zinc-800/40 transition-colors"
                  >
                    {/* Department Name */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5 font-medium text-zinc-100">
                        <div className="rounded-lg bg-blue-500/10 p-1.5 text-blue-400">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <span>{d.name}</span>
                      </div>
                    </td>

                    {/* Parent Department */}
                    <td className="px-4 py-3.5">
                      {d.parentId ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 border border-zinc-700">
                          <CornerDownRight className="h-3 w-3 text-zinc-500" />
                          {d.parentId.name}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500 italic">Root</span>
                      )}
                    </td>

                    {/* Manager */}
                    <td className="px-4 py-3.5">
                      {d.manager ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 text-[10px] font-semibold">
                            {d.manager.name
                              ? d.manager.name[0].toUpperCase()
                              : "U"}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-zinc-200 block truncate">
                              {d.manager.name}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500">Unassigned</span>
                      )}
                    </td>

                    {/* Member Count */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setManagingMembersDept(d)}
                        title="View and assign members"
                        className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700 transition-colors"
                      >
                        <Users className="h-3.5 w-3.5 text-blue-400" />
                        <span>{d.memberCount} members</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setManagingMembersDept(d)}
                          title="Manage Department Members"
                          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                        >
                          <UserCheck className="h-4 w-4" />
                        </button>
                        {canManageDepts && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(d)}
                              title="Edit Department"
                              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeptToDelete(d)}
                              title="Delete Department"
                              className="rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------- CREATE DEPARTMENT MODAL ----------------- */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-full bg-blue-500/10 p-2 text-blue-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">
                    Create Department
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Define a department and set an optional parent and manager.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Department Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Engineering, Human Resources, Finance"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Parent Department */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Parent Department (Optional)
                </label>
                <select
                  value={createParentId}
                  onChange={(e) => setCreateParentId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">None (Top-Level / Root)</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Manager */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Department Manager (Optional)
                </label>
                <select
                  value={createManagerId}
                  onChange={(e) => setCreateManagerId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {members
                    .filter((m) => m.status === "active")
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {createSubmitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Department"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- EDIT DEPARTMENT MODAL ----------------- */}
      {editingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-full bg-blue-500/10 p-2 text-blue-400">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">
                    Edit Department
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Modify department settings and hierarchy.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingDept(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Department Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Parent Department */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Parent Department
                </label>
                <select
                  value={editParentId}
                  onChange={(e) => setEditParentId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">None (Top-Level / Root)</option>
                  {departments
                    .filter((d) => d._id !== editingDept._id)
                    .map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Manager */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Department Manager
                </label>
                <select
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {members
                    .filter((m) => m.status === "active")
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingDept(null)}
                  className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {editSubmitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MANAGE MEMBERS MODAL ----------------- */}
      {managingMembersDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-full bg-blue-500/10 p-2 text-blue-400">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">
                    {managingMembersDept.name} Members
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Assign or remove workspace members from this department.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingMembersDept(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Add member to department */}
            {canManageDepts && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
                <label className="block text-xs font-medium text-zinc-300">
                  Assign a Member
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedMemberToAdd}
                    onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select an unassigned member...</option>
                    {unassignedMembers.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedMemberToAdd || assignSubmitting}
                    onClick={handleAddMemberToDept}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {assignSubmitting ? "Adding..." : "Assign"}
                  </button>
                </div>
              </div>
            )}

            {/* Current members list */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Currently Assigned ({assignedMembers.length})
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-2">
                {assignedMembers.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-4 italic">
                    No members assigned to this department yet.
                  </p>
                ) : (
                  assignedMembers.map((m) => (
                    <div
                      key={m._id}
                      className="flex items-center justify-between rounded-lg p-2 hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 text-xs font-semibold">
                          {m.name ? m.name[0].toUpperCase() : "U"}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-zinc-200">
                            {m.name}
                          </p>
                          <p className="text-[11px] text-zinc-400">{m.email}</p>
                        </div>
                      </div>
                      {canManageDepts && (
                        <button
                          onClick={() => handleRemoveMemberFromDept(m._id)}
                          title="Remove from Department"
                          className="rounded-md p-1 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setManagingMembersDept(null)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- DELETE DEPARTMENT MODAL ----------------- */}
      {deptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="rounded-full bg-rose-500/10 p-2.5">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">
                  Delete Department
                </h3>
                <p className="text-xs text-zinc-400">
                  Permanent removal and cascade reparenting.
                </p>
              </div>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">
              Are you sure you want to delete the department{" "}
              <strong className="text-white">{deptToDelete.name}</strong>?
            </p>
            <ul className="text-xs text-zinc-400 space-y-1 list-disc list-inside bg-zinc-950/60 p-3 rounded-lg border border-zinc-800">
              <li>All workspace members will be unassigned from this department.</li>
              <li>Any sub-departments will be reparented to its parent department.</li>
            </ul>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setDeptToDelete(null)}
                className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleDeleteSubmit}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {deleteSubmitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Confirm Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
