import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor, { OnMount } from "@monaco-editor/react";
import { useProjectStore } from "@/store/projectStore";
import { FileExplorer } from "./FileExplorer";
import { FileTabs } from "./FileTabs";
import { StatusBar } from "./StatusBar";
import { AiCodeSidebar } from "./AiCodeSidebar";
import { Button } from "@/components/common";
import { cn } from "@/utils/cn";
import {
  PanelLeftClose,
  PanelLeft,
  Plus,
  Save,
  Sparkles,
  Folder,
  MessageSquare,
} from "lucide-react";

const WELCOME_CODE = `// Welcome to ai for all — AI Coding Assistant
// Open a file from the explorer or create a new project
`;

export function EditorPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const currentProject = useProjectStore((s) => s.currentProject);
  const openTabs = useProjectStore((s) => s.openTabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const isLoading = useProjectStore((s) => s.isLoading);
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const openProject = useProjectStore((s) => s.openProject);
  const createProject = useProjectStore((s) => s.createProject);
  const updateFileContent = useProjectStore((s) => s.updateFileContent);
  const saveCurrentFile = useProjectStore((s) => s.saveCurrentFile);
  const closeFile = useProjectStore((s) => s.closeFile);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);

  const [showExplorer, setShowExplorer] = useState(true);
  const [showAiSidebar, setShowAiSidebar] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectLang, setNewProjectLang] = useState("typescript");

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (projectId && !currentProject) {
      openProject(projectId);
    }
  }, [projectId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "w") {
        e.preventDefault();
        if (activeTabId) {
          const tab = openTabs.find((t) => t.id === activeTabId);
          if (tab) closeFile(tab.path);
        }
      }
      if (ctrl && e.key === "Tab") {
        e.preventDefault();
        if (openTabs.length > 1) {
          const idx = openTabs.findIndex((t) => t.id === activeTabId);
          const next = (idx + 1) % openTabs.length;
          setActiveTab(openTabs[next].id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTabId, openTabs, closeFile, setActiveTab]);

  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const code = activeTab?.content ?? WELCOME_CODE;
  const language = activeTab?.language ?? "typescript";

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (activeTab && value !== undefined) {
        updateFileContent(activeTab.path, value);
      }
    },
    [activeTab, updateFileContent]
  );

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.focus();

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveCurrentFile();
    });
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const id = await createProject(newProjectName.trim(), newProjectLang);
    if (id) {
      setShowProjectPicker(false);
      setNewProjectName("");
      navigate(`/editor/${id}`);
    }
  };

  const handleOpenProject = async (id: string) => {
    setShowProjectPicker(false);
    navigate(`/editor/${id}`);
  };

  const handleGoToChat = () => {
    navigate("/");
  };

  const getSelectedText = useCallback(() => {
    return editorRef.current?.getModel()?.getValueInRange(editorRef.current.getSelection()!) || "";
  }, []);

  const handleApplyCode = useCallback((code: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (selection && !selection.isEmpty()) {
      editor.executeEdits("ai-apply", [
        { range: selection, text: code, forceMoveMarkers: true },
      ]);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowExplorer(!showExplorer)}
            className="btn-ghost p-1.5"
            title={showExplorer ? "Close Explorer" : "Open Explorer"}
          >
            {showExplorer ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setShowProjectPicker(true)}
            className="btn-ghost p-1.5"
            title="Open Project"
          >
            <Folder className="h-4 w-4" />
          </button>
          {currentProject && (
            <>
              <span className="text-xs font-medium text-surface-500 mx-2">
                {currentProject.name}
              </span>
              <button
                onClick={saveCurrentFile}
                className="btn-ghost p-1.5"
                title="Save (Ctrl+S)"
              >
                <Save className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAiSidebar(!showAiSidebar)}
            className={cn("btn-ghost p-1.5", showAiSidebar && "bg-primary-50 dark:bg-primary-950 text-primary-500")}
            title={showAiSidebar ? "Close AI Assistant" : "AI Assistant"}
          >
            <Sparkles className="h-4 w-4" />
          </button>
          <button
            onClick={handleGoToChat}
            className="btn-ghost p-1.5"
            title="Chat"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* File Explorer */}
        {showExplorer && (
          <div className="w-56 border-r border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 overflow-hidden flex-shrink-0">
            {currentProject ? (
              <FileExplorer />
            ) : (
              <div className="p-4 text-xs text-surface-500 text-center">
                <p>No project open</p>
                <button
                  onClick={() => setShowProjectPicker(true)}
                  className="btn-primary mt-2 text-xs px-3 py-1.5"
                >
                  Open Project
                </button>
              </div>
            )}
          </div>
        )}

        {/* AI Sidebar */}
        {showAiSidebar && (
          <div className="w-72 border-l border-surface-200 dark:border-surface-700 overflow-hidden flex-shrink-0">
            <AiCodeSidebar
              onApplyCode={handleApplyCode}
              getSelectedText={getSelectedText}
            />
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <FileTabs />
          <div className="flex-1">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <Editor
                height="100%"
                language={language}
                value={code}
                onChange={handleEditorChange}
                theme="vs-dark"
                onMount={handleEditorMount}
                options={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: true },
                  lineNumbers: "on",
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  tabSize: 2,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  padding: { top: 16 },
                }}
              />
            )}
          </div>
        </div>
      </div>

      <StatusBar />

      {/* Project Picker Modal */}
      {showProjectPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowProjectPicker(false)}
        >
          <div
            className="w-96 max-h-[70vh] bg-white dark:bg-surface-800 rounded-xl shadow-2xl border border-surface-200 dark:border-surface-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-surface-200 dark:border-surface-700">
              <h2 className="text-sm font-semibold">Projects</h2>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  className="input flex-1 h-8 text-xs"
                  placeholder="New project name..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                />
                <select
                  className="input h-8 text-xs w-28"
                  value={newProjectLang}
                  onChange={(e) => setNewProjectLang(e.target.value)}
                >
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="html">HTML</option>
                </select>
                <Button size="sm" onClick={handleCreateProject}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="space-y-1 max-h-60 overflow-y-auto">
                {projects.length === 0 ? (
                  <p className="text-xs text-surface-500 text-center py-4">
                    No projects yet. Create one above.
                  </p>
                ) : (
                  projects.map((p) => (
                    <button
                      key={p.id}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2",
                        currentProject?.id === p.id
                          ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
                          : "hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300"
                      )}
                      onClick={() => handleOpenProject(p.id)}
                    >
                      <Folder className="h-4 w-4 text-yellow-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-surface-400">
                          {p.language} &middot; {p.files} files
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


