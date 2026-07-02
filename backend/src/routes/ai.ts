import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { logger } from "../utils/logger";
import type { AuthRequest } from "../middleware/auth";
import { Response } from "express";

const AI_SERVICE_URL = "http://127.0.0.1:8000";

const router = Router();

router.use(authenticate);

router.post("/code/action", async (req: AuthRequest, res: Response) => {
  try {
    const { action, code, language, instruction, filePath } = req.body;

    if (!action || !code) {
      return res.status(400).json({ success: false, error: "Action and code required" });
    }

    const response = await fetch(`${AI_SERVICE_URL}/api/ai/code/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, code, language, instruction, filePath }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ success: false, error: err });
    }

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    logger.error("Code action failed", { error });
    res.status(500).json({
      success: false,
      error: "AI service unavailable",
      data: { content: "⚠️ AI service unavailable. Make sure the AI service is running on port 8000.", model: "unavailable" },
    });
  }
});

export default router;
