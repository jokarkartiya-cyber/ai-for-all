import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getSettings,
  updateSettings,
  updateProfile,
  changePassword,
  listApiKeys,
  createApiKey,
  deleteApiKey,
  listSessions,
  revokeSession,
} from "../controllers/user";

const router = Router();
router.use(authenticate);

router.get("/settings", getSettings);
router.patch("/settings", updateSettings);
router.patch("/profile", updateProfile);
router.put("/password", changePassword);

router.get("/api-keys", listApiKeys);
router.post("/api-keys", createApiKey);
router.delete("/api-keys/:id", deleteApiKey);

router.get("/sessions", listSessions);
router.delete("/sessions/:id", revokeSession);

export default router;
