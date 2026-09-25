import React from "react";
import {
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  Layers,
  Archive,
} from "lucide-react";

export const FolderTree = ({
  folders = [],
  selectedFolderId,
  onSelectFolder,
  activeTab, // "files" | "trash"
  onSelectTab,
  onOpenCreateModal,
  onOpenRenameModal,
  onOpenDeleteModal,
}) => {
  const [expanded, setExpanded] = React.useState({});

  const toggleExpand = (folderId, e) => {
    e.stopPropagation();
    setExpanded((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Build tree from flat folders list
  const folderTree = React.useMemo(() => {
    const map = {};
    const roots = [];

    folders.forEach((f) => {
      map[f._id] = { ...f, children: [] };
    });

    folders.forEach((f) => {
      if (f.parentId && map[f.parentId]) {
        map[f.parentId].children.push(map[f._id]);
      } else {
        roots.push(map[f._id]);
      }
    });

    return roots;
  }, [folders]);

  const renderFolderNode = (node, depth = 0) => {
    const isSelected = activeTab === "files" && selectedFolderId === node._id;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded[node._id] ?? true; // default expanded

    return (
      <div key={node._id} className="select-none">
        <div
          onClick={() => {
            onSelectTab("files");
            onSelectFolder(node._id);
          }}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={`group flex items-center justify-between rounded-lg py-1.5 pr-2 text-sm transition-all cursor-pointer ${
            isSelected
              ? "bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30"
              : "text-zinc-300 hover:bg-zinc-800/70 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node._id, e)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="w-3.5" />
            )}
            {isSelected ? (
              <FolderOpen className="h-4 w-4 text-blue-400 shrink-0" />
            ) : (
              <FolderIcon className="h-4 w-4 text-zinc-400 group-hover:text-zinc-200 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              title="Create subfolder"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreateModal(node._id);
              }}
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-700/60"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
            <button
              title="Rename folder"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenRenameModal(node);
              }}
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-700/60"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              title="Delete folder"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDeleteModal(node);
              }}
              className="p-1 text-zinc-400 hover:text-rose-400 rounded hover:bg-zinc-700/60"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-0.5 space-y-0.5">
            {node.children.map((child) => renderFolderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="flex w-full flex-col gap-3 rounded-xl border border-zinc-800/90 bg-zinc-900/45 p-3 lg:w-64 lg:shrink-0">
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-1 pb-3">
        <div>
          <p className="text-sm font-semibold text-zinc-200">My files</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Browse your workspace</p>
        </div>
        <button
          onClick={() => onOpenCreateModal(null)}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700/80 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          New folder
        </button>
      </div>

      <div className="space-y-1 text-sm">
        {/* All Files (Global view) */}
        <div
          onClick={() => {
            onSelectTab("files");
            onSelectFolder("all");
          }}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-pointer transition-all ${
            activeTab === "files" && selectedFolderId === "all"
              ? "bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30"
              : "text-zinc-300 hover:bg-zinc-800/70 hover:text-white"
          }`}
        >
          <Layers className="h-4 w-4 text-blue-400 shrink-0" />
          <span>All Documents</span>
        </div>

        {/* Root level files */}
        <div
          onClick={() => {
            onSelectTab("files");
            onSelectFolder(null);
          }}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-pointer transition-all ${
            activeTab === "files" && selectedFolderId === null
              ? "bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30"
              : "text-zinc-300 hover:bg-zinc-800/70 hover:text-white"
          }`}
        >
          <Archive className="h-4 w-4 text-indigo-400 shrink-0" />
          <span>Root Directory</span>
        </div>
      </div>

      {/* Folder Tree Hierarchy */}
      <div className="flex-1 space-y-0.5 overflow-y-auto pr-1 lg:max-h-[calc(100vh-24rem)]">
        {folders.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-zinc-500">
            No folders created yet.
          </p>
        ) : (
          folderTree.map((rootNode) => renderFolderNode(rootNode, 0))
        )}
      </div>

      {/* Trash Section */}
      <div className="border-t border-zinc-800/80 pt-2">
        <div
          onClick={() => onSelectTab("trash")}
          className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer transition-all text-sm ${
            activeTab === "trash"
              ? "bg-rose-500/20 text-rose-300 font-medium border border-rose-500/30"
              : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Trash2 className="h-4 w-4 text-rose-400 shrink-0" />
            <span>Trash / Deleted</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
