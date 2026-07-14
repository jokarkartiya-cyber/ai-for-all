import crypto from "crypto";
import { Response } from "express";
import { query } from "../config/database";
import { logger } from "../utils/logger";
import { parseJsonField } from "../utils/db";
import type { AuthRequest } from "../middleware/auth";

const AI_SERVICE_URL = "http://127.0.0.1:8000";

function mockAiResponse(messages: { role: string; content: string }[]): string {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
  if (lastMsg.includes("hello") || lastMsg.includes("hi") || lastMsg.includes("hey")) {
    return "Hello! I'm your AI coding assistant. How can I help you today?";
  }
  if (lastMsg.includes("explain") || lastMsg.includes("what is") || lastMsg.includes("how")) {
    return "Great question! Here's what I know:\n\nThis concept involves understanding the core principles and applying them in practice. The key aspects are:\n\n1. **Understanding the basics** — Start with the fundamentals\n2. **Practice regularly** — Apply your knowledge through hands-on coding\n3. **Build projects** — The best way to learn is by building real applications\n\nFeel free to ask for more specific details!";
  }
  if (lastMsg.includes("bug") || lastMsg.includes("error") || lastMsg.includes("fix")) {
    return "Let me help you debug this issue. Common approaches:\n\n1. **Check the error message** — It usually points to the exact problem\n2. **Review recent changes** — What was the last thing you modified?\n3. **Add logging** — Print intermediate values to understand the flow\n\nCan you share the specific error or code snippet?";
  }
  if (lastMsg.includes("generate") || lastMsg.includes("create") || lastMsg.includes("write")) {
    return "I'll help you generate code for that. Here's a template to get started:\n\n```typescript\n// Your implementation here\nfunction solution() {\n  // TODO: Add your logic\n  return result;\n}\n```\n\nLet me know if you need more specific implementation details!";
  }
  return "Thanks for your message! I'm analyzing your request. To give you the best help, could you provide more context about what you're working on? I can assist with:\n\n- Code explanation and debugging\n- Feature implementation\n- Best practices and architecture\n- Testing and optimization";
}

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
    return await response.json() as { content: string; model: string };
  } catch (error) {
    logger.info("AI service not available, using mock response");
    return {
      content: mockAiResponse(messages),
      model: "mock",
    };
  }
}

export async function listChats(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      `SELECT id, title, model, provider, pinned, messages, created_at, updated_at
       FROM chats
       WHERE user_id = $1
       ORDER BY pinned DESC, updated_at DESC`,
      [req.userId]
    );

    const chats = result.rows.map((row) => {
      const msgs = typeof row.messages === 'string' ? JSON.parse(row.messages as string) : (row.messages as any[] || []);
      return {
        id: row.id,
        title: row.title,
        model: row.model,
        provider: row.provider,
        pinned: !!(row.pinned),
        message_count: msgs.length,
        preview: msgs.length > 0 ? msgs[0].content || null : null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

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

export async function exportChat(req: AuthRequest, res: Response) {
  try {
    const result = await query(
      "SELECT id, title, model, provider, messages, created_at, updated_at FROM chats WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Chat not found" });
    }

    const chat = result.rows[0];
    chat.messages = parseJsonField(chat.messages);

    res.json({
      success: true,
      data: JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        chats: [chat],
      }, null, 2),
    });
  } catch (error) {
    logger.error("Export chat failed", { error });
    res.status(500).json({ success: false, error: "Failed to export chat" });
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
        updated_at = NOW()
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
      `UPDATE chats SET pinned = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [newPinned, req.params.id, req.userId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error("Toggle pin failed", { error });
    res.status(500).json({ success: false, error: "Failed to toggle pin" });
  }
}

export async function regenerateMessage(req: AuthRequest, res: Response) {
  try {
    const chatResult = await query(
      "SELECT messages, model, provider FROM chats WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );

    if (chatResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Chat not found" });
    }

    const chat = chatResult.rows[0];
    const messages = parseJsonField<Record<string, unknown>[]>(chat.messages) || [];

    if (messages.length < 2) {
      return res.status(400).json({ success: false, error: "No message to regenerate" });
    }

    const lastUserMsgIndex = messages.length - 2;
    if (messages[lastUserMsgIndex].role !== "user") {
      return res.status(400).json({ success: false, error: "No user message to regenerate from" });
    }

    const history = messages.slice(0, lastUserMsgIndex + 1).map((m) => ({
      role: m.role as string,
      content: m.content as string,
    }));

    const aiResponse = await callAiService(history, chat.model as string, chat.provider as string);

    const assistantMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: aiResponse.content,
      timestamp: new Date().toISOString(),
      model: aiResponse.model,
    };

    const updatedMessages = [...messages.slice(0, lastUserMsgIndex + 1), assistantMessage];

    await query(
      `UPDATE chats SET messages = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedMessages), req.params.id]
    );

    res.json({ success: true, data: assistantMessage });
  } catch (error) {
    logger.error("Regenerate failed", { error });
    res.status(500).json({ success: false, error: "Failed to regenerate" });
  }
}

