import { Response } from "express";
import { query } from "../config/database";
import { logger } from "../utils/logger";
import type { AuthRequest } from "../middleware/auth";
import * as fs from "fs/promises";
import * as path from "path";
import { existsSync } from "fs";

const WORKSPACE_DIR = path.resolve(process.cwd(), "workspace");

interface DependencyInfo {
  file: string;
  imports: string[];
  exports: string[];
  language: string;
}

interface FileIndex {
  file_path: string;
  content: string;
  language: string;
  imports: string[];
  exports: string[];
  size: number;
}

function sanitizePath(input: string): string {
  const normalized = path.normalize(input).replace(/^[/\\]+/, "");
  if (normalized.includes("..")) throw new Error("Invalid path");
  return normalized;
}

function parseImports(content: string, language: string): string[] {
  const imports: string[] = [];
  const patterns: Record<string, RegExp[]> = {
    typescript: [/from ['"]([^'"]+)['"]/g, /require\(['"]([^'"]+)['"]\)/g, /import\s+['"]([^'"]+)['"]/g],
    javascript: [/from ['"]([^'"]+)['"]/g, /require\(['"]([^'"]+)['"]\)/g, /import\s+['"]([^'"]+)['"]/g],
    python: [/^(?:from\s+(\S+)\s+)?import\s+(\S+)/gm],
    html: [/<script\s+src=['"]([^'"]+)['"]/g, /<link\s+[^>]*href=['"]([^'"]+)['"]/g],
    css: [/@import\s+['"]([^'"]+)['"]/g, /url\(['"]?([^'")]+)['"]?\)/g],
  };
  const langPatterns = patterns[language] || patterns.typescript;
  for (const regex of langPatterns) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const imp = (match[1] || match[2] || "").trim();
      if (imp) imports.push(imp);
    }
  }
  return [...new Set(imports)];
}

function parseExports(content: string, language: string): string[] {
  const exports: string[] = [];
  const patterns: Record<string, RegExp[]> = {
    typescript: [/export\s+(?:default\s+)?(?:function|const|class|interface|type|enum|let|var)\s+(\w+)/g, /export\s*\{([^}]+)\}/g, /module\.exports\s*=\s*(\w+)/g],
    javascript: [/export\s+(?:default\s+)?(?:function|const|class|let|var)\s+(\w+)/g, /export\s*\{([^}]+)\}/g, /module\.exports\s*=\s*(\w+)/g],
    python: [/^def\s+(\w+)/gm, /^class\s+(\w+)/gm],
  };
  const langPatterns = patterns[language] || patterns.typescript;
  for (const regex of langPatterns) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1].includes(",")) {
        match[1].split(",").forEach((e) => { const t = e.trim(); if (t) exports.push(t); });
      } else {
        exports.push(match[1].trim());
      }
    }
  }
  return [...new Set(exports)];
}

function getLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    ".ts": "typescript", ".tsx": "typescript", ".js": "javascript",
    ".jsx": "javascript", ".py": "python", ".html": "html",
    ".css": "css", ".json": "json", ".md": "markdown",
    ".yaml": "yaml", ".yml": "yaml", ".xml": "xml",
    ".sql": "sql", ".sh": "shell", ".go": "go", ".rs": "rust",
    ".rb": "ruby", ".php": "php", ".java": "java",
    ".c": "c", ".cpp": "cpp",
  };
  return langMap[ext] || "plaintext";
}

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "venv", "__pycache__", ".cache", "coverage"]);
const EXCLUDED_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".pdf", ".zip", ".tar", ".gz"]);

async function walkDir(dirPath: string, basePath: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.join(basePath, entry.name);
      if (entry.isDirectory()) {
        files.push(...await walkDir(fullPath, relPath));
      } else if (!EXCLUDED_EXT.has(path.extname(entry.name))) {
        files.push(relPath);
      }
    }
  } catch { /* skip unreadable */ }
  return files;
}

export async function indexProject(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT path FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });

    const projectPath = (req.body.path as string) || (result.rows[0].path as string);
    const fullPath = path.isAbsolute(projectPath) ? projectPath : path.join(WORKSPACE_DIR, projectPath);
    if (!existsSync(fullPath)) return res.status(404).json({ success: false, error: "Project directory not found" });

    const files = await walkDir(fullPath, "");
    const index: FileIndex[] = [];
    let totalLines = 0;

    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(fullPath, file), "utf-8");
        const language = getLanguage(file);
        const lines = content.split("\n").length;
        totalLines += lines;
        index.push({
          file_path: file,
          content,
          language,
          imports: parseImports(content, language),
          exports: parseExports(content, language),
          size: lines,
        });
      } catch { /* skip unreadable */ }
    }

    await query(
      "UPDATE projects SET path = $1, file_index = $2, file_count = $3, line_count = $4, indexed_at = NOW() WHERE id = $5",
      [fullPath,
       JSON.stringify(index.map((f) => ({ file_path: f.file_path, language: f.language, imports: f.imports, exports: f.exports, size: f.size }))),
       index.length, totalLines, req.params.id]
    );

    logger.info("Project indexed", { projectId: req.params.id, files: index.length, lines: totalLines });
    res.json({ success: true, data: { files: index.length, lines: totalLines, indexed: true } });
  } catch (error) {
    logger.error("Index project failed", { error });
    res.status(500).json({ success: false, error: "Failed to index project" });
  }
}

