import { Response } from "express";
import { query } from "../config/database";
import { logger } from "../utils/logger";
import { parseJsonField } from "../utils/db";
import type { AuthRequest } from "../middleware/auth";

export async function requireAdmin(req: AuthRequest, res: Response, next: () => void) {
  try {
    const user = await query("SELECT role FROM users WHERE id = $1", [req.userId]);
    if (user.rows.length === 0 || user.rows[0].role !== "admin") {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }
    next();
  } catch (error) {
    logger.error("Admin check failed", { error });
    res.status(500).json({ success: false, error: "Failed to verify admin" });
  }
}

export async function listUsers(req: AuthRequest, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const users = await query(
      `SELECT id, username, email, role, email_verified, created_at, updated_at
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const count = await query("SELECT COUNT(*) as total FROM users");

    res.json({
      success: true,
      data: users.rows.map((u: Record<string, unknown>) => ({
        ...u,
        emailVerified: !!(u.email_verified),
      })),
      pagination: {
        page,
        limit,
        total: count.rows[0].total,
      },
    });
  } catch (error) {
    logger.error("List users failed", { error });
    res.status(500).json({ success: false, error: "Failed to list users" });
  }
}

export async function updateUserRole(req: AuthRequest, res: Response) {
  try {
    const { role } = req.body;
    if (!role || !["user", "admin", "moderator"].includes(role)) {
      return res.status(400).json({ success: false, error: "Valid role required (user/admin/moderator)" });
    }

    const result = await query(
      "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, email, role",
      [role, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error("Update user role failed", { error });
    res.status(500).json({ success: false, error: "Failed to update user role" });
  }
}

export async function deleteUser(req: AuthRequest, res: Response) {
  try {
    const result = await query("DELETE FROM users WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({ success: true, message: "User deleted" });
  } catch (error) {
    logger.error("Delete user failed", { error });
    res.status(500).json({ success: false, error: "Failed to delete user" });
  }
}
