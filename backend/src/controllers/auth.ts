import { Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../config";
import { query } from "../config/database";
import { logger } from "../utils/logger";
import { parseJsonField } from "../utils/db";
import { sendEmail, buildEmailHtml } from "../utils/email";
import type { AuthRequest } from "../middleware/auth";

function generateToken(userId: string): string {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function signup(req: AuthRequest, res: Response) {
  try {
    const { username, email, password } = req.body;

    const existing = await query("SELECT id FROM users WHERE email = $1 OR username = $2", [email, username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userCount = await query("SELECT COUNT(*) as c FROM users");
    const isFirstUser = parseInt(userCount.rows[0]?.c as string || "0") === 0;
    const role = isFirstUser ? "admin" : "user";
    const result = await query(
      `INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, role, settings, created_at`,
      [username, email, passwordHash, role]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const device = ((req.headers["user-agent"] as string) || "Unknown").slice(0, 255);
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || (req.ip as string) || "0.0.0.0";

    await query(
      "INSERT INTO sessions (user_id, token, device, ip) VALUES ($1, $2, $3, $4)",
      [user.id, tokenHash, device, ip]
    );

    logger.info("User signed up", { userId: user.id, email });

    // Send verification email automatically (fire-and-forget)
    const vToken = generateResetToken();
    const vExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    query(
      "INSERT INTO verification_tokens (user_id, token, type, expires_at) VALUES ($1, $2, 'email_verification', $3)",
      [user.id, vToken, vExpires]
    ).then(() => {
      const verifyUrl = `${config.appUrl}/verify-email?token=${vToken}`;
      sendEmail(
        user.email,
        "Verify your email address",
        buildEmailHtml(
          "Welcome to ai for all!",
          "Thanks for signing up! Please verify your email address by clicking the button below. This link expires in 24 hours.",
          { text: "Verify Email", url: verifyUrl }
        )
      ).catch((emailErr) => logger.warn("Failed to send verification email", { error: emailErr }));
    }).catch(() => {});

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          settings: parseJsonField(user.settings),
          createdAt: user.created_at,
        },
        token,
      },
    });
  } catch (error) {
    logger.error("Signup failed", { error });
    const message = "Signup failed";
    res.status(500).json({ success: false, error: message });
  }
}

export async function login(req: AuthRequest, res: Response) {
  try {
    const { email, password } = req.body;

    const result = await query(
      "SELECT id, username, email, password_hash, role, settings FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const token = generateToken(user.id);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const device = ((req.headers["user-agent"] as string) || "Unknown").slice(0, 255);
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || (req.ip as string) || "0.0.0.0";

    await query(
      "INSERT INTO sessions (user_id, token, device, ip) VALUES ($1, $2, $3, $4)",
      [user.id, tokenHash, device, ip]
    );

    logger.info("User logged in", { userId: user.id });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          settings: parseJsonField(user.settings),
        },
        token,
      },
    });
  } catch (error) {
    logger.error("Login failed", { error });
    res.status(500).json({ success: false, error: "Login failed" });
  }
}

export async function logout(req: AuthRequest, res: Response) {
  try {
    const authHeader = req.headers.authorization as string;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "No token provided" });
    }

    const token = authHeader.slice(7);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await query("DELETE FROM sessions WHERE token = $1 AND user_id = $2", [tokenHash, req.userId]);

    logger.info("User logged out", { userId: req.userId });

    res.json({ success: true, message: "Logged out" });
  } catch (error) {
    logger.error("Logout failed", { error });
    res.status(500).json({ success: false, error: "Logout failed" });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      "SELECT id, username, email, avatar, role, settings, created_at FROM users WHERE id = $1",
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        emailVerified: !!(user.email_verified),
        settings: parseJsonField(user.settings),
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    logger.error("Get me failed", { error });
    res.status(500).json({ success: false, error: "Failed to get user" });
  }
}

export async function forgotPassword(req: AuthRequest, res: Response) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "Email required" });
    }

    const user = await query("SELECT id, username FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return res.json({ success: true, message: "If the email exists, a reset link has been sent" });
    }

    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await query(
      "INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [user.rows[0].id, token, expiresAt]
    );

    const resetUrl = `${config.appUrl}/reset-password?token=${token}`;
    sendEmail(
      email,
      "Reset your password",
      buildEmailHtml(
        "Reset your password",
        "We received a request to reset your password. Click the button below to set a new one. This link expires in 1 hour.",
        { text: "Reset Password", url: resetUrl }
      )
    ).catch((emailErr) => logger.warn("Failed to send reset email", { error: emailErr }));

    res.json({ success: true, message: "If the email exists, a reset link has been sent" });
  } catch (error) {
    logger.error("Forgot password failed", { error });
    res.status(500).json({ success: false, error: "Failed to process request" });
  }
}

export async function resetPassword(req: AuthRequest, res: Response) {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, error: "Token and password required" });
    }

    const result = await query(
      `SELECT id, user_id, expires_at FROM password_resets
       WHERE token = $1 AND used = 0 AND expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid or expired token" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, result.rows[0].user_id]);
    await query("UPDATE password_resets SET used = 1 WHERE id = $1", [result.rows[0].id]);

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    logger.error("Reset password failed", { error });
    res.status(500).json({ success: false, error: "Failed to reset password" });
  }
}

export async function sendVerificationEmail(req: AuthRequest, res: Response) {
  try {
    const user = await query(
      "SELECT id, username, email, email_verified FROM users WHERE id = $1",
      [req.userId]
    );
    if (user.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (user.rows[0].email_verified) {
      return res.json({ success: true, message: "Email already verified" });
    }

    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await query(
      "INSERT INTO verification_tokens (user_id, token, type, expires_at) VALUES ($1, $2, 'email_verification', $3)",
      [req.userId, token, expiresAt]
    );

    const verifyUrl = `${config.appUrl}/verify-email?token=${token}`;
    await sendEmail(
      user.rows[0].email,
      "Verify your email address",
      buildEmailHtml(
        "Verify your email",
        "Thanks for signing up! Please verify your email address by clicking the button below. This link expires in 24 hours.",
        { text: "Verify Email", url: verifyUrl }
      )
    );

    res.json({ success: true, message: "Verification email sent" });
  } catch (error) {
    logger.error("Send verification failed", { error });
    res.status(500).json({ success: false, error: "Failed to send verification" });
  }
}

export async function verifyEmail(req: AuthRequest, res: Response) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: "Token required" });
    }

    const result = await query(
      `SELECT id, user_id FROM verification_tokens
       WHERE token = $1 AND type = 'email_verification' AND used = 0 AND expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid or expired token" });
    }

    await query("UPDATE users SET email_verified = 1 WHERE id = $1", [result.rows[0].user_id]);
    await query("UPDATE verification_tokens SET used = 1 WHERE id = $1", [result.rows[0].id]);

    res.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    logger.error("Verify email failed", { error });
    res.status(500).json({ success: false, error: "Failed to verify email" });
  }
}
