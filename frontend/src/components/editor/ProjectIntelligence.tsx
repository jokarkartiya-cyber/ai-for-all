import { useState, useCallback } from "react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/common";
import api from "@/services/api";
import { useProjectStore } from "@/store/projectStore";
import {
  Brain, Search, GitBranch, CopyCheck, FolderTree, BookOpen, RefreshCw, Skull,
  Folder, FileText, Crosshair, Lightbulb, Shuffle, Move, Map, Network, Table, CheckSquare, Target,
} from "lucide-react";

const TABS = [
  { key: "summary", label: "Summary", icon: BookOpen },
  { key: "deps", label: "Deps", icon: GitBranch },
  { key: "search", label: "Search", icon: Search },
  { key: "duplicates", label: "Duplicates", icon: CopyCheck },
  { key: "relationships", label: "Relations", icon: FolderTree },
  { key: "deadcode", label: "Dead Code", icon: Skull },
  { key: "folders", label: "Folders", icon: Folder },
  { key: "readmulti", label: "Read Files", icon: FileText },
  { key: "crossfile", label: "Cross File", icon: Crosshair },
  { key: "semantic", label: "Semantic", icon: Target },
  { key: "memory", label: "Memory", icon: Table },
  { key: "architecture", label: "Arch", icon: Map },
  { key: "depsgraph", label: "Dep Graph", icon: Network },
  { key: "suggestions", label: "Suggest", icon: Lightbulb },
  { key: "refactoring", label: "Refactor", icon: Shuffle },
  { key: "rename", label: "Rename", icon: FileText },
  { key: "move", label: "Move", icon: Move },
  { key: "plan", label: "Plan", icon: CheckSquare },
  { key: "review", label: "Review", icon: Target },
];

type Tab = (typeof TABS)[number]["key"];

