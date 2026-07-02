import { Response } from "express";
import { query } from "../config/database";
import { logger } from "../utils/logger";
import { parseJsonField } from "../utils/db";
import type { AuthRequest } from "../middleware/auth";

const AI_SERVICE_URL = "http://127.0.0.1:8000";

async function callAiService(
  messages: { role: string; content: string }[],
  model?: string,
  provider?: string
): Promise<{ content: string; model: string }> {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model, provider, stream: false }),
    });
    if (!response.ok) {
      throw new Error(`AI service error: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    logger.error("AI service call failed", { error });
    return {
      content: `⚠️ AI service unavailable. Make sure the AI service is running on port 8000.\n\nError: ${(error as Error).message}`,
      model: model || "unavailable",
    };
  }
}

export async function listChats(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      `SELECT id, title, model, provider, pinned,
              json_array_length(messages) as message_count,
              CASE WHEN json_array_length(messages) > 0
                   THEN json_extract(messages, '$[0].content')
                   ELSE NULL
              END as preview,
              created_at, updated_at
       FROM chats
       WHERE user_id = $1
       ORDER BY pinned DESC, updated_at DESC`,
      [req.userId]
    );

    const chats = result.rows.map((row) => ({
      ...row,
      pinned: !!(row.pinned),
    }));

    res.json({ success: true, data: chats });
  } catch (error) {
    logger.error("List chats failed", { error });
    res.status(500).json({ success: false, error: "Failed to list chats" });
  }
}

export async function getChat(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      "SELECT * FROM chats WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Chat not found" });
    }

    const chat = result.rows[0];
    chat.messages = parseJsonField(chat.messages);
    chat.pinned = !!(chat.pinned);

    res.json({ success: true, data: chat });
  } catch (error) {
    logger.error("Get chat failed", { error });
    res.status(500).json({ success: false, error: "Failed to get chat" });
  }
}

export async function createChat(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      `INSERT INTO chats (user_id, title) VALUES ($1, 'New Chat') RETURNING *`,
      [req.userId]
    );

    const chat = result.rows[0];
    chat.messages = parseJsonField(chat.messages);

    res.status(201).json({ success: true, data: chat });
  } catch (error) {
    logger.error("Create chat failed", { error });
    res.status(500).json({ success: false, error: "Failed to create chat" });
  }
}

export async function updateChat(req: AuthRequest, res: Response) {
  try {
    const { title, model, provider } = req.body;
    const result = await query(
      `UPDATE chats SET
        title = COALESCE($1, title),
        model = COALESCE($2, model),
        provider = COALESCE($3, provider),
        updated_at = datetime('now')
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [title, model, provider, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Chat not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error("Update chat failed", { error });
    res.status(500).json({ success: false, error: "Failed to update chat" });
  }
}

export async function deleteChat(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      "DELETE FROM chats WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Chat not found" });
    }

    res.json({ success: true, message: "Chat deleted" });
  } catch (error) {
    logger.error("Delete chat failed", { error });
    res.status(500).json({ success: false, error: "Failed to delete chat" });
  }
}

export async function togglePin(req: AuthRequest, res: Response) {
  try {
    const chat = await query(
      "SELECT pinned FROM chats WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );

    if (chat.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Chat not found" });
    }

    const newPinned = !chat.rows[0].pinned ? 1 : 0;
    const result = await query(
      `UPDATE chats SET pinned = $1, updated_at = datetime('now')
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [newPinned, req.params.id, req.userId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error("Toggle pin failed", { error });
    res.status(500).json({ success: false, error: "Failed to toggle pin" });
  }
}

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const { message, model, provider } = req.body;

    const chatResult = await query(
      "SELECT messages, model, provider FROM chats WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );

    if (chatResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Chat not found" });
    }

    const chat = chatResult.rows[0];
    const messages = parseJsonField<Record<string, unknown>[]>(chat.messages) || [];

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    const history = messages.map((m) => ({
      role: m.role as string,
      content: m.content as string,
    }));
    history.push({ role: "user", content: message });

    const aiResponse = await callAiService(history, model || chat.model, provider || chat.provider);

    const assistantMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: aiResponse.content,
      timestamp: new Date().toISOString(),
      model: aiResponse.model,
    };

    const updatedMessages = [...messages, userMessage, assistantMessage];

    await query(
      `UPDATE chats SET messages = $1, updated_at = datetime('now'),
       title = CASE WHEN json_array_length(messages) = 2 THEN substr($2, 1, 100) ELSE title END
       WHERE id = $3`,
      [JSON.stringify(updatedMessages), message, req.params.id]
    );

    res.json({ success: true, data: assistantMessage });
  } catch (error) {
    logger.error("Send message failed", { error });
    res.status(500).json({ success: false, error: "Failed to send message" });
  }
}

export async function sendMessageStream(req: AuthRequest, res: Response) {
  try {
    const { message, model, provider } = req.body;

    const chatResult = await query(
      "SELECT messages, model, provider FROM chats WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );

    if (chatResult.rows.length === 0) {
      res.status(404).json({ success: false, error: "Chat not found" });
      return;
    }

    const chat = chatResult.rows[0];
    const messages = parseJsonField<Record<string, unknown>[]>(chat.messages) || [];

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    const history = messages.map((m) => ({
      role: m.role as string,
      content: m.content as string,
    }));
    history.push({ role: "user", content: message });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    res.write(`data: ${JSON.stringify({ type: "user", message: userMessage })}\n\n`);

    try {
      const aiResponse = await fetch(`${AI_SERVICE_URL}/api/ai/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          model: model || chat.model,
          provider: provider || chat.provider,
          stream: true,
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`AI service error: ${aiResponse.statusText}`);
      }

      const reader = aiResponse.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                res.write(`data: ${JSON.stringify({ type: "token", content: parsed.content })}\n\n`);
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      }

      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullContent,
        timestamp: new Date().toISOString(),
        model: chat.model,
      };

      res.write(`data: ${JSON.stringify({ type: "done", message: assistantMessage })}\n\n`);
      res.end();

      const updatedMessages = [...messages, userMessage, assistantMessage];
      await query(
        `UPDATE chats SET messages = $1, updated_at = datetime('now'),
         title = CASE WHEN json_array_length(messages) = 2 THEN substr($2, 1, 100) ELSE title END
         WHERE id = $3`,
        [JSON.stringify(updatedMessages), message, req.params.id]
      );
    } catch (error) {
      logger.error("Stream error", { error });
      res.write(`data: ${JSON.stringify({ type: "error", content: "AI service unavailable" })}\n\n`);
      res.end();
    }
  } catch (error) {
    logger.error("Send message stream failed", { error });
    res.status(500).json({ success: false, error: "Failed to stream message" });
  }
}
