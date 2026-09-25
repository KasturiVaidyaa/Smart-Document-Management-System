import { createElement, useState, useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { UserData } from "../context/UserContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { toast } from "react-toastify";
import { NotificationBell } from "./notifications/NotificationBell";
import {
  ChevronDown,
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Settings,
  UserCheck,
  X,
  Plus,
  Check,
  Building2,
  LogOut,
  User,
  ChevronRight,
} from "lucide-react";

/**
 * AppLayout — shell for authenticated pages.
 * Dark-only, Google Drive–style top bar + persistent left sidebar.
 * Workspace switcher is a proper popover (not a <select>).
 * "New organization" is in a modal, not inline in the sidebar.
 */
const AppLayout = () => {
  const { user, logoutUser } = UserData();
  const {
    workspaces,
    current,
    currentWorkspaceId,
    selectWorkspace,
    createOrganization,
  } = useWorkspace();
  const navigate = useNavigate();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [wsSwitcherOpen, setWsSwitcherOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [newOrgModalOpen, setNewOrgModalOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  const wsSwitcherRef = useRef(null);
  const userMenuRef = useRef(null);

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wsSwitcherRef.current && !wsSwitcherRef.current.contains(e.target)) setWsSwitcherOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Use a ref so the keyboard shortcut effect never needs to re-register
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; });

  // Keyboard shortcuts — registered once, always have fresh navigate via ref
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.altKey && e.key === "d") { e.preventDefault(); navigateRef.current("/app/documents"); }
      if (e.altKey && e.key === "c") { e.preventDefault(); navigateRef.current("/app/chat"); }
      if (e.altKey && e.key === "h") { e.preventDefault(); navigateRef.current("/app"); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []); // empty deps — stable via ref

  // Close mobile nav on route change
  const { pathname } = useLocation();
  useEffect(() => { setMobileNavOpen(false); }, [pathname]);

  const onCreateOrg = async (e) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setCreating(true);
    try {
      await createOrganization(orgName.trim());
      toast.success("Organization created");
      setOrgName("");
      setNewOrgModalOpen(false);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not create organization");
    } finally {
      setCreating(false);
    }
  };

  const isPersonal = current?.workspace?.type === "personal";

  const navItems = [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true, shortcut: "Alt+H" },
    { to: "/app/documents", label: "Documents", icon: FileText, shortcut: "Alt+D" },
    { to: "/app/chat", label: "AI Chat", icon: MessageSquare, shortcut: "Alt+C" },
    ...((current?.isOwner || current?.permissions?.includes("sharing.manage"))
      ? [{ to: "/app/admin", label: "Access Requests", icon: UserCheck }]
      : []),
    ...(!isPersonal ? [{ to: "/app/admin", label: "Administration", icon: Settings }] : []),
  ];

  const sidebarContent = (
    <nav className="flex flex-col h-full" aria-label="Primary navigation">
      <div className="space-y-0.5 flex-1">
        {navItems.map((item) => (
          <AppNavItem
            key={item.to}
            {...item}
            onNavigate={() => setMobileNavOpen(false)}
          />
        ))}
      </div>

      {/* Keyboard shortcuts hint — bottom of sidebar */}
      <div className="mt-auto pt-4 border-t border-zinc-800/60 hidden xl:block">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Quick access</p>
        {[["Alt+H","Dashboard"],["Alt+D","Documents"],["Alt+C","AI Chat"]].map(([k,l]) => (
          <p key={k} className="flex items-center gap-2 text-[11px] text-zinc-600 mb-1">
            <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">{k}</kbd>
            {l}
          </p>
        ))}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ─── Top Bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:px-5">
          {/* Mobile nav toggle */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo */}
          <Link to="/app" className="flex items-center gap-2.5 text-sm font-semibold text-zinc-100 shrink-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-950/40">
              <FileText className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="hidden sm:block tracking-tight">Smart Cloud DMS</span>
          </Link>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Workspace Switcher Popover */}
            <div className="relative" ref={wsSwitcherRef}>
              <button
                onClick={() => setWsSwitcherOpen(v => !v)}
                className="hidden sm:flex items-center gap-2 max-w-[200px] rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800"
              >
                <Building2 className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                <span className="truncate">{current?.workspace?.name || "Workspace"}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 shrink-0 transition-transform ${wsSwitcherOpen ? "rotate-180" : ""}`} />
              </button>

              {wsSwitcherOpen && (
                <div className="dropdown-panel absolute right-0 mt-2 w-64 z-50">
                  <div className="px-3 py-2 border-b border-zinc-800">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Switch workspace</p>
                  </div>
                  <div className="py-1 max-h-52 overflow-y-auto">
                    {workspaces.map(item => (
                      <button
                        key={item.workspace._id}
                        onClick={() => { selectWorkspace(String(item.workspace._id)); setWsSwitcherOpen(false); }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/70 hover:text-white transition-colors text-left"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-xs font-bold text-zinc-400">
                          {item.workspace.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{item.workspace.name}</p>
                          <p className="text-[10px] text-zinc-500 capitalize">{item.workspace.type}</p>
                        </div>
                        {String(item.workspace._id) === String(currentWorkspaceId) && (
                          <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-zinc-800 p-1">
                    <button
                      onClick={() => { setWsSwitcherOpen(false); setNewOrgModalOpen(true); }}
                      className="flex items-center gap-2 w-full rounded-md px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      New organization
                    </button>
                  </div>
                </div>
              )}
            </div>

            <NotificationBell />

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600/30 text-[10px] font-bold text-blue-300 uppercase">
                  {user?.name?.charAt(0) || "U"}
                </span>
                <span className="hidden sm:block max-w-24 truncate">{user?.name}</span>
                <ChevronDown className={`h-3 w-3 text-zinc-500 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {userMenuOpen && (
                <div className="dropdown-panel absolute right-0 mt-2 w-52 z-50">
                  <div className="px-3 py-2.5 border-b border-zinc-800">
                    <p className="text-xs font-medium text-zinc-200 truncate">{user?.name}</p>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">{user?.email}</p>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={() => { setUserMenuOpen(false); setNewOrgModalOpen(true); }}
                      className="ctx-item"
                    >
                      <Building2 className="h-4 w-4 text-zinc-500" />
                      New organization
                    </button>
                    <div className="ctx-separator" />
                    <button
                      onClick={() => { setUserMenuOpen(false); logoutUser(navigate); }}
                      className="ctx-item danger"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─── Mobile Drawer ───────────────────────────────────── */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <aside className="relative h-full w-[min(86vw,280px)] border-r border-zinc-800 bg-zinc-950 px-4 py-5 shadow-2xl flex flex-col">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                  <FileText className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="text-sm font-semibold">Smart Cloud DMS</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile workspace selector */}
            <div className="mb-4">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Workspace</p>
              <select
                value={currentWorkspaceId}
                onChange={e => selectWorkspace(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-none"
              >
                {workspaces.map(item => (
                  <option key={item.workspace._id} value={item.workspace._id}>{item.workspace.name}</option>
                ))}
              </select>
            </div>

            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ─── Main layout: sidebar + content ─────────────────── */}
      <div className="mx-auto flex max-w-[1600px] min-h-[calc(100vh-56px)]">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-zinc-800/60 bg-zinc-950 px-3 py-5">
          {sidebarContent}
        </aside>

        {/* Page content */}
        <main className="flex-1 min-w-0 px-4 py-5 sm:px-6 sm:py-6 page-enter">
          <Outlet />
        </main>
      </div>

      {/* ─── New Organization Modal ───────────────────────────── */}
      {newOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-400" />
                <h2 className="text-base font-semibold text-zinc-100">New Organization</h2>
              </div>
              <button onClick={() => setNewOrgModalOpen(false)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-4">Create an organization workspace to collaborate with your team.</p>
            <form onSubmit={onCreateOrg} className="space-y-3">
              <input
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="Organization name"
                autoFocus
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              />
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setNewOrgModalOpen(false)}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !orgName.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const AppNavItem = ({ to, label, icon: NavIcon, end, shortcut, onNavigate }) => (
  <NavLink
    to={to}
    end={end}
    title={shortcut ? `${label} (${shortcut})` : label}
    className={({ isActive }) =>
      `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/20"
          : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100"
      }`
    }
    onClick={onNavigate}
  >
    {({ isActive }) => (
      <>
        {createElement(NavIcon, {
          className: `h-[18px] w-[18px] shrink-0 ${isActive ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-300"}`,
        })}
        <span>{label}</span>
        {shortcut && (
          <kbd className="ml-auto hidden text-[10px] font-normal text-zinc-600 xl:inline">{shortcut}</kbd>
        )}
      </>
    )}
  </NavLink>
);

export default AppLayout;
