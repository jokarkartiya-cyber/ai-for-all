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
  getFolders,
  readMultipleFiles,
  crossFileUnderstanding,
  semanticSearch,
  getContextMemory,
  getArchitectureDiagram,
  getDependencyGraph,
  getSuggestedImprovements,
  getAutomaticRefactoring,
  renameAcrossProject,
  moveFileSafely,
  aiProjectPlanning,
  aiProjectReview,
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
router.get("/:id/folders", getFolders);
router.post("/:id/read-multiple", readMultipleFiles);
router.get("/:id/cross-file", crossFileUnderstanding);
router.post("/:id/semantic-search", semanticSearch);
router.get("/:id/context-memory", getContextMemory);
router.get("/:id/architecture", getArchitectureDiagram);
router.get("/:id/dependency-graph", getDependencyGraph);
router.get("/:id/suggestions", getSuggestedImprovements);
router.get("/:id/refactoring", getAutomaticRefactoring);
router.post("/:id/rename", renameAcrossProject);
router.post("/:id/move", moveFileSafely);
router.get("/:id/plan", aiProjectPlanning);
router.get("/:id/review", aiProjectReview);

export default router;
