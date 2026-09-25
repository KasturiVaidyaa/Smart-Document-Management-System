import { useEffect, useState } from "react";
import {
  X,
  Shield,
  UserPlus,
  Trash2,
  Clock,
  Users,
  Building2,
  Globe,
  Edit3,
  ListFilter,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../utils/api";
import { useWorkspace } from "../../context/WorkspaceContext";

const ACTIONS = ["view", "edit", "download", "share", "delete"];

const DEFAULT_SYSTEM_ROLES = [
  { _id: "admin", name: "Admin", isSystem: true },
  { _id: "manager", name: "Manager", isSystem: true },
  { _id: "employee", name: "Employee", isSystem: true },
];

const principalTypeLabels = {
  user: "User",
  role: "Role",
  department: "Department",
  workspace: "Everyone in workspace",
};

const principalTypeIcons = {
  user: <UserPlus className="h-4 w-4" />,
  role: <Users className="h-4 w-4" />,
  department: <Building2 className="h-4 w-4" />,
  workspace: <Globe className="h-4 w-4" />,
};

export const PermissionsModal = ({
  isOpen,
  onClose,
  document,
  workspaceId,
}) => {
  const { current: currentWorkspace } = useWorkspace();
  const [directGrants, setDirectGrants] = useState([]);
  const [inheritedGrants, setInheritedGrants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // New grant form state
  const [principalType, setPrincipalType] = useState("user");
  const [principalId, setPrincipalId] = useState("");
  const [isManualInput, setIsManualInput] = useState(false);
  const [selectedActions, setSelectedActions] = useState(["view"]);
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    if (isOpen && document && workspaceId) {
      loadPermissions();
      loadMembers();
      loadRoles();
      loadDepartments();
    }
  }, [isOpen, document?._id, workspaceId]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/api/workspaces/${workspaceId}/documents/${document._id}/permissions`
      );
      setDirectGrants(data.directGrants || []);
      setInheritedGrants(data.inheritedGrants || []);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to load permissions"
      );
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const { data } = await api.get(`/api/workspaces/${workspaceId}/members`);
      setMembers(data.members || []);
    } catch {
      // Non-critical — user picker won't have options
    }
  };

  const loadRoles = async () => {
    try {
      const { data } = await api.get(`/api/workspaces/${workspaceId}/roles`);
      setRoles(data.roles || []);
    } catch {
      // Non-critical
    }
  };

  const loadDepartments = async () => {
    try {
      const { data } = await api.get(
        `/api/workspaces/${workspaceId}/departments`
      );
      setDepartments(data.departments || []);
    } catch {
      // Non-critical
    }
  };

  const toggleAction = (action) => {
    setSelectedActions((prev) =>
      prev.includes(action)
        ? prev.filter((a) => a !== action)
        : [...prev, action]
    );
  };

  const handleGrant = async (e) => {
    e.preventDefault();
    if (selectedActions.length === 0) {
      toast.error("Select at least one action");
      return;
    }
    if (principalType !== "workspace" && !principalId.trim()) {
      toast.error("Select or enter a valid user, role, or department");
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/api/workspaces/${workspaceId}/permissions`, {
        resourceType: "document",
        resourceId: document._id,
        principalType,
        principalId:
          principalType === "workspace" ? undefined : principalId.trim(),
        actions: selectedActions,
        expiresAt: expiresAt || undefined,
      });
      toast.success("Permission granted");
      setPrincipalId("");
      setSelectedActions(["view"]);
      setExpiresAt("");
      await loadPermissions();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to grant permission"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (grantId) => {
    try {
      await api.delete(`/api/workspaces/${workspaceId}/permissions/${grantId}`);
      toast.success("Permission revoked");
      await loadPermissions();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to revoke permission"
      );
    }
  };

  // Compile combined roles list
  const allRolesMap = new Map();
  // 1. Roles from workspace API
  for (const r of roles) {
    allRolesMap.set(String(r._id), r);
  }
  // 2. Roles from members
  for (const m of members) {
    for (const r of m.roles || []) {
      if (!allRolesMap.has(String(r._id))) {
        allRolesMap.set(String(r._id), r);
      }
    }
  }
  // 3. Default fallback if empty
  if (allRolesMap.size === 0) {
    for (const r of DEFAULT_SYSTEM_ROLES) {
      allRolesMap.set(r._id, r);
    }
  }
  const availableRoles = Array.from(allRolesMap.values());

  // Compile combined departments list
  const allDeptsMap = new Map();
  for (const d of departments) {
    allDeptsMap.set(String(d._id), d);
  }
  for (const m of members) {
    for (const d of m.departments || []) {
      if (!allDeptsMap.has(String(d._id))) {
        allDeptsMap.set(String(d._id), d);
      }
    }
  }
  const availableDepts = Array.from(allDeptsMap.values());

  const renderPrincipalName = (grant) => {
    if (grant.principalType === "workspace") return "Everyone in workspace";
    if (grant.principalType === "user") {
      const member = members.find(
        (m) => String(m.userId) === String(grant.principalId)
      );
      return member
        ? `${member.name} (${member.email})`
        : String(grant.principalId);
    }
    if (grant.principalType === "role") {
      const role = availableRoles.find(
        (r) => String(r._id) === String(grant.principalId)
      );
      return role ? `Role: ${role.name}` : `Role: ${grant.principalId}`;
    }
    if (grant.principalType === "department") {
      const dept = availableDepts.find(
        (d) => String(d._id) === String(grant.principalId)
      );
      return dept ? `Dept: ${dept.name}` : `Dept: ${grant.principalId}`;
    }
    return String(grant.principalId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-500/10 p-2">
              <Shield className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-100">Permissions</h3>
              <p className="text-xs text-zinc-400 truncate max-w-[350px]">
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
          {/* Grant form */}
          <form
            onSubmit={handleGrant}
            className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
          >
            <h4 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-400" />
              Grant access
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Principal Type */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Type</label>
                <select
                  value={principalType}
                  onChange={(e) => {
                    setPrincipalType(e.target.value);
                    setPrincipalId("");
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="user">User</option>
                  {currentWorkspace?.workspace?.type !== "personal" && (
                    <>
                      <option value="role">Role</option>
                      <option value="department">Department</option>
                      <option value="workspace">Everyone in workspace</option>
                    </>
                  )}
                </select>
              </div>

              {/* Principal selector / manual input */}
              {principalType !== "workspace" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-zinc-400">
                      {principalTypeLabels[principalType]}
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsManualInput(!isManualInput)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                    >
                      {isManualInput ? (
                        <>
                          <ListFilter className="h-3 w-3" /> Select from list
                        </>
                      ) : (
                        <>
                          <Edit3 className="h-3 w-3" /> Write / custom ID
                        </>
                      )}
                    </button>
                  </div>

                  {isManualInput ? (
                    <input
                      type="text"
                      value={principalId}
                      onChange={(e) => setPrincipalId(e.target.value)}
                      placeholder={`Enter ${principalTypeLabels[principalType]} ID or identifier...`}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <select
                      value={principalId}
                      onChange={(e) => setPrincipalId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">
                        Select a {principalTypeLabels[principalType]}...
                      </option>

                      {principalType === "user" &&
                        members.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.name} ({m.email})
                          </option>
                        ))}

                      {principalType === "role" &&
                        availableRoles.map((r) => (
                          <option key={r._id} value={r._id}>
                            {r.name} {r.isSystem ? "(System Role)" : "(Custom Role)"}
                          </option>
                        ))}

                      {principalType === "department" &&
                        availableDepts.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Actions</label>
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => toggleAction(action)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      selectedActions.includes(action)
                        ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                        : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>

            {/* Expiry */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Expires at (optional)
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
              >
                {submitting ? "Granting..." : "Grant"}
              </button>
            </div>
          </form>

          {/* Direct Grants */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-200 mb-3">
              Direct permissions ({directGrants.length})
            </h4>
            {loading ? (
              <p className="text-xs text-zinc-500">Loading...</p>
            ) : directGrants.length === 0 ? (
              <p className="text-xs text-zinc-500 bg-zinc-950/30 rounded-lg p-3 border border-zinc-800">
                No direct permissions set on this document.
              </p>
            ) : (
              <ul className="space-y-2">
                {directGrants.map((grant) => (
                  <li
                    key={grant._id}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/30 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-zinc-400">
                        {principalTypeIcons[grant.principalType]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-200 truncate">
                          {renderPrincipalName(grant)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {grant.actions?.map((a) => (
                            <span
                              key={a}
                              className="rounded-full bg-blue-600/15 px-2 py-0.5 text-[10px] font-medium text-blue-300 border border-blue-500/20"
                            >
                              {a}
                            </span>
                          ))}
                          {grant.expiresAt && (
                            <span className="flex items-center gap-0.5 rounded-full bg-amber-600/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/20">
                              <Clock className="h-2.5 w-2.5" />
                              {new Date(grant.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevoke(grant._id)}
                      className="rounded-md p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors shrink-0"
                      title="Revoke"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Inherited Grants */}
          {inheritedGrants.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-zinc-200 mb-3">
                Inherited permissions ({inheritedGrants.length})
              </h4>
              <ul className="space-y-2">
                {inheritedGrants.map((grant, idx) => (
                  <li
                    key={grant._id || idx}
                    className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-950/20 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-zinc-500">
                        {principalTypeIcons[grant.principalType]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-300 truncate">
                          {renderPrincipalName(grant)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {grant.actions?.map((a) => (
                            <span
                              key={a}
                              className="rounded-full bg-zinc-700/30 px-2 py-0.5 text-[10px] font-medium text-zinc-400 border border-zinc-700/40"
                            >
                              {a}
                            </span>
                          ))}
                          {grant._inheritedFrom && (
                            <span className="text-[10px] text-zinc-500">
                              from 📁 {grant._inheritedFrom.folderName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-600 shrink-0">
                      inherited
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PermissionsModal;
