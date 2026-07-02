import { Response } from "express";
import { query } from "../config/database";
import { logger } from "../utils/logger";
import type { AuthRequest } from "../middleware/auth";
import * as fs from "fs/promises";
import * as path from "path";
import { existsSync, mkdirSync } from "fs";

const WORKSPACE_DIR = path.resolve(process.cwd(), "workspace");

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  extension?: string;
  children?: TreeNode[];
}

function sanitizePath(input: string): string {
  const normalized = path.normalize(input).replace(/^[/\\]+/, "");
  if (normalized.includes("..")) {
    throw new Error("Invalid path");
  }
  return normalized;
}

function getFileLanguage(ext: string): string {
  const langMap: Record<string, string> = {
    ".ts": "typescript", ".tsx": "typescript", ".js": "javascript",
    ".jsx": "javascript", ".py": "python", ".html": "html",
    ".css": "css", ".json": "json", ".md": "markdown",
    ".yaml": "yaml", ".yml": "yaml", ".xml": "xml",
    ".sql": "sql", ".sh": "shell", ".bash": "shell",
    ".dockerfile": "dockerfile", ".go": "go", ".rs": "rust",
    ".rb": "ruby", ".php": "php", ".java": "java",
    ".c": "c", ".cpp": "cpp", ".h": "c", ".hpp": "cpp",
    ".swift": "swift", ".kt": "kotlin", ".scala": "scala",
    ".vue": "html", ".svelte": "html", ".astro": "html",
  };
  return langMap[ext.toLowerCase()] || "plaintext";
}

async function buildFileTree(dirPath: string, relativePath: string = ""): Promise<TreeNode[]> {
  const entries: TreeNode[] = [];
  try {
    const dir = await fs.readdir(dirPath, { withFileTypes: true });
    dir.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const entry of dir) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === ".git") continue;

      const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const entryFullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const children = await buildFileTree(entryFullPath, entryRelPath);
        entries.push({
          name: entry.name,
          path: entryRelPath,
          type: "directory",
          children,
        });
      } else {
        const ext = path.extname(entry.name);
        const stat = await fs.stat(entryFullPath);
        entries.push({
          name: entry.name,
          path: entryRelPath,
          type: "file",
          size: stat.size,
          extension: ext,
        });
      }
    }
  } catch (error) {
    logger.error("buildFileTree error", { dirPath, error });
  }
  return entries;
}

function ensureWorkspaceDir(): void {
  if (!existsSync(WORKSPACE_DIR)) {
    mkdirSync(WORKSPACE_DIR, { recursive: true });
  }
}

export async function listProjects(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      `SELECT id, name, path, language, framework, files, folders, last_opened, created_at
       FROM projects WHERE user_id = $1 ORDER BY last_opened DESC`,
      [req.userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error("List projects failed", { error });
    res.status(500).json({ success: false, error: "Failed to list projects" });
  }
}

export async function getProject(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error("Get project failed", { error });
    res.status(500).json({ success: false, error: "Failed to get project" });
  }
}

export async function createProject(req: AuthRequest, res: Response) {
  try {
    const { name, language } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: "Project name required" });
    }

    ensureWorkspaceDir();
    const projectDir = path.join(WORKSPACE_DIR, name.replace(/[^a-zA-Z0-9_-]/g, "_") + "_" + Date.now());
    mkdirSync(projectDir, { recursive: true });

    const result = await query(
      `INSERT INTO projects (user_id, name, path, language)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.userId, name, projectDir, language || "typescript"]
    );

    const project = result.rows[0];

    if (language === "python") {
      await fs.writeFile(path.join(projectDir, "main.py"), "# " + name + "\n\n");
      await fs.writeFile(path.join(projectDir, "README.md"), "# " + name + "\n");
    } else if (language === "html") {
      await fs.writeFile(path.join(projectDir, "index.html"), "<!DOCTYPE html>\n<html>\n<head>\n  <title>" + name + "</title>\n</head>\n<body>\n  <h1>" + name + "</h1>\n</body>\n</html>\n");
      await fs.writeFile(path.join(projectDir, "style.css"), "/* " + name + " */\n");
    } else {
      await fs.writeFile(path.join(projectDir, "index.ts"), "// " + name + "\n\n");
      await fs.writeFile(path.join(projectDir, "README.md"), "# " + name + "\n");
    }

    const fileTree = await buildFileTree(projectDir);
    await query(
      `UPDATE projects SET files = $1, folders = $2 WHERE id = $3`,
      [fileTree.filter(n => n.type === "file").length, fileTree.filter(n => n.type === "directory").length, project.id]
    );

    res.status(201).json({ success: true, data: { ...project, fileTree } });
  } catch (error) {
    logger.error("Create project failed", { error });
    res.status(500).json({ success: false, error: "Failed to create project" });
  }
}

export async function updateProject(req: AuthRequest, res: Response) {
  try {
    const { name, language, framework } = req.body;
    const result = await query(
      `UPDATE projects SET
        name = COALESCE($1, name),
        language = COALESCE($2, language),
        framework = COALESCE($3, framework),
        last_opened = datetime('now')
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [name, language, framework, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error("Update project failed", { error });
    res.status(500).json({ success: false, error: "Failed to update project" });
  }
}

