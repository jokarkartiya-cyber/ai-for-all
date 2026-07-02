import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getFileTree,
  readFile,
  writeFile,
  createFileOrFolder,
  deleteFileOrFolder,
  renameFileOrFolder,
} from "../controllers/projects";

const router = Router();

router.use(authenticate);

router.get("/", listProjects);
router.post("/", createProject);
router.get("/:id", getProject);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);

router.get("/:id/tree", getFileTree);
router.get("/:id/read", readFile);
router.put("/:id/write", writeFile);
router.post("/:id/create", createFileOrFolder);
router.delete("/:id/delete", deleteFileOrFolder);
router.post("/:id/rename", renameFileOrFolder);

export default router;