export async function getProjectSummary(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT name, language, file_index, file_count, line_count, indexed_at FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });

    const proj = result.rows[0];
    const fileIndex = proj.file_index ? JSON.parse(proj.file_index as string) : [];

    const languages = [...new Set(fileIndex.map((f: { language: string }) => f.language))];
    const totalFiles = fileIndex.length;

    res.json({
      success: true,
      data: {
        name: proj.name,
        language: proj.language,
        files: totalFiles,
        lines: proj.line_count || 0,
        languages,
        indexedAt: proj.indexed_at,
      },
    });
  } catch (error) {
    logger.error("Project summary failed", { error });
    res.status(500).json({ success: false, error: "Failed to get summary" });
  }
}

export async function getDependencies(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT file_index FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });

    const fileIndex = result.rows[0].file_index ? JSON.parse(result.rows[0].file_index as string) : [];
    const deps: DependencyInfo[] = fileIndex.map((f: { file_path: string; imports: string[]; exports: string[]; language: string }) => ({
      file: f.file_path,
      imports: f.imports || [],
      exports: f.exports || [],
      language: f.language || "plaintext",
    }));

    res.json({ success: true, data: deps });
  } catch (error) {
    logger.error("Dependencies failed", { error });
    res.status(500).json({ success: false, error: "Failed to get dependencies" });
  }
}

export async function searchProject(req: AuthRequest, res: Response) {
  try {
    const { query: searchQuery, type } = req.body;
    if (!searchQuery) return res.status(400).json({ success: false, error: "Search query required" });

    const result = await query("SELECT path FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });

    const projectPath = result.rows[0].path as string;
    const fullPath = path.isAbsolute(projectPath) ? projectPath : path.join(WORKSPACE_DIR, projectPath);
    if (!existsSync(fullPath)) return res.status(404).json({ success: false, error: "Project directory not found" });

    const files = await walkDir(fullPath, "");
    const results: { file: string; line: number; content: string; match: string }[] = [];
    const lowerQuery = searchQuery.toLowerCase();

    for (const file of files) {
      try {
        if (EXCLUDED_EXT.has(path.extname(file))) continue;
        const content = await fs.readFile(path.join(fullPath, file), "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (type === "import" && parseImports(line, getLanguage(file)).length > 0 && line.toLowerCase().includes(lowerQuery)) {
            results.push({ file, line: i + 1, content: line.trim(), match: "import" });
          } else if (type === "export" && line.includes("export") && line.toLowerCase().includes(lowerQuery)) {
            results.push({ file, line: i + 1, content: line.trim(), match: "export" });
          } else if (!type && line.toLowerCase().includes(lowerQuery)) {
            results.push({ file, line: i + 1, content: line.trim(), match: "text" });
          }
        }
      } catch { /* skip */ }
    }

    results.sort((a, b) => a.file.localeCompare(b.file));
    const limited = results.slice(0, 50);

    res.json({ success: true, data: { results: limited, total: results.length } });
  } catch (error) {
    logger.error("Search project failed", { error });
    res.status(500).json({ success: false, error: "Failed to search project" });
  }
}

export async function detectDuplicates(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT path FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });

    const projectPath = result.rows[0].path as string;
    const fullPath = path.isAbsolute(projectPath) ? projectPath : path.join(WORKSPACE_DIR, projectPath);
    if (!existsSync(fullPath)) return res.status(404).json({ success: false, error: "Project directory not found" });

    const files = await walkDir(fullPath, "");
    const fileContents: { file: string; content: string; lines: number }[] = [];

    for (const file of files) {
      try {
        if (path.extname(file) === ".json") continue;
        const content = await fs.readFile(path.join(fullPath, file), "utf-8");
        const lines = content.split("\n").length;
        if (lines > 3) fileContents.push({ file, content: content.trim(), lines });
      } catch { /* skip */ }
    }

    const duplicates: { file1: string; file2: string; similarity: number; lines: number }[] = [];
    for (let i = 0; i < fileContents.length; i++) {
      for (let j = i + 1; j < fileContents.length; j++) {
        const a = fileContents[i];
        const b = fileContents[j];
        if (Math.abs(a.lines - b.lines) > Math.max(a.lines, b.lines) * 0.5) continue;
        const aLen = a.content.length;
        const bLen = b.content.length;
        if (aLen < 20 || bLen < 20) continue;
        const common = [];
        const minLen = Math.min(aLen, bLen);
        for (let k = 0; k < minLen; k++) {
          if (a.content[k] === b.content[k]) common.push(a.content[k]);
          else break;
        }
        const similarity = common.length / Math.max(aLen, bLen);
        if (similarity > 0.6) {
          duplicates.push({ file1: a.file, file2: b.file, similarity: Math.round(similarity * 100), lines: Math.min(a.lines, b.lines) });
        }
      }
    }

    duplicates.sort((a, b) => b.similarity - a.similarity);
    res.json({ success: true, data: { duplicates: duplicates.slice(0, 20), total: duplicates.length } });
  } catch (error) {
    logger.error("Duplicate detection failed", { error });
    res.status(500).json({ success: false, error: "Failed to detect duplicates" });
  }
}

