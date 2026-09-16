import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { UserData } from "../context/UserContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { toast } from "react-toastify";

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
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
            <Link className="block rounded-md px-3 py-2 hover:bg-zinc-800" to="/app">
              Dashboard
            </Link>
            <Link className="block rounded-md px-3 py-2 hover:bg-zinc-800" to="/app/documents">
              Documents
            </Link>
            <Link className="block rounded-md px-3 py-2 hover:bg-zinc-800" to="/app/chat">
              Chat
            </Link>
            {!isPersonal && (
              <span className="block rounded-md px-3 py-2 text-zinc-500">
                Members (soon)
              </span>
            )}
          </nav>
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