export function ProjectIntelligence() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [deps, setDeps] = useState<{ file: string; imports: string[]; exports: string[]; language: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ file: string; line: number; content: string; match: string }[]>([]);
  const [searchType, setSearchType] = useState("");
  const [duplicates, setDuplicates] = useState<{ file1: string; file2: string; similarity: number; lines: number }[]>([]);
  const [relationships, setRelationships] = useState<{ source: string; target: string; type: string }[]>([]);
  const [deadCode, setDeadCode] = useState<{ file: string; type: string; name: string; line: number; reason: string }[]>([]);
  const [folders, setFolders] = useState<{ name: string; path: string; fileCount: number }[]>([]);
  const [multiFiles, setMultiFiles] = useState("");
  const [multiContent, setMultiContent] = useState<{ file: string; content: string; language: string }[]>([]);
  const [crossFile, setCrossFile] = useState<{ symbol: string; definedIn: string; usedIn: string[] }[]>([]);
  const [semanticQuery, setSemanticQuery] = useState("");
  const [semanticResults, setSemanticResults] = useState<{ file: string; score: number; matches: string[] }[]>([]);
  const [memory, setMemory] = useState<Record<string, unknown> | null>(null);
  const [archData, setArchData] = useState<Record<string, unknown> | null>(null);
  const [depGraph, setDepGraph] = useState<{ nodes: { id: string; label: string; group: string }[]; edges: { source: string; target: string; type: string }[] } | null>(null);
  const [suggestions, setSuggestions] = useState<{ file: string; line: number; type: string; suggestion: string }[]>([]);
  const [refactors, setRefactors] = useState<{ file: string; line: number; type: string; description: string; before: string; after: string }[]>([]);
  const [renameOld, setRenameOld] = useState("");
  const [renameNew, setRenameNew] = useState("");
  const [renameResult, setRenameResult] = useState<Record<string, unknown> | null>(null);
  const [moveSrc, setMoveSrc] = useState("");
  const [moveDst, setMoveDst] = useState("");
  const [moveResult, setMoveResult] = useState<Record<string, unknown> | null>(null);
  const [plan, setPlan] = useState<Record<string, unknown> | null>(null);
  const [review, setReview] = useState<Record<string, unknown> | null>(null);
  const [searching, setSearching] = useState(false);
  const [indexed, setIndexed] = useState(false);

  const projectId = currentProject?.id;

  const handleIndex = useCallback(async () => {
    if (!projectId) return; setIndexing(true);
    try { const { data } = await api.post(`/intelligence/${projectId}/index`); setIndexed(data.data.indexed); setSummary(data.data); } catch {}
    setIndexing(false);
  }, [projectId]);

  const handleLoad = useCallback(async (key: Tab) => {
    if (!projectId) return; setLoading(true);
    try {
      if (key === "summary") { const { data } = await api.get(`/intelligence/${projectId}/summary`); setSummary(data.data); setIndexed(!!data.data.indexedAt); }
      else if (key === "deps") { const { data } = await api.get(`/intelligence/${projectId}/dependencies`); setDeps(data.data || []); }
      else if (key === "duplicates") { const { data } = await api.get(`/intelligence/${projectId}/duplicates`); setDuplicates(data.data.duplicates || []); }
      else if (key === "relationships") { const { data } = await api.get(`/intelligence/${projectId}/relationships`); setRelationships(data.data || []); }
      else if (key === "deadcode") { const { data } = await api.get(`/intelligence/${projectId}/dead-code`); setDeadCode(data.data.deadItems || []); }
      else if (key === "folders") { const { data } = await api.get(`/intelligence/${projectId}/folders`); setFolders(data.data || []); }
      else if (key === "crossfile") { const { data } = await api.get(`/intelligence/${projectId}/cross-file`); setCrossFile(data.data.crossRefs || []); }
      else if (key === "memory") { const { data } = await api.get(`/intelligence/${projectId}/context-memory`); setMemory(data.data); }
      else if (key === "architecture") { const { data } = await api.get(`/intelligence/${projectId}/architecture`); setArchData(data.data); }
      else if (key === "depsgraph") { const { data } = await api.get(`/intelligence/${projectId}/dependency-graph`); setDepGraph(data.data); }
      else if (key === "suggestions") { const { data } = await api.get(`/intelligence/${projectId}/suggestions`); setSuggestions(data.data.suggestions || []); }
      else if (key === "refactoring") { const { data } = await api.get(`/intelligence/${projectId}/refactoring`); setRefactors(data.data.refactors || []); }
      else if (key === "plan") { const { data } = await api.get(`/intelligence/${projectId}/plan`); setPlan(data.data); }
      else if (key === "review") { const { data } = await api.get(`/intelligence/${projectId}/review`); setReview(data.data); }
    } catch {}
    setLoading(false);
  }, [projectId]);

  const handleSearch = useCallback(async () => {
    if (!projectId || !searchQuery.trim()) return; setSearching(true);
    try { const { data } = await api.post(`/intelligence/${projectId}/search`, { query: searchQuery, type: searchType || undefined }); setSearchResults(data.data.results || []); } catch {}
    setSearching(false);
  }, [projectId, searchQuery, searchType]);

  const handleSemanticSearch = useCallback(async () => {
    if (!projectId || !semanticQuery.trim()) return; setLoading(true);
    try { const { data } = await api.post(`/intelligence/${projectId}/semantic-search`, { query: semanticQuery }); setSemanticResults(data.data.results || []); } catch {}
    setLoading(false);
  }, [projectId, semanticQuery]);

  const handleReadMulti = useCallback(async () => {
    if (!projectId || !multiFiles.trim()) return; setLoading(true);
    try { const { data } = await api.post(`/intelligence/${projectId}/read-multiple`, { files: multiFiles.split("\n").map((s) => s.trim()).filter(Boolean) }); setMultiContent(data.data || []); } catch {}
    setLoading(false);
  }, [projectId, multiFiles]);

  const handleRename = useCallback(async () => {
    if (!projectId || !renameOld || !renameNew) return; setLoading(true);
    try { const { data } = await api.post(`/intelligence/${projectId}/rename`, { oldName: renameOld, newName: renameNew }); setRenameResult(data.data); } catch {}
    setLoading(false);
  }, [projectId, renameOld, renameNew]);

  const handleMove = useCallback(async () => {
    if (!projectId || !moveSrc || !moveDst) return; setLoading(true);
    try { const { data } = await api.post(`/intelligence/${projectId}/move`, { sourcePath: moveSrc, targetPath: moveDst }); setMoveResult(data.data); } catch {}
    setLoading(false);
  }, [projectId, moveSrc, moveDst]);

  if (!currentProject) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <Brain className="h-8 w-8 text-surface-300 dark:text-surface-600 mb-2" />
        <p className="text-xs text-surface-400">Open a project to see intelligence</p>
      </div>
    );
  }

  function renderTabContent() {
    if (!indexed && activeTab !== "search" && activeTab !== "semantic" && activeTab !== "readmulti" && activeTab !== "rename" && activeTab !== "move") {
      return (
        <div className="text-center py-4">
          <p className="text-xs text-surface-400 mb-2">Project not indexed yet</p>
          <Button size="sm" onClick={handleIndex} loading={indexing}><RefreshCw className="h-3 w-3 mr-1" /> Index Project</Button>
        </div>
      );
    }

    switch (activeTab) {
      case "summary":
        return summary ? (
          <div className="space-y-3">
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
                {((summary.languages as string[]) || []).map((lang) => (
                  <span key={lang} className="px-2 py-0.5 rounded text-[10px] bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400">{lang}</span>
                ))}
              </div>
            </div>
          </div>
        ) : <Button size="sm" className="w-full" onClick={() => handleLoad("summary")}>Load Summary</Button>;

      case "deps":
        return (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => handleLoad("deps")} loading={loading}><GitBranch className="h-3 w-3 mr-1" /> Load Dependencies</Button>
            {deps.length > 0 && <p className="text-[10px] text-surface-400">{deps.length} files</p>}
            {deps.filter((d) => d.imports.length > 0).slice(0, 20).map((dep) => (
              <div key={dep.file} className="p-2 rounded bg-surface-100 dark:bg-surface-800">
                <div className="text-[10px] font-medium text-surface-600 dark:text-surface-400 mb-1">{dep.file}</div>
                <div className="flex flex-wrap gap-1">
                  {dep.imports.slice(0, 5).map((imp, i) => <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">{imp}</span>)}
                  {dep.imports.length > 5 && <span className="text-[9px] text-surface-400">+{dep.imports.length - 5}</span>}
                </div>
              </div>
            ))}
          </div>
        );

      case "search":
        return (
          <div className="space-y-3">
            <div className="flex gap-1">
              <input className="input flex-1 h-7 text-xs" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
              <Button size="sm" onClick={handleSearch} loading={searching}><Search className="h-3 w-3" /></Button>
            </div>
            <div className="flex gap-1">{["", "import", "export"].map((t) => (
              <button key={t} onClick={() => setSearchType(t)} className={cn("px-2 py-0.5 rounded text-[10px]", searchType === t ? "bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400" : "text-surface-400")}>{t || "All"}</button>
            ))}</div>
            {searchResults.slice(0, 30).map((r, i) => (
              <div key={i} className="p-2 rounded bg-surface-100 dark:bg-surface-800">
                <div className="text-[10px] font-medium text-surface-500">{r.file}:{r.line}</div>
                <code className="text-[10px] text-surface-700 dark:text-surface-300 block mt-0.5">{r.content.slice(0, 100)}</code>
              </div>
            ))}
          </div>
        );

      case "duplicates":
        return (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => handleLoad("duplicates")} loading={loading}><CopyCheck className="h-3 w-3 mr-1" /> Find Duplicates</Button>
            {duplicates.map((d, i) => (
              <div key={i} className="p-2 rounded bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-medium text-red-600 dark:text-red-400">{d.similarity}%</span><span className="text-[9px] text-red-400">{d.lines} lines</span></div>
                <div className="text-[10px] text-red-600 dark:text-red-400">{d.file1}</div>
                <div className="text-[10px] text-red-600 dark:text-red-400">{d.file2}</div>
              </div>
            ))}
          </div>
        );

      case "relationships":
        return (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => handleLoad("relationships")} loading={loading}><FolderTree className="h-3 w-3 mr-1" /> Load Relationships</Button>
            {relationships.map((r, i) => (
              <div key={i} className="p-2 rounded bg-surface-100 dark:bg-surface-800 flex items-center gap-1 text-[10px]">
                <span className="text-surface-700 dark:text-surface-300">{r.source}</span><span className="text-primary-500">→</span><span className="text-surface-700 dark:text-surface-300">{r.target}</span>
              </div>
            ))}
          </div>
        );

      case "deadcode":
        return (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => handleLoad("deadcode")} loading={loading}><Skull className="h-3 w-3 mr-1" /> Detect Dead Code</Button>
            {deadCode.map((item, i) => (
              <div key={i} className="p-2 rounded bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium", item.type === "unused-import" && "bg-purple-100 dark:bg-purple-950 text-purple-600", item.type === "unused-variable" && "bg-orange-100 dark:bg-orange-950 text-orange-600", item.type === "unreachable-code" && "bg-red-100 dark:bg-red-950 text-red-600", item.type === "empty-function" && "bg-blue-100 dark:bg-blue-950 text-blue-600")}>{item.type}</span>
                <div className="text-[10px] text-surface-700 dark:text-surface-300 mt-1">{item.file}:{item.line}</div>
                {item.name && <div className="text-[10px] font-mono text-amber-600">{item.name}</div>}
                <div className="text-[9px] text-surface-400">{item.reason}</div>
              </div>
            ))}
          </div>
        );

      case "folders":
        return (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => handleLoad("folders")} loading={loading}><Folder className="h-3 w-3 mr-1" /> Load Folders</Button>
            {folders.slice(0, 30).map((f) => (
              <div key={f.path} className="p-2 rounded bg-surface-100 dark:bg-surface-800 flex items-center justify-between">
                <span className="text-[10px] text-surface-700 dark:text-surface-300">{f.path}</span>
                <span className="text-[9px] text-surface-400">{f.fileCount} files</span>
              </div>
            ))}
          </div>
        );

      case "readmulti":
        return (
          <div className="space-y-2">
            <textarea className="input w-full h-20 text-xs p-1.5" placeholder="File paths (one per line)&#10;src/app.ts&#10;src/routes/auth.ts" value={multiFiles} onChange={(e) => setMultiFiles(e.target.value)} />
            <Button size="sm" className="w-full" onClick={handleReadMulti} loading={loading}><FileText className="h-3 w-3 mr-1" /> Read Files</Button>
            {multiContent.map((f) => (
              <div key={f.file} className="p-2 rounded bg-surface-100 dark:bg-surface-800">
                <div className="text-[10px] font-medium text-surface-600 mb-1">{f.file}</div>
                <pre className="text-[9px] text-surface-700 dark:text-surface-300 max-h-32 overflow-y-auto">{f.content.slice(0, 500)}</pre>
              </div>
            ))}
          </div>
        );

      case "crossfile":
        return (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => handleLoad("crossfile")} loading={loading}><Crosshair className="h-3 w-3 mr-1" /> Analyze Cross-File</Button>
            {crossFile.slice(0, 30).map((c, i) => (
              <div key={i} className="p-2 rounded bg-surface-100 dark:bg-surface-800">
                <div className="text-[10px] font-mono font-medium text-primary-600">{c.symbol}</div>
                <div className="text-[9px] text-surface-400">Defined in: {c.definedIn}</div>
                {c.usedIn.length > 0 && <div className="text-[9px] text-surface-400">Used in: {c.usedIn.slice(0, 5).join(", ")}{c.usedIn.length > 5 && ` +${c.usedIn.length - 5}`}</div>}
              </div>
            ))}
          </div>
        );

      case "semantic":
        return (
          <div className="space-y-2">
            <div className="flex gap-1">
              <input className="input flex-1 h-7 text-xs" placeholder="Search semantically..." value={semanticQuery} onChange={(e) => setSemanticQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSemanticSearch()} />
              <Button size="sm" onClick={handleSemanticSearch} loading={loading}><Target className="h-3 w-3" /></Button>
            </div>
            {semanticResults.map((r, i) => (
              <div key={i} className="p-2 rounded bg-surface-100 dark:bg-surface-800">
                <div className="flex items-center justify-between"><span className="text-[10px] font-medium text-surface-700 dark:text-surface-300">{r.file}</span><span className="text-[9px] text-primary-500">Score: {r.score}</span></div>
                <div className="flex flex-wrap gap-1 mt-1">{r.matches.map((m, j) => <span key={j} className="px-1 py-0.5 rounded text-[8px] bg-blue-50 dark:bg-blue-950 text-blue-600">{m}</span>)}</div>
              </div>
            ))}
          </div>
        );

      case "memory":
        return (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => handleLoad("memory")} loading={loading}><Table className="h-3 w-3 mr-1" /> Load Context Memory</Button>
            {memory && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-surface-100 dark:bg-surface-800 text-center"><div className="text-base font-bold text-primary-500">{memory.totalFiles as number}</div><div className="text-[9px] text-surface-400">Files</div></div>
                  <div className="p-2 rounded bg-surface-100 dark:bg-surface-800 text-center"><div className="text-base font-bold text-primary-500">{memory.totalLines as number}</div><div className="text-[9px] text-surface-400">Lines</div></div>
                </div>
                <div className="p-2 rounded bg-surface-100 dark:bg-surface-800"><div className="text-[9px] text-surface-400 mb-1">Top Files</div>{(memory.topFiles as string[])?.slice(0, 5).map((f) => <div key={f} className="text-[10px] text-surface-600">{f}</div>)}</div>
                <div className="p-2 rounded bg-surface-100 dark:bg-surface-800"><div className="text-[9px] text-surface-400 mb-1">Common Imports</div><div className="flex flex-wrap gap-1">{((memory.commonImports as string[]) || []).slice(0, 10).map((i) => <span key={i} className="px-1 py-0.5 rounded text-[8px] bg-green-50 dark:bg-green-950 text-green-600">{i}</span>)}</div></div>
              </div>
            )}
          </div>
        );

      case "architecture":
        return (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => handleLoad("architecture")} loading={loading}><Map className="h-3 w-3 mr-1" /> Generate Diagram</Button>
            {archData && (
              <div className="space-y-2">
                <div className="p-2 rounded bg-surface-100 dark:bg-surface-800"><div className="text-[9px] text-surface-400 mb-1">Directories ({((archData.directories as string[]) || []).length})</div>{(archData.directories as string[])?.map((d) => <div key={d} className="text-[10px] text-surface-600 font-mono">{d || "(root)"}</div>)}</div>
                <div className="p-2 rounded bg-surface-100 dark:bg-surface-800"><div className="text-[9px] text-surface-400 mb-1">Mermaid Diagram</div><pre className="text-[8px] text-surface-600 dark:text-surface-400 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">{archData.mermaid as string}</pre></div>
              </div>
            )}
          </div>
        );

      case "depsgraph":
        return (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => handleLoad("depsgraph")} loading={loading}><Network className="h-3 w-3 mr-1" /> Load Dep Graph</Button>
            {depGraph && <><p className="text-[10px] text-surface-400">{depGraph.nodes.length} nodes, {depGraph.edges.length} edges</p>
              {depGraph.edges.slice(0, 20).map((e, i) => (
                <div key={i} className="p-1.5 rounded bg-surface-100 dark:bg-surface-800 flex items-center gap-1 text-[9px]"><span className="text-surface-600">{e.source.split("/").pop()}</span><span className="text-primary-500">→</span><span className="text-surface-600">{e.target.split("/").pop()}</span></div>
              ))}
            </>}
          </div>
        );

      case "suggestions":
        return (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => handleLoad("suggestions")} loading={loading}><Lightbulb className="h-3 w-3 mr-1" /> Get Suggestions</Button>
            {suggestions.map((s, i) => (
              <div key={i} className="p-2 rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-1 mb-1"><span className="px-1 py-0.5 rounded text-[8px] font-medium bg-blue-100 dark:bg-blue-900 text-blue-600">{s.type}</span><span className="text-[9px] text-surface-400">{s.file}:{s.line}</span></div>
                <div className="text-[10px] text-surface-700 dark:text-surface-300">{s.suggestion}</div>
              </div>
            ))}
          </div>
        );

      case "refactoring":
        return (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => handleLoad("refactoring")} loading={loading}><Shuffle className="h-3 w-3 mr-1" /> Analyze Refactoring</Button>
            {refactors.map((r, i) => (
              <div key={i} className="p-2 rounded bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-1 mb-1"><span className="px-1 py-0.5 rounded text-[8px] font-medium bg-purple-100 dark:bg-purple-900 text-purple-600">{r.type}</span><span className="text-[9px] text-surface-400">{r.file}:{r.line}</span></div>
                <div className="text-[10px] text-surface-500 mb-1">{r.description}</div>
                <pre className="text-[9px] text-red-500 line-through bg-red-50 dark:bg-red-950 p-1 rounded mb-1">{r.before}</pre>
                <pre className="text-[9px] text-green-500 bg-green-50 dark:bg-green-950 p-1 rounded">{r.after}</pre>
              </div>
            ))}
          </div>
        );

      case "rename":
        return (
          <div className="space-y-2">
            <input className="input h-7 text-xs w-full" placeholder="Old symbol name" value={renameOld} onChange={(e) => setRenameOld(e.target.value)} />
            <input className="input h-7 text-xs w-full" placeholder="New symbol name" value={renameNew} onChange={(e) => setRenameNew(e.target.value)} />
            <Button size="sm" className="w-full" onClick={handleRename} loading={loading}><FileText className="h-3 w-3 mr-1" /> Rename Across Project</Button>
            {renameResult && <div className="p-2 rounded bg-green-50 dark:bg-green-950 text-[10px] text-green-600">{(renameResult.message as string) || `${renameResult.totalChanges as number} changes`}</div>}
          </div>
        );

      case "move":
        return (
          <div className="space-y-2">
            <input className="input h-7 text-xs w-full" placeholder="Source path (e.g. src/old.ts)" value={moveSrc} onChange={(e) => setMoveSrc(e.target.value)} />
            <input className="input h-7 text-xs w-full" placeholder="Target path (e.g. src/new.ts)" value={moveDst} onChange={(e) => setMoveDst(e.target.value)} />
            <Button size="sm" className="w-full" onClick={handleMove} loading={loading}><Move className="h-3 w-3 mr-1" /> Move File Safely</Button>
            {moveResult && <div className="p-2 rounded bg-green-50 dark:bg-green-950 text-[10px] text-green-600">{(moveResult.message as string)}</div>}
          </div>
        );

      case "plan":
        return (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => handleLoad("plan")} loading={loading}><CheckSquare className="h-3 w-3 mr-1" /> Generate Project Plan</Button>
            {plan && (
              <div className="space-y-2">
                <div className="p-2 rounded bg-surface-100 dark:bg-surface-800">
                  <div className="text-[10px] font-medium text-surface-700 dark:text-surface-300">{plan.projectName as string}</div>
                  <div className="text-[9px] text-surface-400">{plan.overview as string}</div>
                </div>
                <div className="p-2 rounded bg-surface-100 dark:bg-surface-800">
                  <div className="text-[9px] text-surface-400 mb-1">Architecture</div>
                  {((plan.architecture as { component: string; role: string }[]) || []).slice(0, 8).map((a) => (
                    <div key={a.component} className="mb-1"><div className="text-[10px] font-mono text-surface-600">{a.component}</div><div className="text-[8px] text-surface-400">{a.role}</div></div>
                  ))}
                </div>
                {((plan.suggestedModules as string[]) || []).length > 0 && (
                  <div className="p-2 rounded bg-amber-50 dark:bg-amber-950">
                    <div className="text-[9px] text-amber-600 mb-1">Suggestions</div>
                    {(plan.suggestedModules as string[]).map((s, i) => <div key={i} className="text-[10px] text-amber-700">• {s}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case "review":
        return (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => handleLoad("review")} loading={loading}><Target className="h-3 w-3 mr-1" /> Review Project</Button>
            {review && (
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-surface-100 dark:bg-surface-800 text-center">
                  <div className="text-2xl font-bold" style={{ color: (review.score as number) >= 80 ? "#22c55e" : (review.score as number) >= 60 ? "#eab308" : "#ef4444" }}>{review.score as number}/100</div>
                  <div className="text-[10px] text-surface-400">Quality Score</div>
                </div>
                {(review.findings as { severity: string; category: string; file: string; message: string }[] || []).map((f, i) => (
                  <div key={i} className={cn("p-2 rounded border", f.severity === "critical" && "bg-red-50 dark:bg-red-950 border-red-200", f.severity === "warning" && "bg-amber-50 dark:bg-amber-950 border-amber-200", "bg-blue-50 dark:bg-blue-950 border-blue-200")}>
                    <div className="flex items-center gap-1 mb-0.5"><span className="px-1 py-0.5 rounded text-[8px] font-medium uppercase text-[10px]">{f.severity}</span><span className="text-[9px] text-surface-400">{f.category}</span></div>
                    <div className="text-[10px] text-surface-600">{f.message}</div>
                  </div>
                ))}
                {((review.recommendations as string[]) || []).map((r, i) => (
                  <div key={i} className="p-2 rounded bg-green-50 dark:bg-green-950 text-[10px] text-green-600">→ {r}</div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-50 dark:bg-surface-900">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-200 dark:border-surface-700">
        <Brain className="h-4 w-4 text-primary-500" />
        <span className="text-xs font-medium text-surface-700 dark:text-surface-300">Project Intelligence</span>
      </div>

      <div className="flex gap-1 px-2 py-1.5 border-b border-surface-200 dark:border-surface-700 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key as Tab)}
            className={cn("flex items-center gap-1 px-2 py-1 rounded text-[10px] whitespace-nowrap transition-colors", activeTab === key ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300" : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300")}
          ><Icon className="h-3 w-3" />{label}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {renderTabContent()}
      </div>
    </div>
  );
}