export async function getFileRelationships(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT file_index FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });

    const fileIndex: { file_path: string; imports: string[]; exports: string[]; language: string }[] = result.rows[0].file_index ? JSON.parse(result.rows[0].file_index as string) : [];
    const filePaths = new Set(fileIndex.map((f) => f.file_path));
    const relationships: { source: string; target: string; type: string }[] = [];

    for (const f of fileIndex) {
      const imports: string[] = f.imports || [];
      for (const imp of imports) {
        for (const fp of filePaths) {
          const relPath = path.relative(path.dirname(f.file_path), fp);
          const normImp = imp.replace(/^\.\//, "");
          const normRel = relPath.replace(/\\/g, "/").replace(/\.[^.]+$/, "");
          if (normImp === normRel || normImp === fp.replace(/\.[^.]+$/, "") || normImp === "./" + normRel) {
            relationships.push({ source: f.file_path, target: fp, type: "imports" });
            break;
          }
        }
      }
    }

    res.json({ success: true, data: relationships });
  } catch (error) {
    logger.error("File relationships failed", { error });
    res.status(500).json({ success: false, error: "Failed to get relationships" });
  }
}

export async function detectDeadCode(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT path, file_index FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });

    const projectPath = result.rows[0].path as string;
    const fullPath = path.isAbsolute(projectPath) ? projectPath : path.join(WORKSPACE_DIR, projectPath);
    const fileIndex: { file_path: string; imports: string[]; exports: string[]; language: string; size: number }[] = result.rows[0].file_index ? JSON.parse(result.rows[0].file_index as string) : [];

    const deadItems: { file: string; type: string; name: string; line: number; reason: string }[] = [];

    for (const fi of fileIndex) {
      const ext = path.extname(fi.file_path);
      if (fi.language === "plaintext" || ext === ".json" || ext === ".md") continue;

      try {
        const fileContent = await fs.readFile(path.join(fullPath, fi.file_path), "utf-8");
        const lines = fileContent.split("\n");

        // Unused imports
        for (const imp of fi.imports) {
          const localName = imp.split("/").pop()?.replace(/['";]/g, "").replace(/\.\w+$/, "") || "";
          if (!localName || imp.startsWith(".")) continue;
          const usedInFile = lines.some((l, idx) => {
            if (l.includes(imp)) return false;
            return new RegExp(`\\b${escapeRegex(localName)}\\b`).test(l);
          });
          if (!usedInFile) {
            const lineNum = lines.findIndex((l) => l.includes(imp)) + 1;
            deadItems.push({ file: fi.file_path, type: "unused-import", name: localName, line: lineNum, reason: `Imported but never used` });
          }
        }

        // Check each line for dead patterns
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Skip empty lines and comments
          if (!line || line.startsWith("//") || line.startsWith("#") || line.startsWith("/*") || line.startsWith("*")) continue;

          // Unused variables (let/const/var assignment not referenced below)
          const varMatch = line.match(/^(?:let|const|var)\s+(\w+)\s*=/);
          if (varMatch) {
            const varName = varMatch[1];
            const rest = lines.slice(i + 1).join("\n");
            if (!new RegExp(`\\b${escapeRegex(varName)}\\b`).test(rest) && !fi.exports.includes(varName)) {
              deadItems.push({ file: fi.file_path, type: "unused-variable", name: varName, line: i + 1, reason: "Variable declared but never used" });
            }
          }

          // Unreachable code after return/throw
          if ((line.startsWith("return") || line.startsWith("throw")) && i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine && !nextLine.startsWith("}") && !nextLine.startsWith(")") && !nextLine.startsWith("//") && !nextLine.startsWith("#")) {
              deadItems.push({ file: fi.file_path, type: "unreachable-code", name: "", line: i + 2, reason: "Code after return/throw is unreachable" });
            }
          }

          // Empty function body
          if (line.includes("function") && line.endsWith("{}")) {
            const match = line.match(/function\s+(\w+)/);
            if (match) {
              deadItems.push({ file: fi.file_path, type: "empty-function", name: match[1], line: i + 1, reason: "Function has empty body" });
            }
          }

          // Empty catch/if block
          if ((line.includes("catch") || line.includes("else")) && line.endsWith("{}")) {
            deadItems.push({ file: fi.file_path, type: "empty-block", name: "", line: i + 1, reason: `Empty ${line.includes("catch") ? "catch" : "else"} block` });
          }
        }
      } catch { /* skip unreadable */ }
    }

    res.json({ success: true, data: { deadItems, total: deadItems.length } });
  } catch (error) {
    logger.error("Dead code detection failed", { error });
    res.status(500).json({ success: false, error: "Failed to detect dead code" });
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getFolders(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT path FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });
    const projectPath = result.rows[0].path as string;
    const fullPath = path.isAbsolute(projectPath) ? projectPath : path.join(WORKSPACE_DIR, projectPath);
    if (!existsSync(fullPath)) return res.status(404).json({ success: false, error: "Project directory not found" });

    const folders: { name: string; path: string; fileCount: number }[] = [];
    async function walk(dir: string, rel: string) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        let fileCount = 0;
        for (const e of entries) {
          if (EXCLUDED_DIRS.has(e.name) || e.name.startsWith(".")) continue;
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            const sub = await walk(full, rel ? `${rel}/${e.name}` : e.name);
            fileCount += sub.fileCount;
          } else if (!EXCLUDED_EXT.has(path.extname(e.name))) {
            fileCount++;
          }
        }
        if (rel) folders.push({ name: path.basename(rel), path: rel, fileCount });
        return { fileCount };
      } catch { return { fileCount: 0 }; }
    }
    await walk(fullPath, "");
    folders.sort((a, b) => b.fileCount - a.fileCount);
    res.json({ success: true, data: folders });
  } catch (error) {
    logger.error("Get folders failed", { error });
    res.status(500).json({ success: false, error: "Failed to get folders" });
  }
}

