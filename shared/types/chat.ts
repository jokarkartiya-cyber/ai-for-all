export interface Chat {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  model: string;
  provider: string;
  pinned: boolean;
  folderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: Date;
  tokens?: number;
  model?: string;
  metadata?: Record<string, unknown>;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  error?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  model: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}
