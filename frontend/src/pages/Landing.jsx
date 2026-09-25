import { Link } from "react-router-dom";
import { FileText, Brain, Shield, Users, ArrowRight, FolderOpen, Zap, Lock } from "lucide-react";

const features = [
  {
    icon: Brain,
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    title: "AI-Powered Search",
    desc: "Ask natural language questions. The AI reads your documents and surfaces the exact answer with citations.",
  },
  {
    icon: Shield,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    title: "Granular Permissions",
    desc: "Control who can view, edit, download, or share — per document, folder, department, or role.",
  },
  {
    icon: FolderOpen,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    title: "Smart Organization",
    desc: "Folders, tags, departments, and AI-generated categories keep your workspace clean and navigable.",
  },
  {
    icon: Users,
    color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    title: "Team Collaboration",
    desc: "Invite members, assign roles, and share documents securely — with full audit logging.",
  },
  {
    icon: Zap,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    title: "Version Control",
    desc: "Every upload creates a new version. Restore any previous version at any time.",
  },
  {
    icon: Lock,
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    title: "Secure Share Links",
    desc: "Generate time-limited, password-protected share links for external stakeholders.",
  },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-950/40">
              <FileText className="h-4 w-4 text-white" />
            </span>
            <span className="text-sm font-bold tracking-tight">Smart Cloud DMS</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-950/30"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-20 pb-24 text-center">
        {/* decorative glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[700px] rounded-full bg-blue-600/8 blur-[120px]" />
          <div className="absolute left-1/4 top-20 h-48 w-48 rounded-full bg-indigo-600/8 blur-[80px]" />
          <div className="absolute right-1/4 top-32 h-36 w-36 rounded-full bg-violet-600/8 blur-[60px]" />
        </div>

        <div className="relative mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-300">
            <Brain className="h-3.5 w-3.5" />
            AI-powered document intelligence
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="text-zinc-100">Store, search, and </span>
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              collaborate
            </span>
            <br />
            <span className="text-zinc-100">on your documents</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-400 leading-relaxed sm:text-lg">
            One secure workspace with AI chat, version control, granular permissions,
            and smart search. Built for teams who take their documents seriously.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-blue-950/40 hover:bg-blue-500 transition-all hover:scale-105"
            >
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-8 py-3.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feature grid ────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-zinc-100 sm:text-3xl">
              Everything your team needs
            </h2>
            <p className="mt-3 text-zinc-500">
              From upload to insight in seconds.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 transition hover:border-zinc-700 hover:bg-zinc-900"
              >
                <span className={`inline-flex items-center justify-center rounded-xl border p-3 ${f.color}`}>
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-zinc-100">{f.title}</h3>
                <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ──────────────────────────────────────── */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-800 bg-gradient-to-br from-blue-950/50 via-zinc-900/60 to-zinc-950 p-12 text-center relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-72 rounded-full bg-blue-600/10 blur-[80px]" />
          </div>
          <h2 className="relative text-2xl font-bold text-zinc-100 sm:text-3xl">
            Ready to get started?
          </h2>
          <p className="relative mt-3 text-sm text-zinc-400">
            Create your free workspace in 30 seconds. No credit card required.
          </p>
          <Link
            to="/register"
            className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-blue-950/40 hover:bg-blue-500 transition-all hover:scale-105"
          >
            Create free account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/60 px-6 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600">
              <FileText className="h-3 w-3 text-white" />
            </span>
            <span className="text-xs font-semibold text-zinc-500">Smart Cloud DMS</span>
          </div>
          <p className="text-xs text-zinc-600">© {new Date().getFullYear()} Smart Cloud DMS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