export async function readMultipleFiles(req: AuthRequest, res: Response) {
  try {
    const { files } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) return res.status(400).json({ success: false, error: "Files array required" });

    const result = await query("SELECT path FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });
    const projectPath = result.rows[0].path as string;
    const fullPath = path.isAbsolute(projectPath) ? projectPath : path.join(WORKSPACE_DIR, projectPath);

    const contents: { file: string; content: string; language: string }[] = [];
    for (const file of files.slice(0, 20)) {
      try {
        const fp = path.resolve(fullPath, file);
        if (!fp.startsWith(fullPath)) continue;
        const content = await fs.readFile(fp, "utf-8");
        contents.push({ file, content, language: getLanguage(file) });
      } catch { /* skip */ }
    }
    res.json({ success: true, data: contents });
  } catch (error) {
    logger.error("Read multiple files failed", { error });
    res.status(500).json({ success: false, error: "Failed to read files" });
  }
}

export async function crossFileUnderstanding(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT path, file_index FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });
    const fileIndex: { file_path: string; imports: string[]; exports: string[]; language: string; size: number }[] =
      result.rows[0].file_index ? JSON.parse(result.rows[0].file_index as string) : [];

    const crossRefs: { symbol: string; definedIn: string; usedIn: string[]; exported: boolean }[] = [];
    const exportsMap = new Map<string, { file: string; exported: boolean }>();

    for (const f of fileIndex) {
      for (const exp of f.exports) {
        exportsMap.set(exp, { file: f.file_path, exported: true });
      }
    }

    for (const f of fileIndex) {
      for (const exp of f.exports) {
        const users: string[] = [];
        for (const other of fileIndex) {
          if (other.file_path === f.file_path) continue;
          const content = other.imports.join(" ");
          if (content.includes(exp)) users.push(other.file_path);
        }
        crossRefs.push({ symbol: exp, definedIn: f.file_path, usedIn: users, exported: true });
      }
    }

    crossRefs.sort((a, b) => b.usedIn.length - a.usedIn.length);
    res.json({ success: true, data: { crossRefs: crossRefs.slice(0, 100), total: crossRefs.length } });
  } catch (error) {
    logger.error("Cross-file understanding failed", { error });
    res.status(500).json({ success: false, error: "Failed to analyze cross-file references" });
  }
}

export async function semanticSearch(req: AuthRequest, res: Response) {
  try {
    const { query: searchQuery } = req.body;
    if (!searchQuery) return res.status(400).json({ success: false, error: "Search query required" });

    const result = await query("SELECT file_index FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });
    const fileIndex: { file_path: string; imports: string[]; exports: string[]; language: string; size: number }[] =
      result.rows[0].file_index ? JSON.parse(result.rows[0].file_index as string) : [];

    const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const scored: { file: string; score: number; matches: string[]; language: string }[] = [];

    for (const fi of fileIndex) {
      if (fi.language === "plaintext") continue;
      let score = 0;
      const matches: string[] = [];
      for (const term of terms) {
        const fileLower = fi.file_path.toLowerCase();
        if (fileLower.includes(term)) { score += 3; matches.push(`filename:${term}`); }
        const impMatch = fi.imports.filter((i) => i.toLowerCase().includes(term));
        if (impMatch.length) { score += 2 * impMatch.length; matches.push(...impMatch.slice(0, 3)); }
        const expMatch = fi.exports.filter((e) => e.toLowerCase().includes(term));
        if (expMatch.length) { score += 3 * expMatch.length; matches.push(...expMatch.slice(0, 3)); }
      }
      if (score > 0) scored.push({ file: fi.file_path, score, matches: [...new Set(matches)].slice(0, 5), language: fi.language });
    }

    scored.sort((a, b) => b.score - a.score);
    res.json({ success: true, data: { results: scored.slice(0, 30), total: scored.length } });
  } catch (error) {
    logger.error("Semantic search failed", { error });
    res.status(500).json({ success: false, error: "Failed to search semantically" });
  }
}

export async function getContextMemory(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT path, file_index, file_count, line_count FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });
    const fileIndex: { file_path: string; imports: string[]; exports: string[]; language: string; size: number }[] =
      result.rows[0].file_index ? JSON.parse(result.rows[0].file_index as string) : [];

    const topFiles = [...fileIndex].sort((a, b) => b.size - a.size).slice(0, 10).map((f) => f.file_path);
    const allExports = new Set<string>();
    const allImports = new Set<string>();
    for (const f of fileIndex) {
      f.exports.forEach((e) => allExports.add(e));
      f.imports.forEach((i) => allImports.add(i));
    }

    res.json({
      success: true,
      data: {
        totalFiles: fileIndex.length,
        totalLines: result.rows[0].line_count,
        topFiles,
        exportsCount: allExports.size,
        exports: [...allExports].slice(0, 50),
        commonImports: [...allImports].filter((i) => !i.startsWith(".")).slice(0, 30),
        languages: [...new Set(fileIndex.map((f) => f.language))],
      },
    });
  } catch (error) {
    logger.error("Context memory failed", { error });
    res.status(500).json({ success: false, error: "Failed to get context memory" });
  }
}

