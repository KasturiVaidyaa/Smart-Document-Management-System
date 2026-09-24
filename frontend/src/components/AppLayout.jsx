import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { UserData } from "../context/UserContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { toast } from "react-toastify";
import { NotificationBell } from "./notifications/NotificationBell";
import { Sun, Moon } from "lucide-react";

/**
 * AppLayout — shell for authenticated pages.
 * Additions vs original:
 *  - Dark/light theme toggle (persisted in localStorage via data-theme on <html>)
 *  - Keyboard shortcut: Alt+D → Documents, Alt+C → Chat, Alt+H → Dashboard
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
  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  // --- Theme ---
  const [theme, setTheme] = useState(
    () => localStorage.getItem("dms-theme") || "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("dms-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.altKey && e.key === "d") { e.preventDefault(); navigate("/app/documents"); }
      if (e.altKey && e.key === "c") { e.preventDefault(); navigate("/app/chat"); }
      if (e.altKey && e.key === "h") { e.preventDefault(); navigate("/app"); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate]);

  const onCreateOrg = async (e) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setCreating(true);
    try {
      await createOrganization(orgName.trim());
      toast.success("Organization created");
      setOrgName("");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not create organization");
    } finally {
      setCreating(false);
    }
  };

  const isPersonal = current?.workspace?.type === "personal";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 transition-colors duration-200" data-theme={theme}>
      <header className="relative z-30 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/app" className="text-lg font-semibold text-blue-400">
            Smart Cloud DMS
          </Link>
          <div className="flex items-center gap-3">
            <select
              value={currentWorkspaceId}
              onChange={(e) => selectWorkspace(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm"
            >
              {workspaces.map((item) => (
                <option key={item.workspace._id} value={item.workspace._id}>
                  {item.workspace.name}
                  {item.workspace.type === "personal" ? " (Personal)" : ""}
                </option>
              ))}
            </select>
            <NotificationBell />
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              aria-label="Toggle theme"
              className="rounded-md border border-zinc-700 p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <span className="hidden text-sm text-zinc-400 sm:inline">
              {user?.name}
            </span>
            <button
              onClick={() => logoutUser(navigate)}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-4 text-sm">
          <nav className="space-y-1">
            <Link
              className="block rounded-md px-3 py-2 hover:bg-zinc-800 transition-colors"
              to="/app"
              title="Dashboard (Alt+H)"
            >
              Dashboard
            </Link>
            <Link
              className="block rounded-md px-3 py-2 hover:bg-zinc-800 transition-colors"
              to="/app/documents"
              title="Documents (Alt+D)"
            >
              Documents
            </Link>
            <Link
              className="block rounded-md px-3 py-2 hover:bg-zinc-800 transition-colors"
              to="/app/chat"
              title="Chat (Alt+C)"
            >
              Chat
            </Link>
            {(current?.isOwner || current?.permissions?.includes("sharing.manage")) && (
              <Link className="block rounded-md px-3 py-2 hover:bg-zinc-800 transition-colors" to="/app/access-requests">
                Access Requests
              </Link>
            )}
            {!isPersonal && (
              <Link className="block rounded-md px-3 py-2 hover:bg-zinc-800 transition-colors" to="/app/admin">
                Administration
              </Link>
            )}
          </nav>

          {/* Keyboard shortcuts hint */}
          <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-500 space-y-0.5">
            <p className="font-semibold text-zinc-400 mb-1">Keyboard shortcuts</p>
            <p><kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[10px]">Alt+H</kbd> Dashboard</p>
            <p><kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[10px]">Alt+D</kbd> Documents</p>
            <p><kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[10px]">Alt+C</kbd> Chat</p>
          </div>

          <form onSubmit={onCreateOrg} className="rounded-lg border border-zinc-800 p-3">
            <p className="mb-2 font-medium">New organization</p>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Corp"
              className="mb-2 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
            />
            <button
              disabled={creating}
              className="w-full rounded-md bg-blue-600 px-2 py-1.5 font-medium hover:bg-blue-500 disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </form>
        </aside>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