export async function updateMessage(req: AuthRequest, res: Response) {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: "Content required" });
    }

    const chatResult = await query(
      "SELECT messages FROM chats WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );

    if (chatResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Chat not found" });
    }

    const messages = parseJsonField<Record<string, unknown>[]>(chatResult.rows[0].messages) || [];
    const msgIndex = messages.findIndex((m) => m.id === req.params.messageId);

    if (msgIndex === -1) {
      return res.status(404).json({ success: false, error: "Message not found" });
    }

    messages[msgIndex].content = content;
    messages[msgIndex].edited = true;

    await query(
      "UPDATE chats SET messages = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(messages), req.params.id]
    );

    res.json({ success: true, message: "Message updated" });
  } catch (error) {
    logger.error("Update message failed", { error });
    res.status(500).json({ success: false, error: "Failed to update message" });
  }
}

export async function importChats(req: AuthRequest, res: Response) {
  try {
    const { chats } = req.body;
    if (!Array.isArray(chats) || chats.length === 0) {
      return res.status(400).json({ success: false, error: "Chats array required" });
    }

    const imported = [];
    for (const chat of chats) {
      const result = await query(
        `INSERT INTO chats (user_id, title, model, provider, messages) VALUES ($1, $2, $3, $4, $5) RETURNING id, title`,
        [
          req.userId,
          chat.title || "Imported Chat",
          chat.model || "gpt-4o",
          chat.provider || "openai",
          JSON.stringify(chat.messages || []),
        ]
      );
      imported.push(result.rows[0]);
    }

    logger.info("Chats imported", { userId: req.userId, count: imported.length });
    res.status(201).json({ success: true, data: imported, count: imported.length });
  } catch (error) {
    logger.error("Import chats failed", { error });
    res.status(500).json({ success: false, error: "Failed to import chats" });
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
      `UPDATE chats SET messages = $1, updated_at = NOW(),
       title = CASE WHEN jsonb_array_length(messages::jsonb) = 2 THEN substr($2, 1, 100) ELSE title END
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
        `UPDATE chats SET messages = $1, updated_at = NOW(),
         title = CASE WHEN jsonb_array_length(messages::jsonb) = 2 THEN substr($2, 1, 100) ELSE title END
         WHERE id = $3`,
        [JSON.stringify(updatedMessages), message, req.params.id]
      );
    } catch (error) {
      logger.info("AI stream not available, using mock response");
      const mockContent = mockAiResponse(history);
      for (let i = 0; i < mockContent.length; i += 10) {
        res.write(`data: ${JSON.stringify({ type: "token", content: mockContent.slice(i, i + 10) })}\n\n`);
      }
      const mockAssistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: mockContent,
        timestamp: new Date().toISOString(),
        model: "mock",
      };
      res.write(`data: ${JSON.stringify({ type: "done", message: mockAssistantMessage })}\n\n`);
      res.end();
      const updatedMessages = [...messages, userMessage, mockAssistantMessage];
      await query(
        `UPDATE chats SET messages = $1, updated_at = NOW(),
         title = CASE WHEN jsonb_array_length(messages::jsonb) = 2 THEN substr($2, 1, 100) ELSE title END
         WHERE id = $3`,
        [JSON.stringify(updatedMessages), message, req.params.id]
      );
    }
  } catch (error) {
    logger.error("Send message stream failed", { error });
    res.status(500).json({ success: false, error: "Failed to stream message" });
  }
}
