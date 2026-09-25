/** Full-page loading spinner — used during initial auth check */
export const Loading = () => (
  <div className="flex min-h-screen items-center justify-center bg-zinc-950">
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
        <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 animate-spin" />
      </div>
      <p className="text-xs font-medium text-zinc-600 tracking-wide">Loading…</p>
    </div>
  </div>
);

/** Inline spinner for buttons */
export const LoadingAnimation = () => (
  <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
);