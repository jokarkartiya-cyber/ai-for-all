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
