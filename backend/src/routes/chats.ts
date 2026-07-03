import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  listChats,
  getChat,
  createChat,
  updateChat,
  deleteChat,
  togglePin,
  sendMessage,
  sendMessageStream,
  regenerateMessage,
  updateMessage,
  importChats,
} from "../controllers/chats";

const router = Router();

router.use(authenticate);

router.get("/", listChats);
router.post("/", createChat);
router.get("/:id", getChat);
router.patch("/:id", updateChat);
router.delete("/:id", deleteChat);
router.post("/:id/pin", togglePin);
router.post("/:id/messages", sendMessage);
router.post("/:id/messages/stream", sendMessageStream);
router.post("/:id/regenerate", regenerateMessage);
router.put("/:id/messages/:messageId", updateMessage);
router.post("/import", importChats);

export default router;
