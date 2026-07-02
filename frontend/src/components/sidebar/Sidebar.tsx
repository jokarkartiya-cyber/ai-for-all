import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { cn } from "@/utils/cn";
import {
  MessageSquare,
  Search,
  Plus,
  Settings,
  Trash2,
  Pin,
  PinOff,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Shield,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ConversationSummary } from "@shared/types/chat";

export function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    chats,
    searchQuery,
    setSearchQuery,
    loadChats,
    selectChat,
    createChat,
    deleteChat,
    renameChat,
    togglePin,
    currentChat,
  } = useChatStore();
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const handleCreateChat = async () => {
    const id = await createChat();
    selectChat(id);
  };

  const handleRenameStart = (chat: ConversationSummary) => {
    setEditingId(chat.id);
    setEditTitle(chat.title);
  };

  const handleRenameEnd = async () => {
    if (editingId && editTitle.trim()) {
      await renameChat(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const filteredChats = chats.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedChats = filteredChats.filter((c) => c.pinned);
  const unpinnedChats = filteredChats.filter((c) => !c.pinned);

  return (
    <aside
      className={cn(
        "panel flex flex-col h-full transition-all duration-200",
        collapsed ? "w-12" : "w-64"
      )}
    >
      <div className="flex items-center justify-between p-3 border-b border-surface-200 dark:border-surface-700">
        {!collapsed && (
          <span className="font-semibold text-sm">ai for all</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="btn-ghost p-1"
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="p-2">
            <button
              onClick={handleCreateChat}
              className="btn-primary w-full gap-2"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </button>
          </div>

          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                className="input pl-8 h-8 text-xs"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
            {pinnedChats.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={currentChat?.id === chat.id}
                isEditing={editingId === chat.id}
                editTitle={editTitle}
                onSelect={() => selectChat(chat.id)}
                onDelete={() => deleteChat(chat.id)}
                onRenameStart={() => handleRenameStart(chat)}
                onRenameEnd={handleRenameEnd}
                onEditTitleChange={setEditTitle}
                onTogglePin={() => togglePin(chat.id)}
              />
            ))}
            {unpinnedChats.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={currentChat?.id === chat.id}
                isEditing={editingId === chat.id}
                editTitle={editTitle}
                onSelect={() => selectChat(chat.id)}
                onDelete={() => deleteChat(chat.id)}
                onRenameStart={() => handleRenameStart(chat)}
                onRenameEnd={handleRenameEnd}
                onEditTitleChange={setEditTitle}
                onTogglePin={() => togglePin(chat.id)}
              />
            ))}
          </nav>

          <div className="border-t border-surface-200 dark:border-surface-700 p-2 space-y-1">
            <button
              onClick={() => navigate("/settings")}
              className="btn-ghost w-full justify-start text-xs"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
            {user?.role === "admin" && (
              <button
                onClick={() => navigate("/admin")}
                className="btn-ghost w-full justify-start text-xs"
              >
                <Shield className="h-4 w-4" />
                Admin
              </button>
            )}
            <button
              onClick={logout}
              className="btn-ghost w-full justify-start text-xs text-red-500 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

function ChatItem({
  chat,
  isActive,
  isEditing,
  editTitle,
  onSelect,
  onDelete,
  onRenameStart,
  onRenameEnd,
  onEditTitleChange,
  onTogglePin,
}: {
  chat: ConversationSummary;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  onSelect: () => void;
  onDelete: () => void;
  onRenameStart: () => void;
  onRenameEnd: () => void;
  onEditTitleChange: (v: string) => void;
  onTogglePin: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
        isActive
          ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
          : "hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300"
      )}
      onClick={onSelect}
    >
      <MessageSquare className="h-4 w-4 shrink-0" />
      {isEditing ? (
        <input
          className="input h-6 text-xs flex-1"
          value={editTitle}
          onChange={(e) => onEditTitleChange(e.target.value)}
          onBlur={onRenameEnd}
          onKeyDown={(e) => e.key === "Enter" && onRenameEnd()}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 truncate">{chat.title}</span>
      )}
      <div className="hidden group-hover:flex items-center gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className="btn-ghost p-1"
          title={chat.pinned ? "Unpin" : "Pin"}
        >
          {chat.pinned ? (
            <PinOff className="h-3 w-3" />
          ) : (
            <Pin className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRenameStart();
          }}
          className="btn-ghost p-1"
          title="Rename"
        >
          <MessageSquare className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="btn-ghost p-1 text-red-500"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
