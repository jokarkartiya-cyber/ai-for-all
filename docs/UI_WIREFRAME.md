# UI Wireframe — ai for all

## Design System

**Colors:**
- Primary: blue-600 (#2563eb) / blue-700 (#1d4ed8)
- Surface: white → gray-950 (#030712)
- Accent: emerald/amber/red for status

**Typography:**
- Font: Inter (sans), JetBrains Mono (mono)
- Scale: 10px–24px (text-xs to text-2xl)

**Spacing:**
- Cards: rounded-xl (12px), p-4 (16px)
- Buttons: rounded-lg (8px), px-4 py-2
- Panels: border shadow, surface-50 bg

**Icons:** Lucide React (consistent 14-16px)

---

## Screen 1: Login `/login`
```
┌─────────────────────────────────────┐
│          ┌────────────────┐          │
│          │  Welcome back  │          │
│          │ Sign in to your│          │
│          │   account      │          │
│          └────────────────┘          │
│          ┌────────────────┐          │
│          │ Email input    │          │
│          ├────────────────┤          │
│          │ Password input │          │
│          ├────────────────┤          │
│          │ [Sign in btn]  │          │
│          └────────────────┘          │
│       Don't have an account?         │
│            [Sign up]                 │
└─────────────────────────────────────┘
```

**States:** idle, loading (spinner in btn), error (toast), success (redirect /)

---

## Screen 2: Signup `/signup`
```
┌─────────────────────────────────────┐
│          ┌────────────────┐          │
│          │ Create account │          │
│          │ Start your AI  │          │
│          │ coding journey │          │
│          └────────────────┘          │
│          ┌────────────────┐          │
│          │ Username input │          │
│          ├────────────────┤          │
│          │ Email input    │          │
│          ├────────────────┤          │
│          │ Password input │          │
│          ├────────────────┤          │
│          │[Create account]│          │
│          └────────────────┘          │
│       Already have an account?       │
│             [Sign in]                │
└─────────────────────────────────────┘
```

**States:** idle, loading, validation error (inline), success (redirect /)

---

## Screen 3: Forgot Password `/forgot-password`
```
┌─────────────────────────────────────┐
│          ┌────────────────┐          │
│          │   ✉️ (icon)    │          │
│          │ Forgot Password?│          │
│          │ Enter your email│          │
│          └────────────────┘          │
│          ┌────────────────┐          │
│          │ Email input    │          │
│          ├────────────────┤          │
│          │[Send Reset Link]│          │
│          └────────────────┘          │
│          ← Back to Login             │
└─────────────────────────────────────┘
```

**Success screen:**
```
┌─────────────────────────────────────┐
│          ┌────────────────┐          │
│          │  ✅ (icon)      │          │
│          │ Check Your Email│          │
│          │ We've sent a    │          │
│          │ reset link to   │          │
│          │ you@example.com │          │
│          ├────────────────┤          │
│          │[Back to Login] │          │
│          └────────────────┘          │
└─────────────────────────────────────┘
```

---

## Screen 4: Reset Password `/reset-password?token=...`
```
┌─────────────────────────────────────┐
│          ┌────────────────┐          │
│          │  🔒 (icon)      │          │
│          │ Reset Password  │          │
│          │ Enter new pass  │          │
│          └────────────────┘          │
│          ┌────────────────┐          │
│          │ New password   │          │
│          ├────────────────┤          │
│          │ Confirm pass   │          │
│          ├────────────────┤          │
│          │[Reset Password]│          │
│          └────────────────┘          │
└─────────────────────────────────────┘
```

**States:** missing token (error message), success (✅ Password Reset → Sign In btn)

---

## Screen 5: Verify Email `/verify-email?token=...`
**States only (no form):**
- Loading: spinner + "Verifying your email..."
- Success: ✅ "Email Verified!" + [Sign In]
- Error: ❌ "Verification Failed" + error text + [Back to Login]

---

## Screen 6: Main Chat (default logged-in view) `/`
```
┌──────────────────────────────────────────────────────────┐
│ Sidebar (w-64)                    │     Main Area         │
│ ┌──────────────────┐              │  ┌────────────────┐   │
│ │ ai for all   [X] │              │  │                │   │
│ ├──────────────────┤              │  │  Empty state:   │   │
│ │ [+ New Chat]     │              │  │  🤖 ai for all │   │
│ ├──────────────────┤              │  │                │   │
│ │ 🔍 Search chats  │              │  │  Suggestion grid:│  │
│ ├──────────────────┤              │  │ [Explain code]  │   │
│ │ 📌 Pinned Chats   │              │  │ [Find bugs]     │   │
│ │ ┌──────────────┐ │              │  │ [Optimize] [Tests]│  │
│ │ │ Chat 1 (📌)  │ │              │  │ [Refactor] [Docs]│  │
│ │ │ Chat 2 (📌)  │ │              │  └────────────────┘   │
│ │ └──────────────┘ │                                        │
│ │ Unpinned Chats   │   ── OR when chat active ──           │
│ │ ┌──────────────┐ │  ┌────────────────────────────────┐   │
│ │ │ Chat 3       │ │  │  User message bubble (right)    │   │
│ │ │ Chat 4       │ │  │  ┌──────────────────────────┐   │   │
│ │ │ Chat 5       │ │  │  │ user: "Explain this code"│   │   │
│ │ └──────────────┘ │  │  └──────────────────────────┘   │   │
│ ├──────────────────┤  │  AI response bubble (left)      │   │
│ │ ⚙ Settings       │  │  ┌──────────────────────────┐   │   │
│ │ 👤 Sign out      │  │  │ 🤖 ```python             │   │   │
│ └──────────────────┘  │  │     print("hello")        │   │   │
│                        │  │     [📋 Copy] [📂 Editor]│   │   │
│                        │  │ ```                       │   │   │
│                        │  └──────────────────────────┘   │   │
│                        │  ┌──────────────────────────┐   │   │
│                        │  │ [📋 Copy] [🔄 Regenerate]│   │   │
│                        │  │ 2:30 PM                   │   │   │
│                        │  └──────────────────────────┘   │   │
│                        ├────────────────────────────────┤   │
│                        │  [Ask anything...     [▶ Send]]│   │
│                        └────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**Collapsed sidebar:** icons only (w-12). **States:** loading (spinner), empty (suggestion grid), streaming (Generating... + stop btn), error (toast)

---

## Screen 7: Editor `/editor/:projectId`
```
┌─────────────────────────────────────────────────────────────┐
│ Toolbar ─────────────────────────────────────────────────── │
│ [≡ Explorer] [📂 Open] ProjectName [💾 Save]   [✨ AI] [💬 Chat]│
├────────┬─────────────────────────────────┬──────────────────┤
│Explorer│        ┌──File Tabs──┐          │   AI Sidebar     │
│(w-56) │ │ index.ts │ app.ts ✕ │          │   (w-72)         │
│        │ ├───────────────┤          │ ┌──────────────────┤│
│ .     │ │               │          │ │ ✨ AI Assistant   ││
│ src   │ │  Editor       │          │ ├──────────────────┤│
│  ├─▶   │ │  (Monaco)    │          │ │ [Explain] [Gen]  ││
│ index │ │               │          │ │ [Fix]  [Refactor]││
│  .ts  │ │               │          │ │ ┌──────────────┐ ││
│ app   │ │               │          │ │ │ Instruction  │ ││
│  .ts  │ │               │          │ │ │ (optional)   │ ││
│  .css  │ │               │          │ │ └──────────────┘ ││
│        │ │               │          │ │ [Generate btn]  ││
│        │ │               │          │ ├────────────────┤│
│        │ │               │          │ │ Response text  ││
│        │ │               │          │ │ ┌──────────────┐││
│        │ │               │          │ │ │python code   │││
│        │ │               │          │ │ │ [✅ Apply] [✕]│││
│        │ │               │          │ │ └──────────────┘││
│        │ │               │          │ └──────────────────┘│
├────────┴─────────────────────────────────┴──────────────────┤
│ Status Bar: File.ts · TypeScript · Line 12, Col 4 · UTF-8   │
└─────────────────────────────────────────────────────────────┘
```

**States:** no project open (empty state with button), loading (spinner), project loaded with files

---

## Screen 8: Settings `/settings`
```
┌─────────────────────────────────────────────┐
│ Settings ──────────────────────────────────  │
│ Customize your coding experience            │
│                                              │
│ ┌── Appearance ────────────────────────────┐│
│ │       Theme   [Dark ▼]                   ││
│ │    Font Size  [14]                       ││
│ └──────────────────────────────────────────┘│
│ ┌── Editor ───────────────────────────────┐│
│ │  Auto Save     [🔘]                     ││
│ │  Minimap       [🔘]                     ││
│ │  Line Numbers  [🔘]                     ││
│ │  Tab Size      [2 ▼]                    ││
│ └──────────────────────────────────────────┘│
│                              [Save Settings]│
│ ┌── API Keys ──────────────────────────────┐│
│ │  key1 · openai · Created Jan 1    [🗑]   ││
│ │  key2 · anthropic · Created Jan 2 [🗑]   ││
│ │  [+ Add Key]                             ││
│ └──────────────────────────────────────────┘│
│ ┌── Active Sessions ───────────────────────┐│
│ │  Chrome Win · 192.168.1.1    [🗑]        ││
│ │  Firefox Mac · 10.0.0.1      [🗑]        ││
│ └──────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

**States:** loading, empty lists, raw key revealed (green border card)

---

## Screen 9: Admin Panel `/admin`
```
┌─────────────────────────────────────────────┐
│ ← 🛡 Admin Panel                            │
│                                              │
│ ┌── Users (45) ──────── [Refresh] ────────┐ │
│ │ USER   EMAIL       VERIFIED ROLE  ACTIONS│ │
│ │ alice  a@x.com     Yes       [User ▼] 🗑│ │
│ │ bob    b@x.com     No        [Admin▼] 🗑│ │
│ │ ...                                       │ │
│ ├──────────────────────────────────────────┤ │
│ │          Page 1 of 3 [‹ Prev] [Next ›]   │ │
│ └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**States:** loading, paginated, role change dropdown, delete with confirmation

---

## Navigation / Routing Flow

```
Login ──→ (auth) ──→ Main Chat (/)
Signup ──→ (auth) ──→ Main Chat (/)
                  ↓
            Sidebar ──→ Chat (/)
                  │──→ Editor /editor/:projectId
                  │──→ Settings /settings
                  │──→ Admin /admin (admin only)

Forgot Password ──→ Reset Password ──→ Login
Verify Email ──→ Login
```

---

## Component Hierarchy

```
App
├── Toaster
├── LoginPage
├── SignupPage
├── ForgotPasswordPage
├── ResetPasswordPage
├── VerifyEmailPage
└── AuthGuard
    └── Layout
        ├── Sidebar (chat list, search, pin, rename, delete)
        ├── Verification Banner (if not verified)
        └── Outlet
            ├── ChatPage
            │   ├── WelcomeScreen (suggestion grid)
            │   ├── MessageBubble (user/assistant)
            │   │   ├── CodeBlock (copy, open in editor)
            │   │   └── Actions (copy, regenerate, timestamp)
            │   └── InputArea (textarea + send/stop btn)
            ├── EditorPage
            │   ├── Toolbar (explorer toggle, project picker, save, AI toggle, chat)
            │   ├── FileExplorer (tree, context menu, inline rename/create)
            │   ├── FileTabs (multi-tab, dirty indicator, close)
            │   ├── Monaco Editor (multi-lang, minimap, autosave, keyboard shortcuts)
            │   ├── AiCodeSidebar (explain/generate/fix/refactor + apply/dismiss)
            │   ├── StatusBar (file, language, line:col)
            │   └── ProjectPickerModal (create/open project)
            ├── SettingsPage (appearance, editor, API keys, sessions)
            └── AdminPage (users table, pagination, role/delete)
```
