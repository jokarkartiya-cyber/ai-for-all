import { useState, useEffect } from "react";
import { Button } from "@/components/common";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";
import api from "@/services/api";
import { Key, Smartphone, Trash2, Copy, Check, Plus } from "lucide-react";

interface ApiKeyItem {
  id: string;
  name: string;
  provider: string;
  last_used: string | null;
  created_at: string;
}

interface SessionItem {
  id: string;
  device: string;
  ip: string;
  last_active: string;
  created_at: string;
}

export function SettingsPage() {
  const { user, updateSettings } = useAuthStore();
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyProvider, setNewKeyProvider] = useState("openai");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light" | "system">(user?.settings.theme || "dark");
  const [fontSize, setFontSize] = useState(user?.settings.fontSize || 14);
  const [tabSize, setTabSize] = useState(user?.settings.tabSize || 2);
  const [autoSave, setAutoSave] = useState(user?.settings.autoSave ?? true);
  const [minimap, setMinimap] = useState(user?.settings.minimap ?? true);
  const [lineNumbers, setLineNumbers] = useState(user?.settings.lineNumbers ?? true);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [language, setLanguage] = useState(user?.settings.language || "en");

  useEffect(() => {
    loadApiKeys();
    loadSessions();
  }, []);

  const loadApiKeys = async () => {
    try {
      const { data } = await api.get("/user/api-keys");
      setApiKeys(data.data || []);
    } catch {
      // ignore
    }
  };

  const loadSessions = async () => {
    try {
      const { data } = await api.get("/user/sessions");
      setSessions(data.data || []);
    } catch {
      // ignore
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const { data } = await api.post("/user/api-keys", { name: newKeyName, provider: newKeyProvider });
      if (data.data.rawKey) {
        setRevealedKey(data.data.rawKey);
        setCopiedKey(false);
      }
      setShowNewKeyForm(false);
      setNewKeyName("");
      loadApiKeys();
      toast.success("API key created");
    } catch {
      toast.error("Failed to create API key");
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      await api.delete(`/user/api-keys/${id}`);
      loadApiKeys();
      toast.success("API key deleted");
    } catch {
      toast.error("Failed to delete API key");
    }
  };

  const handleRevokeSession = async (id: string) => {
    try {
      await api.delete(`/user/sessions/${id}`);
      loadSessions();
      toast.success("Session revoked");
    } catch {
      toast.error("Failed to revoke session");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const { data } = await api.post("/upload/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAvatar(data.data.avatar);
      toast.success("Avatar uploaded");
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.patch("/user/profile", { username, avatar });
      toast.success("Profile saved");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Fill in both fields");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    setChangingPassword(true);
    try {
      await api.put("/user/password", { currentPassword, newPassword });
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        theme: theme as "dark" | "light" | "system",
        fontSize,
        tabSize,
        autoSave,
        minimap,
        lineNumbers,
        language,
      });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
            Settings
          </h1>
          <p className="text-surface-500 text-sm mt-1">
            Customize your coding experience
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white">
            Appearance
          </h2>
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Theme</label>
              <select
                className="input w-40"
                value={theme}
                onChange={(e) => setTheme(e.target.value as "dark" | "light" | "system")}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Font Size</label>
              <input
                type="number"
                className="input w-20 text-center"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                min={10}
                max={30}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Language</label>
              <select className="input w-32" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
                <option value="ar">Arabic</option>
                <option value="pt">Portuguese</option>
                <option value="ru">Russian</option>
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white">
            Profile
          </h2>
          <div className="card space-y-4">
            <div>
              <label className="text-xs font-medium text-surface-500 block mb-1">Username</label>
              <input className="input w-full h-8 text-xs" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-500 block mb-1">Avatar</label>
              <div className="flex items-center gap-3">
                <input type="file" accept="image/*" className="input w-full h-8 text-xs file:mr-2 file:py-0.5 file:px-2 file:border-0 file:bg-primary-500 file:text-white file:rounded file:text-xs" onChange={handleAvatarUpload} />
                {uploadingAvatar && <span className="text-xs text-surface-400">Uploading...</span>}
              </div>
              {avatar && <img src={avatar.startsWith("http") ? avatar : `${import.meta.env.VITE_API_URL || "/api"}/..${avatar}`} alt="preview" className="mt-2 w-10 h-10 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveProfile} loading={savingProfile}>Save Profile</Button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white">
            Editor
          </h2>
          <div className="card space-y-4">
            <ToggleOption
              label="Auto Save"
              checked={autoSave}
              onChange={setAutoSave}
            />
            <ToggleOption
              label="Minimap"
              checked={minimap}
              onChange={setMinimap}
            />
            <ToggleOption
              label="Line Numbers"
              checked={lineNumbers}
              onChange={setLineNumbers}
            />
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Tab Size</label>
              <select
                className="input w-20"
                value={tabSize}
                onChange={(e) => setTabSize(Number(e.target.value))}
              >
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={8}>8</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving}>
            Save Settings
          </Button>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2">
            <Key className="h-4 w-4" /> API Keys
          </h2>
          <div className="card divide-y divide-surface-200 dark:divide-surface-700">
            {apiKeys.length === 0 && !showNewKeyForm && (
              <div className="p-4 text-sm text-surface-500 text-center">
                No API keys yet. Add one to use external providers.
              </div>
            )}
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-surface-400">{key.provider} &middot; Created {new Date(key.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => handleDeleteKey(key.id)} className="btn-ghost p-1.5 text-red-500" title="Delete key">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {showNewKeyForm ? (
              <div className="p-4 space-y-3">
                <input className="input w-full h-8 text-xs" placeholder="Key name..." value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
                <select className="input w-full h-8 text-xs" value={newKeyProvider} onChange={(e) => setNewKeyProvider(e.target.value)}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Gemini</option>
                  <option value="deepseek">DeepSeek</option>
                </select>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateKey}>Create</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewKeyForm(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3">
                <Button size="sm" variant="ghost" onClick={() => setShowNewKeyForm(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Key
                </Button>
              </div>
            )}
          </div>
          {revealedKey && (
            <div className="card p-4 space-y-2 border-green-200 dark:border-green-800">
              <p className="text-xs font-medium text-green-600 dark:text-green-400">Key created — copy it now, it won't be shown again:</p>
              <div className="flex gap-2">
                <code className="flex-1 p-2 text-xs bg-surface-100 dark:bg-surface-800 rounded font-mono break-all">{revealedKey}</code>
                <button onClick={() => { navigator.clipboard.writeText(revealedKey); setCopiedKey(true); }} className="btn-ghost p-2">
                  {copiedKey ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white">
            Change Password
          </h2>
          <div className="card space-y-4">
            <input
              type="password"
              className="input w-full h-8 text-xs"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <input
              type="password"
              className="input w-full h-8 text-xs"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleChangePassword} loading={changingPassword}>
                Change Password
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> Active Sessions
          </h2>
          <div className="card divide-y divide-surface-200 dark:divide-surface-700">
            {sessions.length === 0 && (
              <div className="p-4 text-sm text-surface-500 text-center">No active sessions.</div>
            )}
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{s.device || "Unknown device"}</p>
                  <p className="text-xs text-surface-400">{s.ip} &middot; Last active: {new Date(s.last_active).toLocaleString()}</p>
                </div>
                <button onClick={() => handleRevokeSession(s.id)} className="btn-ghost p-1.5 text-red-500" title="Revoke session">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ToggleOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium">{label}</label>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          checked ? "bg-primary-500" : "bg-surface-300 dark:bg-surface-600"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
