import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import { authenticate } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";
import { query } from "../config/database";
import { logger } from "../utils/logger";

const uploadDir = path.resolve(process.cwd(), "uploads");
import fs from "fs";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images allowed"));
    }
  },
});

const router = Router();

router.post("/avatar", authenticate, upload.single("avatar"), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }
    const avatarUrl = `/uploads/${req.file.filename}`;
    await query("UPDATE users SET avatar = $1 WHERE id = $2", [avatarUrl, req.userId]);
    logger.info("Avatar uploaded", { userId: req.userId, file: req.file.filename });
    res.json({ success: true, data: { avatar: avatarUrl } });
  } catch (error) {
    logger.error("Avatar upload failed", { error });
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

export default router;