export async function getArchitectureDiagram(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT path, file_index FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });
    const fileIndex: { file_path: string; imports: string[]; exports: string[]; language: string; size: number }[] =
      result.rows[0].file_index ? JSON.parse(result.rows[0].file_index as string) : [];

    const tree: Record<string, { files: string[]; deps: string[] }> = {};
    for (const f of fileIndex) {
      const dir = path.dirname(f.file_path);
      if (!tree[dir]) tree[dir] = { files: [], deps: [] };
      tree[dir].files.push(path.basename(f.file_path));
      for (const imp of f.imports) {
        if (imp.startsWith(".")) {
          const resolved = path.normalize(path.join(dir, imp));
          tree[dir].deps.push(resolved);
        }
      }
    }

    const mermaidLines: string[] = ["graph TD"];
    const dirs = Object.keys(tree).sort();
    const nodeIds = new Map<string, string>();
    dirs.forEach((d, i) => nodeIds.set(d, `D${i}`));

    for (const dir of dirs) {
      const id = nodeIds.get(dir)!;
      const label = dir || "root";
      mermaidLines.push(`  ${id}["${label}"]`);
    }
    for (const dir of dirs) {
      const id = nodeIds.get(dir)!;
      for (const dep of tree[dir].deps) {
        const depDir = path.dirname(dep);
        const targetId = nodeIds.get(depDir);
        if (targetId && targetId !== id) {
          mermaidLines.push(`  ${id} --> ${targetId}`);
        }
      }
    }

    res.json({
      success: true,
      data: {
        mermaid: mermaidLines.join("\n"),
        directories: dirs,
        structure: tree,
      },
    });
  } catch (error) {
    logger.error("Architecture diagram failed", { error });
    res.status(500).json({ success: false, error: "Failed to generate architecture diagram" });
  }
}

export async function getDependencyGraph(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT file_index FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });
    const fileIndex: { file_path: string; imports: string[]; exports: string[]; language: string; size: number }[] =
      result.rows[0].file_index ? JSON.parse(result.rows[0].file_index as string) : [];

    const nodes: { id: string; label: string; group: string; size: number }[] = [];
    const edges: { source: string; target: string; type: string }[] = [];
    const fileSet = new Set(fileIndex.map((f) => f.file_path));

    for (const f of fileIndex) {
      nodes.push({ id: f.file_path, label: path.basename(f.file_path), group: f.language, size: f.size });
      for (const imp of f.imports) {
        const resolved = imp.replace(/^\.\//, "").replace(/\.[^.]+$/, "");
        for (const fp of fileSet) {
          const fpBase = fp.replace(/\.[^.]+$/, "").replace(/\\/g, "/");
          if (fpBase.endsWith(resolved) || fpBase === resolved) {
            edges.push({ source: f.file_path, target: fp, type: "imports" });
            break;
          }
        }
      }
    }

    res.json({ success: true, data: { nodes: nodes.slice(0, 100), edges: edges.slice(0, 200) } });
  } catch (error) {
    logger.error("Dependency graph failed", { error });
    res.status(500).json({ success: false, error: "Failed to generate dependency graph" });
  }
}

export async function getSuggestedImprovements(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT path, file_index FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });
    const projectPath = result.rows[0].path as string;
    const fullPath = path.isAbsolute(projectPath) ? projectPath : path.join(WORKSPACE_DIR, projectPath);
    const fileIndex: { file_path: string; imports: string[]; exports: string[]; language: string; size: number }[] =
      result.rows[0].file_index ? JSON.parse(result.rows[0].file_index as string) : [];

    const suggestions: { file: string; line: number; type: string; suggestion: string }[] = [];

    for (const fi of fileIndex) {
      if (fi.language === "plaintext" || fi.language === "json" || fi.language === "markdown") continue;
      try {
        const content = await fs.readFile(path.join(fullPath, fi.file_path), "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // var instead of let/const
          if (/^var\s+\w/.test(line)) suggestions.push({ file: fi.file_path, line: i + 1, type: "modernize", suggestion: "Use let or const instead of var" });

          // console.log left in
          if (line.includes("console.log")) suggestions.push({ file: fi.file_path, line: i + 1, type: "cleanup", suggestion: "Remove console.log or replace with proper logging" });

          // TODO/FIXME
          if (line.includes("TODO") || line.includes("FIXME") || line.includes("HACK")) {
            suggestions.push({ file: fi.file_path, line: i + 1, type: "todo", suggestion: `Unresolved ${line.includes("TODO") ? "TODO" : line.includes("FIXME") ? "FIXME" : "HACK"} comment` });
          }

          // Long functions
          if (/^function\s+\w+\s*\(/.test(line)) {
            let braceCount = 0;
            let fnLines = 0;
            for (let j = i; j < Math.min(i + 100, lines.length); j++) {
              fnLines++;
              if (lines[j].includes("{")) braceCount++;
              if (lines[j].includes("}")) braceCount--;
              if (braceCount === 0 && fnLines > 1) break;
            }
            if (fnLines > 50) {
              const fnName = line.match(/function\s+(\w+)/)?.[1] || "anonymous";
              suggestions.push({ file: fi.file_path, line: i + 1, type: "complexity", suggestion: `Function '${fnName}' is ${fnLines} lines. Consider breaking it down` });
            }
          }

          // Magic numbers
          if (/[=!<>]\s*\d{4,}\b/.test(line)) suggestions.push({ file: fi.file_path, line: i + 1, type: "magic-number", suggestion: "Consider using a named constant instead of magic number" });

          // Nested callbacks
          let depth = 0;
          for (const ch of line) { if (ch === "{") depth++; }
          if (depth > 0 && i > 0) {
            let prevDepth = 0;
            for (const ch of lines[i - 1]) { if (ch === "{") prevDepth++; }
            if (depth > 3) suggestions.push({ file: fi.file_path, line: i + 1, type: "complexity", suggestion: `Deeply nested block (depth ${depth}). Consider extracting into a function` });
          }
        }
      } catch { /* skip */ }
    }

    suggestions.sort((a, b) => a.file.localeCompare(b.file));
    res.json({ success: true, data: { suggestions: suggestions.slice(0, 50), total: suggestions.length } });
  } catch (error) {
    logger.error("Suggestions failed", { error });
    res.status(500).json({ success: false, error: "Failed to analyze improvements" });
  }
}

