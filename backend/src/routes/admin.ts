import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin, listUsers, updateUserRole, deleteUser } from "../controllers/admin";

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

router.get("/users", listUsers);
router.patch("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

export default router;
