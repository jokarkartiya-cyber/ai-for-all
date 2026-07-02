import { useProjectStore } from "@/store/projectStore";

export function StatusBar() {
  const openTabs = useProjectStore((s) => s.openTabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const currentProject = useProjectStore((s) => s.currentProject);

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex items-center justify-between px-4 py-1 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-xs text-surface-500">
      <div className="flex items-center gap-3">
        {activeTab && (
          <>
            <span>{activeTab.name}</span>
            <span className="text-surface-300">|</span>
            <span>{activeTab.language}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        {currentProject && (
          <>
            <span>{currentProject.language}</span>
            <span className="text-surface-300">|</span>
          </>
        )}
        <span>UTF-8</span>
        <span className="text-surface-300">|</span>
        <span>Spaces: 2</span>
      </div>
    </div>
  );
}
