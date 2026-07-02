import { useProjectStore, type EditorTab } from "@/store/projectStore";
import { cn } from "@/utils/cn";
import { X, FileCode, File, Circle } from "lucide-react";

const extensionIcons: Record<string, React.ReactNode> = {
  ts: <FileCode className="h-3.5 w-3.5 text-blue-500" />,
  tsx: <FileCode className="h-3.5 w-3.5 text-blue-500" />,
  js: <FileCode className="h-3.5 w-3.5 text-yellow-500" />,
  jsx: <FileCode className="h-3.5 w-3.5 text-yellow-500" />,
  py: <FileCode className="h-3.5 w-3.5 text-green-500" />,
  html: <FileCode className="h-3.5 w-3.5 text-orange-500" />,
  css: <FileCode className="h-3.5 w-3.5 text-pink-500" />,
  json: <FileCode className="h-3.5 w-3.5 text-yellow-500" />,
  md: <FileCode className="h-3.5 w-3.5 text-surface-400" />,
};

function getTabIcon(tab: EditorTab) {
  const ext = tab.name.split(".").pop()?.toLowerCase() || "";
  return extensionIcons[ext] || <File className="h-3.5 w-3.5 text-surface-400" />;
}

export function FileTabs() {
  const openTabs = useProjectStore((s) => s.openTabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const closeFile = useProjectStore((s) => s.closeFile);

  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center overflow-x-auto border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900">
      {openTabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            "group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-surface-200 dark:border-surface-700 select-none",
            "transition-colors min-w-0 max-w-48",
            tab.id === activeTabId
              ? "bg-white dark:bg-surface-800 text-surface-900 dark:text-white border-t-2 border-t-primary-500"
              : "bg-surface-50 dark:bg-surface-900 text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
          )}
          onClick={() => setActiveTab(tab.id)}
        >
          {getTabIcon(tab)}
          <span className="truncate">{tab.name}</span>
          {tab.isDirty && (
            <Circle className="h-2.5 w-2.5 text-surface-400 fill-current shrink-0" />
          )}
          <button
            className={cn(
              "shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-surface-200 dark:hover:bg-surface-700",
              tab.id === activeTabId && "opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              closeFile(tab.path);
            }}
            title="Close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
