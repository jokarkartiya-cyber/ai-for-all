import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  updateSettings,
  updateProfile,
  listApiKeys,
  createApiKey,
  deleteApiKey,
  listSessions,
  revokeSession,
} from "../controllers/user";

const router = Router();
router.use(authenticate);

router.patch("/settings", updateSettings);
router.patch("/profile", updateProfile);

router.get("/api-keys", listApiKeys);
router.post("/api-keys", createApiKey);
router.delete("/api-keys/:id", deleteApiKey);

router.get("/sessions", listSessions);
router.delete("/sessions/:id", revokeSession);

export default router;
