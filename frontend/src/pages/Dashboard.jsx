import { useEffect, useState } from "react";
import { UserData } from "../context/UserContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  FileText,
  HardDrive,
  ShieldCheck,
  MessageSquare,
  Clock,
  FileImage,
  FileSpreadsheet,
  File,
  TrendingUp,
  Users,
  Sparkles,
  FolderOpen,
} from "lucide-react";
import api from "../utils/api";

const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatRelative = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const days = Math.floor(hr / 24);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const getFileIcon = (mimeType = "", name = "") => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (mimeType.startsWith("image/")) return <FileImage className="h-4 w-4 text-purple-400 shrink-0" />;
  if (mimeType === "application/pdf" || ext === "pdf") return <FileText className="h-4 w-4 text-rose-400 shrink-0" />;
  if (mimeType.includes("sheet") || ["csv", "xlsx", "xls"].includes(ext))
    return <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />;
  return <File className="h-4 w-4 text-blue-400 shrink-0" />;
};

const StatCard = ({ icon: Icon, iconColor, label, value, sub }) => (
  <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-100">{value ?? "—"}</p>
        {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
      </div>
      <span className={`rounded-lg p-2 ${iconColor}`}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
  </div>
);

const Dashboard = () => {
  const { user } = UserData();
  const { current, currentWorkspaceId } = useWorkspace();
  const workspace = current?.workspace;

  const [recentDocs, setRecentDocs] = useState([]);
  const [docCount, setDocCount] = useState(null);
  const [memberCount, setMemberCount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    setLoading(true);

    const loadDocs = api.get(`/api/workspaces/${currentWorkspaceId}/documents`, { params: { status: "active" } });
    const loadMembers = !current?.workspace || current?.workspace?.type === "personal"
      ? Promise.resolve(null)
      : api.get(`/api/workspaces/${currentWorkspaceId}/members`);

    Promise.all([loadDocs, loadMembers])
      .then(([docsRes, membersRes]) => {
        const docs = docsRes.data.documents || [];
        setDocCount(docs.length);
        // Sort by updatedAt desc for recent files
        const sorted = [...docs].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        setRecentDocs(sorted.slice(0, 8));
        if (membersRes) {
          setMemberCount((membersRes.data.members || []).length);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentWorkspaceId]);

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-zinc-500 text-sm">No workspace selected.</p>
      </div>
    );
  }

  const usedBytes = workspace.storageUsedBytes || 0;
  const quotaBytes = workspace.storageQuotaBytes || 0;
  const usedPct = quotaBytes ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;
  const isPersonal = workspace.type === "personal";

  return (
    <div className="space-y-6 page-enter">
      {/* ─── Hero banner ──────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-blue-950/50 via-zinc-900/60 to-zinc-950/80 p-6 sm:p-7 relative">
        {/* decorative glow */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-blue-600/10 blur-3xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-400">
          {isPersonal ? "Personal workspace" : "Organization workspace"}
        </p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
              {workspace.name}
            </h1>
            <p className="mt-1.5 text-sm text-zinc-400">
              Welcome back, <span className="text-zinc-200 font-medium">{user?.name}</span>. Your files are organized and ready.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              to="/app/documents"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500"
            >
              <FolderOpen className="h-4 w-4" />
              Open Files
            </Link>
            <Link
              to="/app/chat"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
            >
              <MessageSquare className="h-4 w-4 text-emerald-400" />
              AI Chat
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Stats row ───────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          iconColor="bg-blue-500/10 text-blue-400"
          label="Total Files"
          value={loading ? "…" : docCount}
          sub="in this workspace"
        />
        <StatCard
          icon={HardDrive}
          iconColor="bg-violet-500/10 text-violet-400"
          label="Storage Used"
          value={loading ? "…" : formatBytes(usedBytes)}
          sub={quotaBytes ? `of ${formatBytes(quotaBytes)} (${usedPct}%)` : "no quota set"}
        />
        <StatCard
          icon={ShieldCheck}
          iconColor="bg-emerald-500/10 text-emerald-400"
          label="Your Role"
          value={current?.isOwner ? "Owner" : "Member"}
          sub={isPersonal ? "Personal workspace" : "Organization"}
        />
        {!isPersonal ? (
          <StatCard
            icon={Users}
            iconColor="bg-amber-500/10 text-amber-400"
            label="Members"
            value={loading ? "…" : memberCount}
            sub="in this organization"
          />
        ) : (
          <StatCard
            icon={Sparkles}
            iconColor="bg-indigo-500/10 text-indigo-400"
            label="AI Chat"
            value="Active"
            sub="ask questions about your docs"
          />
        )}
      </div>

      {/* ─── Storage bar (only when quota set) ───────────────── */}
      {quotaBytes > 0 && (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-300">Storage quota</p>
            <p className="text-xs text-zinc-500">{formatBytes(usedBytes)} / {formatBytes(quotaBytes)}</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all duration-700 ${usedPct > 85 ? "bg-rose-500" : usedPct > 60 ? "bg-amber-500" : "bg-blue-500"}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ─── Recent files ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-500" />
            Recent files
          </h2>
          <Link to="/app/documents" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-zinc-800 bg-zinc-900/40 skeleton-row" />
            ))}
          </div>
        ) : recentDocs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-10 text-center">
            <FolderOpen className="mx-auto h-8 w-8 text-zinc-700 mb-2" />
            <p className="text-sm text-zinc-500">No files yet. Upload your first document to get started.</p>
            <Link to="/app/documents" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300">
              Go to Documents <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentDocs.map(doc => (
              <Link
                key={doc._id}
                to={`/app/documents?highlight=${doc._id}`}
                className="group flex flex-col gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 transition hover:border-zinc-700 hover:bg-zinc-800/60"
              >
                <div className="flex items-start gap-2">
                  {getFileIcon(doc.mimeType, doc.name)}
                  <p className="text-sm font-medium text-zinc-200 line-clamp-2 group-hover:text-white transition-colors leading-tight">
                    {doc.name}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-auto">
                  {doc.aiCategory && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-900/30 border border-indigo-700/40 px-2 py-0.5 text-[10px] text-indigo-300">
                      <Sparkles className="h-2.5 w-2.5" />
                      {doc.aiCategory}
                    </span>
                  )}
                  <p className="text-[11px] text-zinc-600 ml-auto">{formatRelative(doc.updatedAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ─── Quick actions ────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-zinc-500" />
          Quick actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/app/documents"
            className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 transition hover:border-blue-500/30 hover:bg-blue-500/5 group"
          >
            <span className="rounded-lg bg-blue-500/10 p-2.5 text-blue-400 group-hover:bg-blue-500/20 transition">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-200">Browse Documents</p>
              <p className="text-xs text-zinc-500 mt-0.5">Upload, organize, search</p>
            </div>
            <ArrowRight className="h-4 w-4 text-zinc-600 ml-auto group-hover:text-blue-400 transition" />
          </Link>
          <Link
            to="/app/chat"
            className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 transition hover:border-emerald-500/30 hover:bg-emerald-500/5 group"
          >
            <span className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400 group-hover:bg-emerald-500/20 transition">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-200">AI Chat</p>
              <p className="text-xs text-zinc-500 mt-0.5">Ask questions about files</p>
            </div>
            <ArrowRight className="h-4 w-4 text-zinc-600 ml-auto group-hover:text-emerald-400 transition" />
          </Link>
          {!isPersonal && (
            <Link
              to="/app/admin"
              className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 transition hover:border-violet-500/30 hover:bg-violet-500/5 group"
            >
              <span className="rounded-lg bg-violet-500/10 p-2.5 text-violet-400 group-hover:bg-violet-500/20 transition">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-zinc-200">Administration</p>
                <p className="text-xs text-zinc-500 mt-0.5">Members, roles, settings</p>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-600 ml-auto group-hover:text-violet-400 transition" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
