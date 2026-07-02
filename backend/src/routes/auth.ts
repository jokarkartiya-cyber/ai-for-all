import { Router } from "express";
import {
  signup,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
} from "../controllers/auth";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", authenticate, getMe);
router.post("/send-verification", authenticate, sendVerificationEmail);
router.post("/verify-email", verifyEmail);

export default router;
