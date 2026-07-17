import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  indexProject,
  getProjectSummary,
  getDependencies,
  searchProject,
  detectDuplicates,
  getFileRelationships,
  detectDeadCode,
} from "../controllers/intelligence";

const router = Router();
router.use(authenticate);

router.post("/:id/index", indexProject);
router.get("/:id/summary", getProjectSummary);
router.get("/:id/dependencies", getDependencies);
router.post("/:id/search", searchProject);
router.get("/:id/duplicates", detectDuplicates);
router.get("/:id/relationships", getFileRelationships);
router.get("/:id/dead-code", detectDeadCode);

export default router;
