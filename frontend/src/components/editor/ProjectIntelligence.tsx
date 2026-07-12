import { useState, useCallback } from "react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/common";
import api from "@/services/api";
import { useProjectStore } from "@/store/projectStore";
import {
  Brain,
  Loader2,
  Search,
  GitBranch,
  CopyCheck,
  FolderTree,
  BookOpen,
  RefreshCw,
} from "lucide-react";

interface SearchResult {
  file: string;
  line: number;
  content: string;
  match: string;
}

interface Duplicate {
  file1: string;
  file2: string;
  similarity: number;
  lines: number;
}

interface Relationship {
  source: string;
  target: string;
  type: string;
}

interface Dependency {
  file: string;
  imports: string[];
  exports: string[];
  language: string;
}

type Tab = "summary" | "deps" | "search" | "duplicates" | "relationships";

export function ProjectIntelligence() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [deps, setDeps] = useState<Dependency[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchType, setSearchType] = useState<string>("");
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [searching, setSearching] = useState(false);
  const [indexed, setIndexed] = useState(false);

  const projectId = currentProject?.id;

  const handleIndex = useCallback(async () => {
    if (!projectId) return;
    setIndexing(true);
    try {
      const { data } = await api.post(`/intelligence/${projectId}/index`);
      setIndexed(data.data.indexed);
      setSummary(data.data);
    } catch { /* ignore */ }
    setIndexing(false);
  }, [projectId]);

  const handleLoadSummary = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/intelligence/${projectId}/summary`);
      setSummary(data.data);
      setIndexed(!!data.data.indexedAt);
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId]);

  const handleLoadDeps = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/intelligence/${projectId}/dependencies`);
      setDeps(data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId]);

  const handleSearch = useCallback(async () => {
    if (!projectId || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data } = await api.post(`/intelligence/${projectId}/search`, {
        query: searchQuery,
        type: searchType || undefined,
      });
      setSearchResults(data.data.results || []);
      setSearchTotal(data.data.total || 0);
    } catch { /* ignore */ }
    setSearching(false);
  }, [projectId, searchQuery, searchType]);

  const handleLoadDuplicates = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/intelligence/${projectId}/duplicates`);
      setDuplicates(data.data.duplicates || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId]);

  const handleLoadRelationships = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/intelligence/${projectId}/relationships`);
      setRelationships(data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "summary", label: "Summary", icon: <BookOpen className="h-3.5 w-3.5" /> },
    { key: "deps", label: "Deps", icon: <GitBranch className="h-3.5 w-3.5" /> },
    { key: "search", label: "Search", icon: <Search className="h-3.5 w-3.5" /> },
    { key: "duplicates", label: "Duplicates", icon: <CopyCheck className="h-3.5 w-3.5" /> },
    { key: "relationships", label: "Relations", icon: <FolderTree className="h-3.5 w-3.5" /> },
  ];

  if (!currentProject) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <Brain className="h-8 w-8 text-surface-300 dark:text-surface-600 mb-2" />
        <p className="text-xs text-surface-400">Open a project to see intelligence</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-50 dark:bg-surface-900">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-200 dark:border-surface-700">
        <Brain className="h-4 w-4 text-primary-500" />
        <span className="text-xs font-medium text-surface-700 dark:text-surface-300">
          Project Intelligence
        </span>
      </div>

      <div className="flex gap-1 px-2 py-1.5 border-b border-surface-200 dark:border-surface-700 overflow-x-auto">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px] whitespace-nowrap transition-colors",
              activeTab === key
                ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
                : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!indexed && activeTab !== "search" && (
          <div className="text-center py-4">
            <p className="text-xs text-surface-400 mb-2">Project not indexed yet</p>
            <Button size="sm" onClick={handleIndex} loading={indexing}>
              <RefreshCw className="h-3 w-3 mr-1" /> Index Project
            </Button>
          </div>
        )}

        {activeTab === "summary" && indexed && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary-500" /></div>
            ) : summary ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-lg bg-surface-100 dark:bg-surface-800 text-center">
                    <div className="text-lg font-bold text-primary-500">{summary.files as number}</div>
                    <div className="text-[10px] text-surface-400">Files</div>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-100 dark:bg-surface-800 text-center">
                    <div className="text-lg font-bold text-primary-500">{summary.lines as number}</div>
                    <div className="text-[10px] text-surface-400">Lines</div>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-surface-100 dark:bg-surface-800">
                  <div className="text-[10px] text-surface-400 mb-1">Languages</div>
                  <div className="flex flex-wrap gap-1">
                    {(summary.languages as string[] || []).map((lang) => (
                      <span key={lang} className="px-2 py-0.5 rounded text-[10px] bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400">{lang}</span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <Button size="sm" className="w-full" onClick={handleLoadSummary}>Load Summary</Button>
            )}
          </div>
        )}

        {activeTab === "deps" && (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={handleLoadDeps} loading={loading}>
              <GitBranch className="h-3 w-3 mr-1" /> Load Dependencies
            </Button>
            {deps.length > 0 && (
              <p className="text-[10px] text-surface-400">{deps.length} files analyzed</p>
            )}
            {deps.filter((d) => d.imports.length > 0).slice(0, 20).map((dep) => (
              <div key={dep.file} className="p-2 rounded bg-surface-100 dark:bg-surface-800">
                <div className="text-[10px] font-medium text-surface-600 dark:text-surface-400 mb-1">{dep.file}</div>
                {dep.imports.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {dep.imports.slice(0, 5).map((imp, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">{imp}</span>
                    ))}
                    {dep.imports.length > 5 && <span className="text-[9px] text-surface-400">+{dep.imports.length - 5} more</span>}
                  </div>
                )}
              </div>
            ))}
            {deps.length === 0 && !loading && <p className="text-xs text-surface-400 text-center py-4">No dependencies found. Index first.</p>}
          </div>
        )}

        {activeTab === "search" && (
          <div className="space-y-3">
            <div className="flex gap-1">
              <input
                className="input flex-1 h-7 text-xs"
                placeholder="Search across files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button size="sm" onClick={handleSearch} loading={searching}>
                <Search className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex gap-1">
              {["", "import", "export"].map((t) => (
                <button
                  key={t}
                  onClick={() => setSearchType(t)}
                  className={cn("px-2 py-0.5 rounded text-[10px] transition-colors",
                    searchType === t
                      ? "bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400"
                      : "text-surface-400 hover:text-surface-600"
                  )}
                >
                  {t || "All"}
                </button>
              ))}
            </div>
            {searchResults.length > 0 && (
              <p className="text-[10px] text-surface-400">{searchTotal} results</p>
            )}
            {searchResults.slice(0, 30).map((r, i) => (
              <div key={i} className="p-2 rounded bg-surface-100 dark:bg-surface-800">
                <div className="text-[10px] font-medium text-surface-500">{r.file}:{r.line}</div>
                <code className="text-[10px] text-surface-700 dark:text-surface-300 block mt-0.5">{r.content.slice(0, 100)}</code>
              </div>
            ))}
          </div>
        )}

        {activeTab === "duplicates" && (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={handleLoadDuplicates} loading={loading}>
              <CopyCheck className="h-3 w-3 mr-1" /> Find Duplicates
            </Button>
            {duplicates.map((d, i) => (
              <div key={i} className="p-2 rounded bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-red-600 dark:text-red-400">{d.similarity}% similar</span>
                  <span className="text-[9px] text-red-400">{d.lines} lines</span>
                </div>
                <div className="text-[10px] text-red-600 dark:text-red-400">{d.file1}</div>
                <div className="text-[10px] text-red-600 dark:text-red-400">{d.file2}</div>
              </div>
            ))}
            {duplicates.length === 0 && !loading && <p className="text-xs text-surface-400 text-center py-4">No duplicates found</p>}
          </div>
        )}

        {activeTab === "relationships" && (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={handleLoadRelationships} loading={loading}>
              <FolderTree className="h-3 w-3 mr-1" /> Load Relationships
            </Button>
            {relationships.map((r, i) => (
              <div key={i} className="p-2 rounded bg-surface-100 dark:bg-surface-800">
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-surface-700 dark:text-surface-300">{r.source}</span>
                  <span className="text-primary-500">→</span>
                  <span className="text-surface-700 dark:text-surface-300">{r.target}</span>
                </div>
              </div>
            ))}
            {relationships.length === 0 && !loading && <p className="text-xs text-surface-400 text-center py-4">No relationships found. Index first.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
