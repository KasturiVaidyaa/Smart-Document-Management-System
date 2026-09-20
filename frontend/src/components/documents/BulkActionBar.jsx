import React from "react";
import {
  FolderInput,
  Trash2,
  RotateCcw,
  AlertOctagon,
  X,
  CheckSquare,
} from "lucide-react";

export const BulkActionBar = ({
  selectedCount = 0,
  activeTab = "files", // "files" | "trash"
  onClearSelection,
  onBulkMove,
  onBulkTrash,
  onBulkRestore,
  onBulkPermanentDelete,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-zinc-700/80 bg-zinc-900/95 px-5 py-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2 pr-3 border-r border-zinc-700">
        <CheckSquare className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-semibold text-zinc-100">
          {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
        </span>
      </div>

      <div className="flex items-center gap-2">
        {activeTab === "files" ? (
          <>
            <button
              onClick={onBulkMove}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <FolderInput className="h-3.5 w-3.5 text-blue-400" />
              <span>Move to Folder</span>
            </button>
            <button
              onClick={onBulkTrash}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Move to Trash</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onBulkRestore}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restore</span>
            </button>
            <button
              onClick={onBulkPermanentDelete}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500 transition-colors"
            >
              <AlertOctagon className="h-3.5 w-3.5" />
              <span>Delete Permanently</span>
            </button>
          </>
        )}

        <button
          title="Clear selection"
          onClick={onClearSelection}
          className="ml-2 rounded-lg p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
