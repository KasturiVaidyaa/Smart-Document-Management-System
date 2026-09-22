import { UserData } from "../context/UserContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { user } = UserData();
  const { current } = useWorkspace();
  const workspace = current?.workspace;

  if (!workspace) {
    return <p className="text-zinc-400">No workspace selected.</p>;
  }

  const usedPct = workspace.storageQuotaBytes
    ? Math.min(
        100,
        Math.round((workspace.storageUsedBytes / workspace.storageQuotaBytes) * 100)
      )
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-blue-400">
          {workspace.type === "personal" ? "Personal workspace" : "Organization"}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{workspace.name}</h1>
        <p className="mt-2 text-zinc-400">
          Signed in as {user?.email}.{" "}
          <Link to="/app/documents" className="text-blue-400 hover:underline">
            Open Documents
          </Link>{" "}
          to upload and preview files in this workspace.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Your access</p>
          <p className="mt-1 text-lg font-semibold">
            {current.isOwner ? "Owner" : "Member"}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            {current.permissions?.length
              ? current.permissions.join(", ")
              : "Owner-level access in personal workspace"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Storage</p>
          <p className="mt-1 text-lg font-semibold">{usedPct}% used</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
