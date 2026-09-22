import { useState } from "react";
import {
  Users,
  Building2,
  Shield,
  Settings,
  Info,
  Layers,
  HardDrive,
  Tag,
  History,
} from "lucide-react";
import { useWorkspace } from "../context/WorkspaceContext";
import { MembersManagement } from "../components/admin/MembersManagement";
import { DepartmentsManagement } from "../components/admin/DepartmentsManagement";
import { RolesManagement } from "../components/admin/RolesManagement";
import { WorkspaceSettings } from "../components/admin/WorkspaceSettings";
import { StorageManagement } from "../components/admin/StorageManagement";
import { CategoriesManagement } from "../components/admin/CategoriesManagement";
import { AuditManagement } from "../components/admin/AuditManagement";

const WorkspaceAdmin = () => {
  const { current } = useWorkspace();
  const [activeTab, setActiveTab] = useState("members");

  const isPersonal = current?.workspace?.type === "personal";

  if (isPersonal) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center max-w-xl mx-auto mt-8">
        <Info className="mx-auto h-10 w-10 text-blue-400" />
        <h2 className="mt-4 text-xl font-bold text-zinc-100">
          Personal Workspace
        </h2>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          Workspace Administration features (Members, Departments, and Roles) are only available for{" "}
          <strong className="text-zinc-200">Organization</strong> workspaces. You can create an organization workspace using the sidebar form to collaborate with your team.
        </p>
      </div>
    );
  }

  const tabs = [
    {
      id: "members",
      name: "Members",
      icon: Users,
      badge: "Phase 2 Active",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      enabled: true,
    },
    {
      id: "departments",
      name: "Departments",
      icon: Building2,
      badge: "Phase 3 Active",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      enabled: true,
    },
    {
      id: "roles",
      name: "Roles & Permissions",
      icon: Shield,
      badge: "Phase 5 Active",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      enabled: true,
    },
    {
      id: "settings",
      name: "Workspace Settings",
      icon: Settings,
      badge: "Phase 6 Active",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      enabled: true,
    },
    {
      id: "storage",
      name: "Storage & Quota",
      icon: HardDrive,
      badge: "Phase 7 Active",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      enabled: true,
    },
    {
      id: "categories",
      name: "AI Categories",
      icon: Tag,
      badge: "Phase 8 Active",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      enabled: true,
    },
    {
      id: "audit",
      name: "Audit Trail",
      icon: History,
      badge: "Audit Active",
      badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      enabled: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title & Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
          <Layers className="h-3.5 w-3.5" />
          <span>Administration</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-zinc-100 sm:text-3xl">
          {current?.workspace?.name || "Workspace"} Administration
        </h1>
        <p className="mt-1.5 text-sm text-zinc-400">
          Configure workspace membership, departments, permissions, and organizational settings.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-zinc-800">
        <nav className="flex space-x-2 overflow-x-auto pb-px" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => tab.enabled && setActiveTab(tab.id)}
                disabled={!tab.enabled}
                className={`group flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-blue-500 text-blue-400"
                    : tab.enabled
                    ? "border-transparent text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    : "border-transparent text-zinc-600 cursor-not-allowed opacity-60"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-blue-400" : ""}`} />
                <span>{tab.name}</span>
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${tab.badgeColor}`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === "members" && <MembersManagement />}
        {activeTab === "departments" && <DepartmentsManagement />}
        {activeTab === "roles" && <RolesManagement />}
        {activeTab === "settings" && <WorkspaceSettings onNavigateTab={setActiveTab} />}
        {activeTab === "storage" && <StorageManagement />}
        {activeTab === "categories" && <CategoriesManagement />}
        {activeTab === "audit" && <AuditManagement />}
      </div>
    </div>
  );
};

export default WorkspaceAdmin;
