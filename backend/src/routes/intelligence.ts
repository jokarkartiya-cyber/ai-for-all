import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  indexProject,
  getProjectSummary,
  getDependencies,
  searchProject,
  detectDuplicates,
  getFileRelationships,
} from "../controllers/intelligence";

const router = Router();
router.use(authenticate);

router.post("/:id/index", indexProject);
router.get("/:id/summary", getProjectSummary);
router.get("/:id/dependencies", getDependencies);
router.post("/:id/search", searchProject);
router.get("/:id/duplicates", detectDuplicates);
router.get("/:id/relationships", getFileRelationships);

export default router;
