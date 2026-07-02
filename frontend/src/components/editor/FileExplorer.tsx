import { useState } from "react";
import { cn } from "@/utils/cn";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FileJson,
  FileText,
  FileCode,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react";
import type { ProjectFile } from "@shared/types/project";
import { useProjectStore } from "@/store/projectStore";

const extensionIcons: Record<string, React.ReactNode> = {
  ".ts": <FileCode className="h-4 w-4 text-blue-500" />,
  ".tsx": <FileCode className="h-4 w-4 text-blue-500" />,
  ".js": <FileCode className="h-4 w-4 text-yellow-500" />,
  ".jsx": <FileCode className="h-4 w-4 text-yellow-500" />,
  ".py": <FileCode className="h-4 w-4 text-green-500" />,
  ".html": <FileCode className="h-4 w-4 text-orange-500" />,
  ".css": <FileCode className="h-4 w-4 text-pink-500" />,
  ".json": <FileJson className="h-4 w-4 text-yellow-500" />,
  ".md": <FileText className="h-4 w-4 text-surface-400" />,
};

function getFileIcon(entry: ProjectFile): React.ReactNode {
  if (entry.isDirectory) return undefined;
  const icon = extensionIcons[entry.extension];
  return icon || <File className="h-4 w-4 text-surface-400" />;
}

