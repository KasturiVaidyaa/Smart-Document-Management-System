import { useState } from "react";
import {
  Users, Building2, Shield, Settings,
  Layers, HardDrive, Tag, History, Info, Lock, UserCheck,
} from "lucide-react";
import { useWorkspace } from "../context/WorkspaceContext";
import { MembersManagement } from "../components/admin/MembersManagement";
import { DepartmentsManagement } from "../components/admin/DepartmentsManagement";
import { RolesManagement } from "../components/admin/RolesManagement";
import { WorkspaceSettings } from "../components/admin/WorkspaceSettings";
import { StorageManagement } from "../components/admin/StorageManagement";
import { CategoriesManagement } from "../components/admin/CategoriesManagement";
import { AuditManagement } from "../components/admin/AuditManagement";
import AccessRequestsPanel from "../components/documents/AccessRequestsPanel";

const WorkspaceAdmin = () => {
  const { current } = useWorkspace();
  const [activeTab, setActiveTab] = useState("members");

  const isPersonal = current?.workspace?.type === "personal";
  const isOwner = current?.isOwner;
  const perms = current?.permissions || [];

  const can = (perm) => isOwner || perms.includes(perm);

  if (isPersonal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-10 max-w-md">
          <Info className="mx-auto h-10 w-10 text-blue-400 mb-4" />
          <h2 className="text-xl font-bold text-zinc-100">Personal Workspace</h2>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            Administration features are only available for{" "}
            <strong className="text-zinc-200">Organization</strong> workspaces.
            Create one using the workspace switcher in the top bar.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "members",        name: "Members",            icon: Users,       allowed: isOwner || can("members.invite") },
    { id: "departments",    name: "Departments",         icon: Building2,   allowed: can("departments.manage") },
    { id: "roles",          name: "Roles & Permissions", icon: Shield,      allowed: can("roles.manage") },
    { id: "access-requests",name: "Access Requests",    icon: UserCheck,   allowed: isOwner || can("sharing.manage") },
    { id: "categories",     name: "AI Categories",       icon: Tag,         allowed: can("roles.manage") },
    { id: "storage",        name: "Storage",             icon: HardDrive,   allowed: can("storage.view") },
    { id: "audit",          name: "Audit Trail",         icon: History,     allowed: can("audit.view") },
    { id: "settings",       name: "Settings",            icon: Settings,    allowed: isOwner },
  ];

  const visibleTabs = tabs.filter(t => t.allowed);

  if (visibleTabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-10 max-w-md">
          <Lock className="mx-auto h-10 w-10 text-zinc-600 mb-4" />
          <h2 className="text-xl font-bold text-zinc-100">Access Restricted</h2>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            You don't have permission to access the Administration panel. Contact your workspace owner.
          </p>
        </div>
      </div>
    );
  }

  const effectiveTab = visibleTabs.some(t => t.id === activeTab) ? activeTab : visibleTabs[0].id;

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
          <Layers className="h-3.5 w-3.5" />
          <span>Administration</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-zinc-100">
          {current?.workspace?.name} — Admin
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage members, departments, roles, and workspace settings.
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-zinc-800">
        <nav className="flex gap-0 overflow-x-auto" aria-label="Admin tabs">
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = effectiveTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-blue-400" : "text-zinc-600 group-hover:text-zinc-400"}`} />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div>
        {effectiveTab === "members"          && <MembersManagement />}
        {effectiveTab === "departments"      && <DepartmentsManagement />}
        {effectiveTab === "roles"            && <RolesManagement />}
        {effectiveTab === "access-requests"  && <AccessRequestsPanel />}
        {effectiveTab === "categories"       && <CategoriesManagement />}
        {effectiveTab === "storage"          && <StorageManagement />}
        {effectiveTab === "audit"            && <AuditManagement />}
        {effectiveTab === "settings"         && <WorkspaceSettings onNavigateTab={setActiveTab} />}
      </div>
    </div>
  );
};

export default WorkspaceAdmin;
