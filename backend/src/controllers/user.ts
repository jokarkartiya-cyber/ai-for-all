import { Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { query } from "../config/database";
import { logger } from "../utils/logger";
import { parseJsonField } from "../utils/db";
import type { AuthRequest } from "../middleware/auth";

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function updateSettings(req: AuthRequest, res: Response) {
  try {
    const current = await query("SELECT settings FROM users WHERE id = $1", [req.userId]);
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const currentSettings = parseJsonField<Record<string, unknown>>(current.rows[0].settings);
    const merged = { ...currentSettings, ...req.body };

    const result = await query(
      "UPDATE users SET settings = $1 WHERE id = $2 RETURNING settings",
      [JSON.stringify(merged), req.userId]
    );

    res.json({ success: true, data: { settings: parseJsonField(result.rows[0].settings) } });
  } catch (error) {
    logger.error("Update settings failed", { error });
    res.status(500).json({ success: false, error: "Failed to update settings" });
  }
}

export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const { username, avatar } = req.body;
    const result = await query(
      `UPDATE users SET
        username = COALESCE($1, username),
        avatar = COALESCE($2, avatar),
        updated_at = datetime('now')
       WHERE id = $3
       RETURNING id, username, email, avatar, role`,
      [username, avatar, req.userId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error("Update profile failed", { error });
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
}

export async function listApiKeys(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      "SELECT id, name, provider, last_used, created_at FROM api_keys WHERE user_id = $1",
      [req.userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error("List API keys failed", { error });
    res.status(500).json({ success: false, error: "Failed to list API keys" });
  }
}

export async function createApiKey(req: AuthRequest, res: Response) {
  try {
    const { name, provider } = req.body;
    if (!name || !provider) {
      return res.status(400).json({ success: false, error: "Name and provider required" });
    }

    const rawKey = `afa_${crypto.randomBytes(24).toString("hex")}`;
    const keyHash = hashApiKey(rawKey);

    const result = await query(
      `INSERT INTO api_keys (user_id, name, key_hash, provider) VALUES ($1, $2, $3, $4) RETURNING id, name, provider, created_at`,
      [req.userId, name, keyHash, provider]
    );

    res.status(201).json({
      success: true,
      data: { ...result.rows[0], rawKey },
      message: "Save this key now — it won't be shown again",
    });
  } catch (error) {
    logger.error("Create API key failed", { error });
    res.status(500).json({ success: false, error: "Failed to create API key" });
  }
}

export async function deleteApiKey(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      "DELETE FROM api_keys WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "API key not found" });
    }
    res.json({ success: true, message: "API key deleted" });
  } catch (error) {
    logger.error("Delete API key failed", { error });
    res.status(500).json({ success: false, error: "Failed to delete API key" });
  }
}

export async function listSessions(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      "SELECT id, device, ip, last_active, created_at FROM sessions WHERE user_id = $1 ORDER BY last_active DESC",
      [req.userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error("List sessions failed", { error });
    res.status(500).json({ success: false, error: "Failed to list sessions" });
  }
}

export async function revokeSession(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      "DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    res.json({ success: true, message: "Session revoked" });
  } catch (error) {
    logger.error("Revoke session failed", { error });
    res.status(500).json({ success: false, error: "Failed to revoke session" });
  }
}
