import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Chat, Message, ConversationSummary } from "@shared/types/chat";
import api from "@/services/api";

interface ChatState {
  chats: ConversationSummary[];
  currentChat: Chat | null;
  isStreaming: boolean;
  isLoading: boolean;
  searchQuery: string;
  abortController: AbortController | null;
  setSearchQuery: (query: string) => void;
  loadChats: () => Promise<void>;
  selectChat: (id: string) => Promise<void>;
  createChat: () => Promise<string>;
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  deleteChat: (id: string) => Promise<void>;
  renameChat: (id: string, title: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  exportChat: (id: string) => Promise<string>;
}

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    chats: [],
    currentChat: null,
    isStreaming: false,
    isLoading: false,
    searchQuery: "",
    abortController: null,

    setSearchQuery: (query) => set((state) => { state.searchQuery = query; }),

    loadChats: async () => {
      const { data } = await api.get("/chats");
      set((state) => { state.chats = data.data; });
    },

    selectChat: async (id) => {
      set((state) => { state.isLoading = true; });
      const { data } = await api.get(`/chats/${id}`);
      set((state) => {
        state.currentChat = data.data;
        state.isLoading = false;
      });
    },

    createChat: async () => {
      const { data } = await api.post("/chats");
      set((state) => { state.chats.unshift(data.data); });
      return data.data.id;
    },

    sendMessage: async (content) => {
      const chat = get().currentChat;
      if (!chat) return;

      const abortController = new AbortController();
      set((state) => { state.abortController = abortController; });

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      set((state) => {
        state.currentChat?.messages.push(userMessage);
        state.currentChat?.messages.push(assistantMessage);
        state.isStreaming = true;
      });

      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`/api/chats/${chat.id}/messages/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: content,
            model: chat.model,
            provider: chat.provider,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) throw new Error("Stream failed");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === "token" && parsed.content) {
                  set((state) => {
                    const msgs = state.currentChat?.messages;
                    if (msgs && msgs.length > 0) {
                      msgs[msgs.length - 1].content += parsed.content;
                    }
                  });
                }
                if (parsed.type === "done") {
                  set((state) => { state.isStreaming = false; });
                }
                if (parsed.type === "error") {
                  set((state) => {
                    if (state.currentChat) {
                      const msgs = state.currentChat.messages;
                      if (msgs && msgs.length > 0) {
                        msgs[msgs.length - 1].content = parsed.content || "Error generating response";
                      }
                    }
                    state.isStreaming = false;
                  });
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") {
          set((state) => { state.isStreaming = false; });
          return;
        }
        set((state) => {
          if (state.currentChat) {
            const msgs = state.currentChat.messages;
            if (msgs && msgs.length > 0) {
              const lastMsg = msgs[msgs.length - 1];
              if (!lastMsg.content) {
                lastMsg.content = "⚠️ Failed to get response. Try again.";
              }
            }
          }
          state.isStreaming = false;
        });
      }
    },

    stopGeneration: () => {
      const abortController = get().abortController;
      if (abortController) {
        abortController.abort();
      }
      set((state) => { state.isStreaming = false; });
    },

    deleteChat: async (id) => {
      await api.delete(`/chats/${id}`);
      set((state) => {
        state.chats = state.chats.filter((c) => c.id !== id);
        if (state.currentChat?.id === id) {
          state.currentChat = null;
        }
      });
    },

    renameChat: async (id, title) => {
      await api.patch(`/chats/${id}`, { title });
      set((state) => {
        const chat = state.chats.find((c) => c.id === id);
        if (chat) chat.title = title;
        if (state.currentChat?.id === id) {
          state.currentChat.title = title;
        }
      });
    },

    togglePin: async (id) => {
      await api.post(`/chats/${id}/pin`);
      set((state) => {
        const chat = state.chats.find((c) => c.id === id);
        if (chat) chat.pinned = !chat.pinned;
        if (state.currentChat?.id === id) {
          state.currentChat.pinned = !state.currentChat.pinned;
        }
      });
    },

    exportChat: async (id) => {
      const { data } = await api.get(`/chats/${id}/export`);
      return data.data;
    },
  }))
);