export async function deleteProject(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      "SELECT path FROM projects WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const projectPath = result.rows[0].path as string;
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (fsError) {
      logger.warn("Failed to delete project directory", { projectPath, fsError });
    }

    await query("DELETE FROM projects WHERE id = $1", [req.params.id]);
    res.json({ success: true, message: "Project deleted" });
  } catch (error) {
    logger.error("Delete project failed", { error });
    res.status(500).json({ success: false, error: "Failed to delete project" });
  }
}

export async function getFileTree(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      "SELECT path FROM projects WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const projectPath = result.rows[0].path as string;
    const tree = await buildFileTree(projectPath);
    res.json({ success: true, data: tree });
  } catch (error) {
    logger.error("Get file tree failed", { error });
    res.status(500).json({ success: false, error: "Failed to get file tree" });
  }
}

export async function readFile(req: AuthRequest, res: Response) {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ success: false, error: "File path required" });
    }

    const result = await query(
      "SELECT path FROM projects WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const projectPath = result.rows[0].path as string;
    const safePath = sanitizePath(filePath);
    const fullPath = path.join(projectPath, safePath);

    if (!fullPath.startsWith(projectPath)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const content = await fs.readFile(fullPath, "utf-8");
    const stat = await fs.stat(fullPath);
    const ext = path.extname(fullPath);

    res.json({
      success: true,
      data: {
        path: safePath,
        name: path.basename(fullPath),
        content,
        size: stat.size,
        extension: ext,
        language: getFileLanguage(ext),
        lastModified: stat.mtime,
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return res.status(404).json({ success: false, error: "File not found" });
    }
    logger.error("Read file failed", { error });
    res.status(500).json({ success: false, error: "Failed to read file" });
  }
}

export async function writeFile(req: AuthRequest, res: Response) {
  try {
    const filePath = req.query.path as string;
    const { content } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, error: "File path required" });
    }

    const result = await query(
      "SELECT path FROM projects WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const projectPath = result.rows[0].path as string;
    const safePath = sanitizePath(filePath);
    const fullPath = path.join(projectPath, safePath);

    if (!fullPath.startsWith(projectPath)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const dir = path.dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    await fs.writeFile(fullPath, content || "", "utf-8");

    const stat = await fs.stat(fullPath);
    const ext = path.extname(fullPath);

    res.json({
      success: true,
      data: {
        path: safePath,
        name: path.basename(fullPath),
        size: stat.size,
        extension: ext,
        language: getFileLanguage(ext),
        lastModified: stat.mtime,
      },
    });
  } catch (error) {
    logger.error("Write file failed", { error });
    res.status(500).json({ success: false, error: "Failed to write file" });
  }
}

export async function createFileOrFolder(req: AuthRequest, res: Response) {
  try {
    const filePath = req.query.path as string;
    const { type } = req.body;
    if (!filePath || !type) {
      return res.status(400).json({ success: false, error: "Path and type required" });
    }

    const result = await query(
      "SELECT path FROM projects WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const projectPath = result.rows[0].path as string;
    const safePath = sanitizePath(filePath);
    const fullPath = path.join(projectPath, safePath);

    if (!fullPath.startsWith(projectPath)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    if (existsSync(fullPath)) {
      return res.status(409).json({ success: false, error: "Path already exists" });
    }

    if (type === "directory") {
      await fs.mkdir(fullPath, { recursive: true });
    } else {
      const dir = path.dirname(fullPath);
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }
      await fs.writeFile(fullPath, "", "utf-8");
    }

    const ext = type === "file" ? path.extname(fullPath) : "";

    res.status(201).json({
      success: true,
      data: {
        path: safePath,
        name: path.basename(fullPath),
        type,
        extension: ext,
        language: type === "file" ? getFileLanguage(ext) : undefined,
      },
    });
  } catch (error) {
    logger.error("Create file/folder failed", { error });
    res.status(500).json({ success: false, error: "Failed to create file/folder" });
  }
}

export async function deleteFileOrFolder(req: AuthRequest, res: Response) {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ success: false, error: "Path required" });
    }

    const result = await query(
      "SELECT path FROM projects WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const projectPath = result.rows[0].path as string;
    const safePath = sanitizePath(filePath);
    const fullPath = path.join(projectPath, safePath);

    if (!fullPath.startsWith(projectPath)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    if (!existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: "Path not found" });
    }

    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.unlink(fullPath);
    }

    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    logger.error("Delete file/folder failed", { error });
    res.status(500).json({ success: false, error: "Failed to delete" });
  }
}

export async function renameFileOrFolder(req: AuthRequest, res: Response) {
  try {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
      return res.status(400).json({ success: false, error: "oldPath and newPath required" });
    }

    const result = await query(
      "SELECT path FROM projects WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const projectPath = result.rows[0].path as string;
    const safeOldPath = sanitizePath(oldPath);
    const safeNewPath = sanitizePath(newPath);
    const fullOldPath = path.join(projectPath, safeOldPath);
    const fullNewPath = path.join(projectPath, safeNewPath);

    if (!fullOldPath.startsWith(projectPath) || !fullNewPath.startsWith(projectPath)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    if (!existsSync(fullOldPath)) {
      return res.status(404).json({ success: false, error: "Source not found" });
    }

    const dir = path.dirname(fullNewPath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    await fs.rename(fullOldPath, fullNewPath);
    res.json({ success: true, message: "Renamed successfully" });
  } catch (error) {
    logger.error("Rename failed", { error });
    res.status(500).json({ success: false, error: "Failed to rename" });
  }
}