export async function getAutomaticRefactoring(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT path, file_index FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });
    const projectPath = result.rows[0].path as string;
    const fullPath = path.isAbsolute(projectPath) ? projectPath : path.join(WORKSPACE_DIR, projectPath);
    const fileIndex: { file_path: string; language: string; size: number }[] =
      result.rows[0].file_index ? JSON.parse(result.rows[0].file_index as string) : [];

    const refactors: { file: string; line: number; type: string; description: string; before: string; after: string }[] = [];

    for (const fi of fileIndex) {
      if (fi.language === "plaintext" || fi.language === "json" || fi.language === "markdown") continue;
      try {
        const content = await fs.readFile(path.join(fullPath, fi.file_path), "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();

          // Convert var to const/let
          const varMatch = trimmed.match(/^var\s+(\w+)\s*=\s*(.+)$/);
          if (varMatch) {
            refactors.push({
              file: fi.file_path, line: i + 1, type: "modernize",
              description: `Replace var with const`,
              before: trimmed,
              after: `const ${varMatch[1]} = ${varMatch[2]}`,
            });
          }

          // Arrow function for function expressions
          const fnExprMatch = trimmed.match(/^(\w+(?:\.\w+)*)\s*=\s*function\s*\(([^)]*)\)\s*\{([^}]*)\}$/);
          if (fnExprMatch) {
            refactors.push({
              file: fi.file_path, line: i + 1, type: "arrow",
              description: "Convert function expression to arrow function",
              before: trimmed,
              after: `${fnExprMatch[1]} = (${fnExprMatch[2]}) => { ${fnExprMatch[3]} }`,
            });
          }

          // Template literal for string concat
          const concatMatch = trimmed.match(/(\w+)\s*\+\s*['"]([^'"]+)['"]\s*\+/);
          if (concatMatch) {
            refactors.push({
              file: fi.file_path, line: i + 1, type: "template",
              description: "Use template literal instead of concatenation",
              before: trimmed,
              after: trimmed.replace(/(\w+)\s*\+\s*['"]([^'"]+)['"]\s*\+\s*(\w+)/, "`${$1}$2${$3}`"),
            });
          }
        }

        // Duplicate string detection (same string literal used 3+ times)
        const stringLiterals = content.match(/['"][^'"]{5,}['"]/g) || [];
        const freq: Record<string, number> = {};
        for (const s of stringLiterals) {
          freq[s] = (freq[s] || 0) + 1;
        }
        for (const [str, count] of Object.entries(freq)) {
          if (count >= 3) {
            refactors.push({
              file: fi.file_path, line: 1, type: "constant",
              description: `String ${str} used ${count} times. Extract to a constant`,
              before: str, after: `const ${str.replace(/['"]/g, "").toUpperCase().replace(/\s+/g, "_")} = ${str};`,
            });
          }
        }
      } catch { /* skip */ }
    }

    refactors.sort((a, b) => a.file.localeCompare(b.file));
    res.json({ success: true, data: { refactors: refactors.slice(0, 50), total: refactors.length } });
  } catch (error) {
    logger.error("Refactoring failed", { error });
    res.status(500).json({ success: false, error: "Failed to analyze refactoring opportunities" });
  }
}

