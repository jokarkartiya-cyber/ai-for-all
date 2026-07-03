import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/cn";
import { Spinner } from "@/components/common";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import {
  Send,
  Square,
  RefreshCw,
  Copy,
  Check,
  Bot,
  User,
  ExternalLink,
  Pencil,
  X,
  Upload,
} from "lucide-react";
import type { Message } from "@shared/types/chat";
import type { ComponentProps } from "react";

export function ChatPage() {
  const {
    currentChat,
    isStreaming,
    isLoading,
    sendMessage,
    importChats,
    stopGeneration,
  } = useChatStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat?.messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const content = input.trim();
    setInput("");
    await sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {currentChat ? (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
              {currentChat.messages.map((message, idx) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isStreaming={isStreaming && idx === currentChat.messages.length - 1}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-surface-200 dark:border-surface-700 p-4">
            <div className="max-w-3xl mx-auto">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  className="input resize-none pr-12 py-3 min-h-[52px] max-h-[200px]"
                  placeholder="Ask anything about your code..."
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isStreaming}
                />
                {isStreaming ? (
                  <button
                    onClick={stopGeneration}
                    className="absolute right-2 bottom-2 p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    <Square className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="absolute right-2 bottom-2 p-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <Bot className="h-12 w-12 mx-auto text-primary-500" />
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white">
              ai for all
            </h2>
            <p className="text-surface-500 text-sm">
              Your AI coding assistant. Ask me anything about your code,
              generate new features, fix bugs, or refactor your project.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                "Explain this code",
                "Find bugs",
                "Optimize performance",
                "Generate tests",
                "Refactor this",
                "Add documentation",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  className="btn-secondary text-xs"
                  onClick={() => {
                    setInput(suggestion);
                    textareaRef.current?.focus();
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <label className="btn-secondary text-xs inline-flex items-center gap-1 cursor-pointer">
              <Upload className="h-3 w-3" /> Import Chats
              <input type="file" accept=".json" className="hidden" onChange={async (e) => { if (e.target.files?.[0]) { await importChats(e.target.files[0]); e.target.value = ""; } }} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function CodeBlock({ className, children, ...props }: ComponentProps<"code">) {
  const navigate = useNavigate();
  const isInline = !className;

  if (isInline) {
    return <code className={className} {...props}>{children}</code>;
  }

  return (
    <div className="relative group">
      <div className="flex items-center justify-between px-4 py-1.5 bg-surface-200 dark:bg-surface-700 rounded-t-lg text-xs text-surface-500">
        <span>{className?.replace("language-", "") || "code"}</span>
        <button
          onClick={() => navigate("/editor")}
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity btn-ghost p-1 text-xs"
          title="Open in Editor"
        >
          <ExternalLink className="h-3 w-3" />
          Editor
        </button>
      </div>
      <code className={className} {...props}>
        {children}
      </code>
    </div>
  );
}

function MessageBubble({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const { regenerateMessage, updateMessage } = useChatStore();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditSave = async () => {
    if (editContent.trim() && editContent !== message.content) {
      await updateMessage(message.id, editContent.trim());
    }
    setEditing(false);
  };

  const displayContent = message.content + (isStreaming ? " ▌" : "");

  return (
    <div
      className={cn(
        "flex gap-3",
        message.role === "user" ? "justify-end" : "justify-start"
      )}
    >
      {message.role !== "user" && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary-600 dark:text-primary-400" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] space-y-2",
          message.role === "user" && "order-first"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            message.role === "user"
              ? "bg-primary-500 text-white"
              : "bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100"
          )}
        >
          {message.role === "user" ? (
            editing ? (
              <div className="space-y-2">
                <textarea
                  className="w-full bg-white/20 rounded p-2 text-sm resize-none min-h-[60px]"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditing(false)} className="text-xs btn-ghost p-1"><X className="h-3 w-3" /></button>
                  <button onClick={handleEditSave} className="text-xs btn-ghost p-1"><Check className="h-3 w-3" /></button>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            )
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown components={{ code: CodeBlock }}>{displayContent}</ReactMarkdown>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-1">
          {isStreaming ? (
            <span className="text-xs text-primary-500 animate-pulse">Generating...</span>
          ) : (
            <>
              <span className="text-xs text-surface-400">
                {formatDate(message.timestamp)}
              </span>
              {message.role === "assistant" && (
                <button
                  onClick={handleCopy}
                  className="btn-ghost p-1 text-surface-400 hover:text-surface-600"
                  title="Copy response"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              )}
              {message.role === "assistant" && (
                <button
                  onClick={regenerateMessage}
                  className="btn-ghost p-1 text-surface-400 hover:text-surface-600"
                  title="Regenerate"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              )}
              {message.role === "user" && !editing && (
                <button
                  onClick={() => { setEditContent(message.content); setEditing(true); }}
                  className="btn-ghost p-1 text-surface-400 hover:text-surface-600"
                  title="Edit"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {message.role === "user" && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-200 dark:bg-surface-700 flex items-center justify-center">
          <User className="h-4 w-4 text-surface-500" />
        </div>
      )}
    </div>
  );
}
