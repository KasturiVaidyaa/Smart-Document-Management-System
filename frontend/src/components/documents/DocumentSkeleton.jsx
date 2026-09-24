/**
 * DocumentSkeleton — animated loading skeleton for document list rows.
 * Replaces the plain "Loading documents..." text while data is being fetched.
 */
export const DocumentSkeleton = ({ count = 6 }) => {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-sm">
      {/* Table Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/40 px-4 py-2.5">
        <div className="h-3 w-24 rounded bg-zinc-700/60 animate-pulse" />
        <div className="h-3 w-16 rounded bg-zinc-700/60 animate-pulse" />
      </div>
      {/* Skeleton Rows */}
      <ul className="divide-y divide-zinc-800/80">
        {Array.from({ length: count }).map((_, i) => (
          <li key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Checkbox skeleton */}
              <div className="h-4 w-4 rounded bg-zinc-700/60 animate-pulse shrink-0" />
              {/* File icon skeleton */}
              <div className="h-5 w-5 rounded bg-zinc-700/60 animate-pulse shrink-0" />
              <div className="space-y-2 flex-1 min-w-0">
                {/* File name */}
                <div
                  className="h-3.5 rounded bg-zinc-700/60 animate-pulse"
                  style={{ width: `${55 + (i % 3) * 15}%`, animationDelay: `${i * 80}ms` }}
                />
                {/* Meta line */}
                <div
                  className="h-2.5 rounded bg-zinc-800/80 animate-pulse"
                  style={{ width: `${30 + (i % 4) * 10}%`, animationDelay: `${i * 80 + 40}ms` }}
                />
              </div>
            </div>
            {/* Action buttons skeleton */}
            <div className="flex items-center gap-1.5 shrink-0">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="h-7 w-16 rounded-md bg-zinc-800/60 animate-pulse"
                  style={{ animationDelay: `${(i * 3 + j) * 50}ms` }}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DocumentSkeleton;
