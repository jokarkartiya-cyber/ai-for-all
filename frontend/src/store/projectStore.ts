import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Project, ProjectFile } from "@shared/types/project";
import api from "@/services/api";

export interface EditorTab {
  id: string;
  path: string;
  name: string;
  language: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  fileTree: ProjectFile[];
  openTabs: EditorTab[];
  activeTabId: string | null;
  isLoading: boolean;

  isSplit: boolean;
  secondaryTabId: string | null;

  loadProjects: () => Promise<void>;
  createProject: (name: string, language?: string) => Promise<string | null>;
  openProject: (id: string) => Promise<void>;
  closeProject: () => void;
  deleteProject: (id: string) => Promise<void>;

  loadFileTree: () => Promise<void>;
  openFile: (filePath: string, name: string) => Promise<void>;
  closeFile: (filePath: string) => void;
  setActiveTab: (tabId: string) => void;
  updateFileContent: (filePath: string, content: string) => void;
  saveFile: (filePath: string) => Promise<void>;
  saveCurrentFile: () => Promise<void>;

  createFile: (filePath: string) => Promise<void>;
  createFolder: (filePath: string) => Promise<void>;
  deleteFileEntry: (filePath: string) => Promise<void>;
  renameFileEntry: (oldPath: string, newPath: string) => Promise<void>;

  toggleSplit: () => void;
  setSecondaryTab: (tabId: string) => void;
  closeSecondaryTab: () => void;
  openFileInSecondaryPane: (filePath: string, name: string) => Promise<void>;
}

const FILE_EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  py: "python", html: "html", css: "css", json: "json",
  md: "markdown", yaml: "yaml", yml: "yaml", xml: "xml",
  sql: "sql", sh: "shell", go: "go", rs: "rust",
  rb: "ruby", php: "php", java: "java", c: "c",
  cpp: "cpp", h: "c", hpp: "cpp",
};

function extToLang(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return FILE_EXT_TO_LANG[ext] || "plaintext";
}

