import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Edit3,
  Search,
  Crown,
  Shield,
  Building2,
  AlertTriangle,
  X,
  Check,
  RefreshCw,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../utils/api";
import { useWorkspace } from "../../context/WorkspaceContext";

export const MembersManagement = () => {
  const { currentWorkspaceId, current } = useWorkspace();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberToRemove, setMemberToRemove] = useState(null);

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleIds, setInviteRoleIds] = useState([]);
  const [inviteDeptIds, setInviteDeptIds] = useState([]);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  // Edit Form State
  const [editRoleIds, setEditRoleIds] = useState([]);
  const [editDeptIds, setEditDeptIds] = useState([]);
  const [editStatus, setEditStatus] = useState("active");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Remove State
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  // Permission capabilities of current user
  const canInvite =
    current?.isOwner || current?.permissions?.includes("members.invite");
  const canManageRoles =
    current?.isOwner || current?.permissions?.includes("roles.manage");
  const canManageDepts =
    current?.isOwner || current?.permissions?.includes("departments.manage");

  // Fetch all members
  const fetchMembers = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/members?status=all`
      );
      setMembers(data.members || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load members");
      toast.error(err?.response?.data?.message || "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId]);

  // Fetch workspace roles
  const [workspaceRoles, setWorkspaceRoles] = useState([]);
  const fetchRoles = useCallback(async () => {
    if (!currentWorkspaceId) return;
    try {
      const { data } = await api.get(
        `/api/workspaces/${currentWorkspaceId}/roles`
      );
      setWorkspaceRoles(data.roles || []);
    } catch (err) {
      console.error("Failed to load workspace roles:", err);
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    fetchMembers();
    fetchRoles();
  }, [fetchMembers, fetchRoles]);

  // Extract all unique roles and departments across members
  const availableRoles = useMemo(() => {
    if (workspaceRoles && workspaceRoles.length > 0) {
      return workspaceRoles;
    }
    const map = new Map();
    for (const m of members) {
      for (const r of m.roles || []) {
        if (!map.has(String(r._id))) {
          map.set(String(r._id), r);
        }
      }
    }
    return Array.from(map.values());
  }, [workspaceRoles, members]);

  const availableDepts = useMemo(() => {
    const map = new Map();
    for (const m of members) {
      for (const d of m.departments || []) {
        if (!map.has(String(d._id))) {
          map.set(String(d._id), d);
        }
      }
    }
    return Array.from(map.values());
  }, [members]);

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Status filter
      if (statusFilter !== "all" && m.status !== statusFilter) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = m.name?.toLowerCase().includes(q);
        const matchesEmail = m.email?.toLowerCase().includes(q);
        return matchesName || matchesEmail;
      }
      return true;
    });
  }, [members, statusFilter, searchQuery]);

  // Open Invite Modal
  const handleOpenInvite = () => {
    setInviteEmail("");
    // Default to Employee role if available (non-owner)
    const employeeRole = availableRoles.find(
      (r) => r.name === "Employee" && !r.isOwner
    );
    setInviteRoleIds(employeeRole ? [employeeRole._id] : []);
    setInviteDeptIds([]);
    setIsInviteOpen(true);
  };

  // Submit Invite
  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setInviteSubmitting(true);
    try {
      const { data } = await api.post(
        `/api/workspaces/${currentWorkspaceId}/members`,
        {
          email: inviteEmail.trim(),
          roleIds: inviteRoleIds,
          departmentIds: inviteDeptIds,
        }
      );
      toast.success(data.message || "Member added successfully");
      setIsInviteOpen(false);
      await fetchMembers();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to add member");
    } finally {
      setInviteSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (member) => {
    setEditingMember(member);
    setEditRoleIds((member.roles || []).map((r) => r._id));
    setEditDeptIds((member.departments || []).map((d) => d._id));
    setEditStatus(member.status || "active");
  };

  // Submit Edit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingMember) return;

    setEditSubmitting(true);
    try {
      const payload = {};
      if (canManageRoles && !editingMember.isOwner) {
        payload.roleIds = editRoleIds;
        payload.status = editStatus;
      }
      if (canManageDepts) {
        payload.departmentIds = editDeptIds;
      }

      const { data } = await api.patch(
        `/api/workspaces/${currentWorkspaceId}/members/${editingMember._id}`,
        payload
      );
      toast.success(data.message || "Member updated successfully");
      setEditingMember(null);
      await fetchMembers();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update member");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Submit Remove
  const handleRemoveSubmit = async () => {
    if (!memberToRemove) return;

    setRemoveSubmitting(true);
    try {
      const { data } = await api.delete(
        `/api/workspaces/${currentWorkspaceId}/members/${memberToRemove._id}`
      );
      toast.success(data.message || "Member removed from workspace");
      setMemberToRemove(null);
      await fetchMembers();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to remove member");
    } finally {
      setRemoveSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Active
          </span>
        );
      case "invited":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Invited
          </span>
        );
      case "suspended":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-400 border border-purple-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            Suspended
          </span>
        );
      case "removed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Removed
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            Workspace Members
          </h2>
          <p className="text-sm text-zinc-400">
            Manage who has access to this workspace and configure their roles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMembers}
            title="Refresh member list"
            className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {canInvite && (
            <button
              onClick={handleOpenInvite}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-500 shadow-sm transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Add Member
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {["all", "active", "invited", "suspended", "removed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-zinc-800 text-blue-400 border border-zinc-700 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Main Table / State Views */}
      {loading && members.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-12 text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-400" />
          <p className="mt-3 text-sm text-zinc-400">Loading workspace members...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-400" />
          <p className="mt-2 text-sm font-medium text-rose-300">{error}</p>
          <button
            onClick={fetchMembers}
            className="mt-3 inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-zinc-600" />
          <h3 className="mt-3 text-base font-semibold text-zinc-200">No members found</h3>
          <p className="mt-1 text-sm text-zinc-400">
            {searchQuery
              ? "No members match your search criteria."
              : statusFilter !== "all"
              ? `No members with status "${statusFilter}".`
              : "This workspace has no members yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/90 text-xs font-semibold uppercase text-zinc-400">
                <tr>
                  <th className="px-5 py-3">Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {filteredMembers.map((m) => (
                  <tr
                    key={m._id}
                    className="hover:bg-zinc-800/40 transition-colors"
                  >
                    {/* Member Name and Email */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 font-semibold text-xs border border-blue-500/20">
                          {m.name
                            ? m.name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()
                            : "U"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium text-zinc-100 truncate">
                            <span>{m.name || "Unknown User"}</span>
                            {m.isOwner && (
                              <span
                                title="Workspace Owner"
                                className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30"
                              >
                                <Crown className="h-3 w-3" />
                                Owner
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-400 truncate">
                            {m.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Roles */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {m.roles && m.roles.length > 0 ? (
                          m.roles.map((r) => (
                            <span
                              key={r._id}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                                r.isOwner
                                  ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                  : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                              }`}
                            >
                              <Shield className="h-3 w-3 opacity-60" />
                              {r.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-500">No role</span>
                        )}
                      </div>
                    </td>

                    {/* Departments */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {m.departments && m.departments.length > 0 ? (
                          m.departments.map((d) => (
                            <span
                              key={d._id}
                              className="inline-flex items-center gap-1 rounded-md bg-zinc-800/80 px-2 py-0.5 text-xs font-medium text-zinc-300 border border-zinc-700/60"
                            >
                              <Building2 className="h-3 w-3 text-zinc-400" />
                              {d.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getStatusBadge(m.status)}
                    </td>

                    {/* Joined Date */}
                    <td className="px-4 py-3.5 text-xs text-zinc-400 whitespace-nowrap">
                      {m.joinedAt
                        ? new Date(m.joinedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      {m.isOwner ? (
                        <span
                          title="Workspace owner cannot be edited or removed"
                          className="text-xs text-zinc-500 italic"
                        >
                          Protected
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {(canManageRoles || canManageDepts) && (
                            <button
                              onClick={() => handleOpenEdit(m)}
                              title="Edit Member Roles & Departments"
                              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}
                          {canManageRoles && m.status !== "removed" && (
                            <button
                              onClick={() => setMemberToRemove(m)}
                              title="Remove from Workspace"
                              className="rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------- INVITE MEMBER MODAL ----------------- */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-full bg-blue-500/10 p-2 text-blue-400">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">Add Member</h3>
                  <p className="text-xs text-zinc-400">
                    Add a registered user by their email address.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  User Email <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  The user must already have registered an account on this DMS.
                </p>
              </div>

              {/* Roles */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Assign Roles
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5">
                  {availableRoles
                    .filter((r) => !r.isOwner)
                    .map((r) => (
                      <label
                        key={r._id}
                        className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white cursor-pointer py-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={inviteRoleIds.includes(r._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setInviteRoleIds([...inviteRoleIds, r._id]);
                            } else {
                              setInviteRoleIds(
                                inviteRoleIds.filter((id) => id !== r._id)
                              );
                            }
                          }}
                          className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{r.name}</span>
                      </label>
                    ))}
                  {availableRoles.filter((r) => !r.isOwner).length === 0 && (
                    <p className="text-xs text-zinc-500 italic">
                      No custom roles found. Employee role will be assigned.
                    </p>
                  )}
                </div>
              </div>

              {/* Departments */}
              {availableDepts.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Assign Departments
                  </label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5">
                    {availableDepts.map((d) => (
                      <label
                        key={d._id}
                        className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white cursor-pointer py-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={inviteDeptIds.includes(d._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setInviteDeptIds([...inviteDeptIds, d._id]);
                            } else {
                              setInviteDeptIds(
                                inviteDeptIds.filter((id) => id !== d._id)
                              );
                            }
                          }}
                          className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteSubmitting}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {inviteSubmitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Member"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- EDIT MEMBER MODAL ----------------- */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-full bg-blue-500/10 p-2 text-blue-400">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">
                    Edit Member Access
                  </h3>
                  <p className="text-xs text-zinc-400 truncate max-w-[280px]">
                    {editingMember.name} ({editingMember.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingMember(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Roles Selection */}
              {canManageRoles && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Roles
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5">
                    {availableRoles
                      .filter((r) => !r.isOwner)
                      .map((r) => (
                        <label
                          key={r._id}
                          className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white cursor-pointer py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={editRoleIds.includes(r._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditRoleIds([...editRoleIds, r._id]);
                              } else {
                                setEditRoleIds(
                                  editRoleIds.filter((id) => id !== r._id)
                                );
                              }
                            }}
                            className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{r.name}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}

              {/* Departments Selection */}
              {canManageDepts && availableDepts.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Departments
                  </label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5">
                    {availableDepts.map((d) => (
                      <label
                        key={d._id}
                        className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white cursor-pointer py-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={editDeptIds.includes(d._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditDeptIds([...editDeptIds, d._id]);
                            } else {
                              setEditDeptIds(
                                editDeptIds.filter((id) => id !== d._id)
                              );
                            }
                          }}
                          className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Selection */}
              {canManageRoles && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Membership Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="removed">Removed</option>
                  </select>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
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

      {/* ----------------- REMOVE MEMBER CONFIRMATION MODAL ----------------- */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="rounded-full bg-rose-500/10 p-2.5">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">
                  Remove Member
                </h3>
                <p className="text-xs text-zinc-400">
                  This action terminates their workspace access.
                </p>
              </div>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">
              Are you sure you want to remove{" "}
              <strong className="text-white">{memberToRemove.name}</strong> (
              {memberToRemove.email}) from this workspace? They will immediately
              lose access to all documents and data in this workspace.
            </p>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removeSubmitting}
                onClick={handleRemoveSubmit}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {removeSubmitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Removing...
                  </>
                ) : (
                  "Confirm Removal"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