function FileTreeItem({
  entry,
  depth = 0,
  onContextMenu,
  renaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  creating,
  createValue,
  onCreateValueChange,
  onCreateSubmit,
  onCreateCancel,
}: {
  entry: ProjectFile;
  depth?: number;
  onContextMenu?: (e: React.MouseEvent, entry: ProjectFile) => void;
  renaming?: string | null;
  renameValue?: string;
  onRenameChange?: (v: string) => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;
  creating?: { parentPath: string; type: "file" | "folder" } | null;
  createValue?: string;
  onCreateValueChange?: (v: string) => void;
  onCreateSubmit?: () => void;
  onCreateCancel?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const openFile = useProjectStore((s) => s.openFile);
  const openTabs = useProjectStore((s) => s.openTabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);

  const isRenaming = renaming === entry.path;
  const isCreatingHere = creating?.parentPath === entry.path;

  const isActive = entry.isDirectory
    ? false
    : openTabs.some((t) => t.id === activeTabId && t.path === entry.path);

  const handleClick = () => {
    if (entry.isDirectory) {
      setExpanded(!expanded);
    } else {
      openFile(entry.path, entry.name);
    }
  };

  const icon = entry.isDirectory ? (
    expanded ? (
      <FolderOpen className="h-4 w-4 text-yellow-500" />
    ) : (
      <Folder className="h-4 w-4 text-yellow-500" />
    )
  ) : (
    getFileIcon(entry)
  );

  const showCreateInput = isCreatingHere && !isRenaming;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm transition-colors",
          isActive
            ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
            : "hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={isRenaming ? undefined : handleClick}
        onContextMenu={(e) => onContextMenu?.(e, entry)}
      >
        {entry.isDirectory && !isRenaming && (
          <span className="shrink-0">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-surface-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-surface-400" />
            )}
          </span>
        )}
        {!isRenaming && icon}
        {isRenaming ? (
          <input
            className="input h-6 text-xs flex-1"
            value={renameValue || ""}
            onChange={(e) => onRenameChange?.(e.target.value)}
            onBlur={onRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSubmit?.();
              if (e.key === "Escape") onRenameCancel?.();
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate flex-1 text-xs">{entry.name}</span>
        )}
      </div>
      {(expanded || showCreateInput) && entry.isDirectory && (
        <div>
          {showCreateInput && (
            <div
              className="flex items-center gap-1 px-2 py-1"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              {creating?.type === "folder" ? (
                <Folder className="h-4 w-4 text-yellow-500 shrink-0" />
              ) : (
                <File className="h-4 w-4 text-surface-400 shrink-0" />
              )}
              <input
                className="input h-6 text-xs flex-1"
                value={createValue || ""}
                onChange={(e) => onCreateValueChange?.(e.target.value)}
                onBlur={onCreateSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCreateSubmit?.();
                  if (e.key === "Escape") onCreateCancel?.();
                }}
                autoFocus
                placeholder={`New ${creating?.type}...`}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          {entry.children?.map((child) => (
            <FileTreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              onContextMenu={onContextMenu}
              renaming={renaming}
              renameValue={renameValue}
              onRenameChange={onRenameChange}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              creating={creating}
              createValue={createValue}
              onCreateValueChange={onCreateValueChange}
              onCreateSubmit={onCreateSubmit}
              onCreateCancel={onCreateCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileExplorer() {
  const fileTree = useProjectStore((s) => s.fileTree);
  const currentProject = useProjectStore((s) => s.currentProject);
  const createFile = useProjectStore((s) => s.createFile);
  const createFolder = useProjectStore((s) => s.createFolder);
  const deleteFileEntry = useProjectStore((s) => s.deleteFileEntry);
  const renameFileEntry = useProjectStore((s) => s.renameFileEntry);
  const loadFileTree = useProjectStore((s) => s.loadFileTree);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: ProjectFile | null;
  } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [creating, setCreating] = useState<{ parentPath: string; type: "file" | "folder" } | null>(null);
  const [createValue, setCreateValue] = useState("");

  const handleContextMenu = (e: React.MouseEvent, entry: ProjectFile) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleRename = (entry: ProjectFile) => {
    setRenaming(entry.path);
    setRenameValue(entry.name);
    closeContextMenu();
  };

  const handleRenameSubmit = async () => {
    if (renaming && renameValue) {
      const parts = renaming.split("/");
      parts[parts.length - 1] = renameValue;
      await renameFileEntry(renaming, parts.join("/"));
    }
    setRenaming(null);
  };

  const handleDelete = async (entry: ProjectFile) => {
    await deleteFileEntry(entry.path);
    closeContextMenu();
  };

  const handleCreateStart = (parentPath: string, type: "file" | "folder") => {
    setCreating({ parentPath, type });
    setCreateValue("");
    closeContextMenu();
  };

  const handleCreateSubmit = async () => {
    if (creating && createValue) {
      const fullPath = creating.parentPath
        ? `${creating.parentPath}/${createValue}`
        : createValue;
      if (creating.type === "folder") {
        await createFolder(fullPath);
      } else {
        await createFile(fullPath);
      }
    }
    setCreating(null);
    setCreateValue("");
  };

  if (!currentProject) return null;

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      onClick={closeContextMenu}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-200 dark:border-surface-700">
        <span className="text-xs font-medium text-surface-500">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => handleCreateStart("", "file")}
            className="btn-ghost p-1"
            title="New File"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleCreateStart("", "folder")}
            className="btn-ghost p-1"
            title="New Folder"
          >
            <Folder className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={loadFileTree}
            className="btn-ghost p-1"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {creating && creating.parentPath === "" && (
          <div className="flex items-center gap-1 px-2 py-1">
            {creating.type === "folder" ? (
              <Folder className="h-4 w-4 text-yellow-500" />
            ) : (
              <File className="h-4 w-4 text-surface-400" />
            )}
            <input
              className="input h-6 text-xs flex-1"
              value={createValue}
              onChange={(e) => setCreateValue(e.target.value)}
              onBlur={handleCreateSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateSubmit();
                if (e.key === "Escape") setCreating(null);
              }}
              autoFocus
              placeholder={`New ${creating.type}...`}
            />
          </div>
        )}
        {fileTree.map((entry) => (
          <FileTreeItem
            key={entry.path}
            entry={entry}
            onContextMenu={handleContextMenu}
            renaming={renaming}
            renameValue={renameValue}
            onRenameChange={setRenameValue}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={() => setRenaming(null)}
            creating={creating}
            createValue={createValue}
            onCreateValueChange={setCreateValue}
            onCreateSubmit={handleCreateSubmit}
            onCreateCancel={() => setCreating(null)}
          />
        ))}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 min-w-40 py-1 bg-white dark:bg-surface-800 rounded-lg shadow-lg border border-surface-200 dark:border-surface-700"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.entry?.isDirectory && (
            <>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300"
                onClick={() => handleCreateStart(contextMenu.entry!.path, "file")}
              >
                <File className="h-3.5 w-3.5" /> New File
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300"
                onClick={() => handleCreateStart(contextMenu.entry!.path, "folder")}
              >
                <Folder className="h-3.5 w-3.5" /> New Folder
              </button>
              <div className="border-t border-surface-200 dark:border-surface-700 my-1" />
            </>
          )}
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300"
            onClick={() => contextMenu.entry && handleRename(contextMenu.entry)}
          >
            <Pencil className="h-3.5 w-3.5" /> Rename
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-100 dark:hover:bg-surface-700 text-red-500"
            onClick={() => contextMenu.entry && handleDelete(contextMenu.entry)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