export const useProjectStore = create<ProjectState>()(
  immer((set, get) => ({
    projects: [],
    currentProject: null,
    fileTree: [],
    openTabs: [],
    activeTabId: null,
    isLoading: false,
    isSplit: false,
    secondaryTabId: null,

    loadProjects: async () => {
      try {
        const { data } = await api.get("/projects");
        set((state) => { state.projects = data.data; });
      } catch {
        // silently fail
      }
    },

    createProject: async (name, language) => {
      try {
        const { data } = await api.post("/projects", { name, language });
        set((state) => {
          state.projects.unshift(data.data);
          state.currentProject = data.data;
          state.fileTree = data.data.fileTree || [];
          state.openTabs = [];
          state.activeTabId = null;
        });
        return data.data.id;
      } catch {
        return null;
      }
    },

    openProject: async (id) => {
      set((state) => { state.isLoading = true; });
      try {
        const [projRes, treeRes] = await Promise.all([
          api.get(`/projects/${id}`),
          api.get(`/projects/${id}/tree`),
        ]);
        set((state) => {
          state.currentProject = projRes.data.data;
          state.fileTree = treeRes.data.data;
          state.openTabs = [];
          state.activeTabId = null;
          state.isLoading = false;
        });
      } catch {
        set((state) => { state.isLoading = false; });
      }
    },

    closeProject: () => {
      set((state) => {
        state.currentProject = null;
        state.fileTree = [];
        state.openTabs = [];
        state.activeTabId = null;
      });
    },

    deleteProject: async (id) => {
      await api.delete(`/projects/${id}`);
      set((state) => {
        state.projects = state.projects.filter((p) => p.id !== id);
        if (state.currentProject?.id === id) {
          state.currentProject = null;
          state.fileTree = [];
          state.openTabs = [];
          state.activeTabId = null;
        }
      });
    },

    loadFileTree: async () => {
      const project = get().currentProject;
      if (!project) return;
      try {
        const { data } = await api.get(`/projects/${project.id}/tree`);
        set((state) => { state.fileTree = data.data; });
      } catch {
        // silently fail
      }
    },

    openFile: async (filePath, name) => {
      const project = get().currentProject;
      if (!project) return;

      const existing = get().openTabs.find((t) => t.path === filePath);
      if (existing) {
        set((state) => { state.activeTabId = existing.id; });
        return;
      }

      try {
        const { data } = await api.get(`/projects/${project.id}/read`, {
          params: { path: filePath },
        });
        const tab: EditorTab = {
          id: crypto.randomUUID(),
          path: filePath,
          name,
          language: data.data.language || extToLang(name),
          content: data.data.content,
          originalContent: data.data.content,
          isDirty: false,
        };
        set((state) => {
          state.openTabs.push(tab);
          state.activeTabId = tab.id;
        });
      } catch {
        // silently fail
      }
    },

    closeFile: (filePath) => {
      set((state) => {
        const idx = state.openTabs.findIndex((t) => t.path === filePath);
        if (idx === -1) return;
        const tabId = state.openTabs[idx].id;
        state.openTabs.splice(idx, 1);
        if (state.activeTabId === tabId) {
          state.activeTabId = state.openTabs[Math.min(idx, state.openTabs.length - 1)]?.id || null;
        } else if (state.openTabs.length === 0) {
          state.activeTabId = null;
        }
        if (state.secondaryTabId === tabId) {
          state.secondaryTabId = null;
        }
      });
    },

    setActiveTab: (tabId) => {
      set((state) => { state.activeTabId = tabId; });
    },

    updateFileContent: (filePath, content) => {
      set((state) => {
        const tab = state.openTabs.find((t) => t.path === filePath);
        if (tab) {
          tab.content = content;
          tab.isDirty = content !== tab.originalContent;
        }
      });
    },

    saveFile: async (filePath) => {
      const project = get().currentProject;
      if (!project) return;

      const tab = get().openTabs.find((t) => t.path === filePath);
      if (!tab || !tab.isDirty) return;

      try {
        await api.put(`/projects/${project.id}/write`, null, {
          params: { path: filePath },
          data: { content: tab.content },
        });
        set((state) => {
          const t = state.openTabs.find((t) => t.path === filePath);
          if (t) {
            t.originalContent = t.content;
            t.isDirty = false;
          }
        });
      } catch {
        // silently fail
      }
    },

    saveCurrentFile: async () => {
      const activeTab = get().openTabs.find((t) => t.id === get().activeTabId);
      if (activeTab) {
        await get().saveFile(activeTab.path);
      }
    },

    createFile: async (filePath) => {
      const project = get().currentProject;
      if (!project) return;
      await api.post(`/projects/${project.id}/create`, { type: "file" }, { params: { path: filePath } });
      await get().loadFileTree();
    },

    createFolder: async (filePath) => {
      const project = get().currentProject;
      if (!project) return;
      await api.post(`/projects/${project.id}/create`, { type: "directory" }, { params: { path: filePath } });
      await get().loadFileTree();
    },

    deleteFileEntry: async (filePath) => {
      const project = get().currentProject;
      if (!project) return;
      await api.delete(`/projects/${project.id}/delete`, { params: { path: filePath } });
      set((state) => {
        state.openTabs = state.openTabs.filter((t) => t.path !== filePath);
        if (state.openTabs.length === 0) state.activeTabId = null;
      });
      await get().loadFileTree();
    },

    renameFileEntry: async (oldPath, newPath) => {
      const project = get().currentProject;
      if (!project) return;
      await api.post(`/projects/${project.id}/rename`, { oldPath, newPath });
      set((state) => {
        state.openTabs = state.openTabs.map((t) =>
          t.path === oldPath ? { ...t, path: newPath, name: newPath.split("/").pop() || newPath } : t
        );
      });
      await get().loadFileTree();
    },

    toggleSplit: () => {
      set((state) => {
        state.isSplit = !state.isSplit;
        if (!state.isSplit) state.secondaryTabId = null;
      });
    },

    setSecondaryTab: (tabId) => {
      set((state) => { state.secondaryTabId = tabId; });
    },

    closeSecondaryTab: () => {
      set((state) => { state.secondaryTabId = null; });
    },

    openFileInSecondaryPane: async (filePath, name) => {
      const project = get().currentProject;
      if (!project) return;

      const existing = get().openTabs.find((t) => t.path === filePath);
      if (existing) {
        set((state) => { state.secondaryTabId = existing.id; });
        return;
      }

      try {
        const { data } = await api.get(`/projects/${project.id}/read`, {
          params: { path: filePath },
        });
        const tab: EditorTab = {
          id: crypto.randomUUID(),
          path: filePath,
          name,
          language: data.data.language || extToLang(name),
          content: data.data.content,
          originalContent: data.data.content,
          isDirty: false,
        };
        set((state) => {
          state.openTabs.push(tab);
          state.secondaryTabId = tab.id;
        });
      } catch {
        // silently fail
      }
    },
  }))
);