export async function renameAcrossProject(req: AuthRequest, res: Response) {
  try {
    const { oldName, newName, filePaths } = req.body;
    if (!oldName || !newName) return res.status(400).json({ success: false, error: "oldName and newName required" });

    const result = await query("SELECT path FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });
    const projectPath = result.rows[0].path as string;
    const fullPath = path.isAbsolute(projectPath) ? projectPath : path.join(WORKSPACE_DIR, projectPath);

    const filesToProcess = filePaths || [];
    if (filesToProcess.length === 0) {
      const fileIndex: { file_path: string }[] = result.rows[0].file_index ? JSON.parse(result.rows[0].file_index as string) : [];
      filesToProcess.push(...fileIndex.map((f) => f.file_path));
    }

    const changes: { file: string; line: number; before: string; after: string }[] = [];
    for (const file of filesToProcess.slice(0, 50)) {
      try {
        const fp = path.resolve(fullPath, file);
        if (!fp.startsWith(fullPath)) continue;
        const content = await fs.readFile(fp, "utf-8");
        const lines = content.split("\n");
        let modified = false;
        for (let i = 0; i < lines.length; i++) {
          const regex = new RegExp(`\\b${escapeRegex(oldName)}\\b`, "g");
          if (regex.test(lines[i])) {
            const before = lines[i];
            lines[i] = lines[i].replace(regex, newName);
            if (before !== lines[i]) {
              changes.push({ file, line: i + 1, before: before.trim(), after: lines[i].trim() });
              modified = true;
            }
          }
        }
        if (modified) {
          await fs.writeFile(fp, lines.join("\n"), "utf-8");
        }
      } catch { /* skip */ }
    }

    res.json({ success: true, data: { changes, totalChanges: changes.length, message: `${changes.length} changes made across ${new Set(changes.map((c) => c.file)).size} files` } });
  } catch (error) {
    logger.error("Rename failed", { error });
    res.status(500).json({ success: false, error: "Failed to rename across project" });
  }
}

export async function moveFileSafely(req: AuthRequest, res: Response) {
  try {
    const { sourcePath, targetPath } = req.body;
    if (!sourcePath || !targetPath) return res.status(400).json({ success: false, error: "sourcePath and targetPath required" });

    const project = await query("SELECT path, file_index FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (project.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });
    const projectPath = project.rows[0].path as string;
    const fullPath = path.isAbsolute(projectPath) ? projectPath : path.join(WORKSPACE_DIR, projectPath);
    const fileIndex: { file_path: string; imports: string[]; language: string }[] =
      project.rows[0].file_index ? JSON.parse(project.rows[0].file_index as string) : [];

    const sourceFull = path.resolve(fullPath, sourcePath);
    const targetFull = path.resolve(fullPath, targetPath);
    if (!sourceFull.startsWith(fullPath) || !targetFull.startsWith(fullPath)) {
      return res.status(400).json({ success: false, error: "Paths must be within project" });
    }
    if (!existsSync(sourceFull)) return res.status(404).json({ success: false, error: "Source file not found" });

    await fs.mkdir(path.dirname(targetFull), { recursive: true });
    await fs.copyFile(sourceFull, targetFull);

    const oldRelPath = sourcePath.replace(/\\/g, "/");
    const newRelPath = targetPath.replace(/\\/g, "/");
    const affectedFiles: string[] = [];
    const importUpdates: { file: string; line: number; before: string; after: string }[] = [];

    for (const fi of fileIndex) {
      if (fi.file_path === oldRelPath) continue;
      try {
        const fp = path.resolve(fullPath, fi.file_path);
        if (!fp.startsWith(fullPath)) continue;
        const content = await fs.readFile(fp, "utf-8");
        const lines = content.split("\n");
        let modified = false;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const relFrom = path.relative(path.dirname(fi.file_path), oldRelPath).replace(/\\/g, "/");
          const relTo = path.relative(path.dirname(fi.file_path), newRelPath).replace(/\\/g, "/");
          if (line.includes(relFrom)) {
            const before = line;
            lines[i] = line.replace(relFrom, relTo);
            importUpdates.push({ file: fi.file_path, line: i + 1, before: before.trim(), after: lines[i].trim() });
            modified = true;
          }
        }
        if (modified) {
          await fs.writeFile(fp, lines.join("\n"), "utf-8");
          affectedFiles.push(fi.file_path);
        }
      } catch { /* skip */ }
    }

    await fs.unlink(sourceFull);
    res.json({
      success: true,
      data: {
        movedFrom: sourcePath,
        movedTo: targetPath,
        importUpdates,
        affectedFiles: [...new Set(affectedFiles)],
        message: `Moved to ${targetPath} and updated ${importUpdates.length} imports across ${new Set(affectedFiles).size} files`,
      },
    });
  } catch (error) {
    logger.error("Move file failed", { error });
    res.status(500).json({ success: false, error: "Failed to move file" });
  }
}

export async function aiProjectPlanning(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT name, file_index, file_count, line_count FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });
    const fileIndex: { file_path: string; language: string; exports: string[]; size: number }[] =
      result.rows[0].file_index ? JSON.parse(result.rows[0].file_index as string) : [];

    const totalFiles = fileIndex.length;
    const totalLines = (result.rows[0].line_count as number) || 0;
    const languages = [...new Set(fileIndex.map((f) => f.language))];
    const topExports = [...new Set(fileIndex.flatMap((f) => f.exports))].slice(0, 30);
    const topFiles = [...fileIndex].sort((a, b) => b.size - a.size).slice(0, 10).map((f) => ({ file: f.file_path, exports: f.exports, lines: f.size }));

    const plan = {
      projectName: result.rows[0].name,
      overview: `${totalFiles} files, ${totalLines} lines across ${languages.length} languages (${languages.join(", ")})`,
      architecture: topFiles.map((f) => ({
        component: f.file,
        exports: f.exports,
        lines: f.lines,
        role: f.file.includes("controller") ? "Controller - handles business logic" :
              f.file.includes("route") ? "Route - defines API endpoints" :
              f.file.includes("model") || f.file.includes("schema") ? "Model - data structure" :
              f.file.includes("config") ? "Configuration" :
              f.file.includes("middleware") ? "Middleware - request processing" :
              f.file.includes("utils") || f.file.includes("helper") ? "Utility - shared functions" :
              f.file.includes("test") || f.file.includes("spec") ? "Tests" :
              f.file.includes("service") ? "Service - external integrations" :
              "Module",
      })),
      keyExports: topExports,
      suggestedModules: [],
    };

    if (totalFiles > 20) plan.suggestedModules.push("Consider splitting into smaller modules for better maintainability");
    if (totalLines > 5000) plan.suggestedModules.push("Project is large. Consider microservices or lazy loading");
    if (!languages.includes("typescript") && languages.includes("javascript")) plan.suggestedModules.push("Consider migrating to TypeScript for better type safety");

    res.json({ success: true, data: plan });
  } catch (error) {
    logger.error("AI planning failed", { error });
    res.status(500).json({ success: false, error: "Failed to generate project plan" });
  }
}

export async function aiProjectReview(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT name, path, file_index, file_count, line_count, language FROM projects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Project not found" });
    const projectPath = result.rows[0].path as string;
    const fullPath = path.isAbsolute(projectPath) ? projectPath : path.join(WORKSPACE_DIR, projectPath);
    const fileIndex: { file_path: string; imports: string[]; exports: string[]; language: string; size: number }[] =
      result.rows[0].file_index ? JSON.parse(result.rows[0].file_index as string) : [];

    const review = {
      projectName: result.rows[0].name,
      summary: {
        files: result.rows[0].file_count,
        lines: result.rows[0].line_count,
        language: result.rows[0].language,
      },
      filesReviewed: fileIndex.length,
      findings: [] as { severity: string; category: string; file: string; message: string }[],
      score: 0,
      recommendations: [] as string[],
    };

    let score = 100;
    const allExports = new Set(fileIndex.flatMap((f) => f.exports));
    const allFiles = new Set(fileIndex.map((f) => f.file_path));

    // Check for missing types
    const jsFiles = fileIndex.filter((f) => f.language === "javascript");
    if (jsFiles.length > 5) {
      score -= 5;
      review.findings.push({ severity: "info", category: "type-safety", file: "project", message: `${jsFiles.length} JavaScript files found. TypeScript recommended` });
    }

    // Check file size
    for (const f of fileIndex) {
      if (f.size > 300) {
        score -= 2;
        review.findings.push({ severity: "warning", category: "file-size", file: f.file_path, message: `${f.size} lines - consider splitting` });
      }
    }

    // Check import organization
    for (const f of fileIndex) {
      if (f.imports.length > 20) {
        score -= 1;
        review.findings.push({ severity: "info", category: "imports", file: f.file_path, message: `${f.imports.length} imports - consider organizing` });
      }
    }

    // Check for unexported code
    const filesWithNoExports = fileIndex.filter((f) => f.exports.length === 0 && f.language !== "json" && f.language !== "markdown" && !f.file_path.includes("test") && f.size > 20);
    if (filesWithNoExports.length > 3) {
      score -= 3;
      review.findings.push({ severity: "info", category: "exports", file: "project", message: `${filesWithNoExports.length} files with no exports - may indicate dead code` });
    }

    // Check dependencies
    const externalDeps = new Set(fileIndex.flatMap((f) => f.imports.filter((i) => !i.startsWith(".") && !i.startsWith("/"))));
    if (externalDeps.size > 30) {
      score -= 5;
      review.findings.push({ severity: "warning", category: "dependencies", file: "project", message: `${externalDeps.size} external dependencies - high maintenance risk` });
    }

    // Test coverage
    const testFiles = fileIndex.filter((f) => f.file_path.includes("test") || f.file_path.includes("spec") || f.file_path.includes("__tests__"));
    if (testFiles.length === 0) {
      score -= 10;
      review.findings.push({ severity: "critical", category: "testing", file: "project", message: "No test files found" });
    } else if (testFiles.length < 5) {
      score -= 5;
      review.findings.push({ severity: "warning", category: "testing", file: "project", message: `Only ${testFiles.length} test files - consider more coverage` });
    }

    // Configuration files
    const hasConfig = [...allFiles].some((f) => f.includes(".env") || f.includes("config") || f.includes("settings"));
    if (!hasConfig) {
      score -= 3;
      review.findings.push({ severity: "warning", category: "config", file: "project", message: "No configuration files detected" });
    }

    // Recommendations
    if (score < 70) review.recommendations.push("Major refactoring recommended");
    if (score < 85) review.recommendations.push("Consider addressing warnings to improve code quality");
    review.recommendations.push("Add more tests to improve maintainability");
    review.recommendations.push("Keep files under 300 lines for better readability");

    review.score = Math.max(0, Math.min(100, score));
    res.json({ success: true, data: review });
  } catch (error) {
    logger.error("AI review failed", { error });
    res.status(500).json({ success: false, error: "Failed to generate project review" });
  }
}
