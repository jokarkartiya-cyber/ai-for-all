import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Layout } from "./components/layout/Layout";
import { AuthGuard } from "./components/auth/AuthGuard";
import { LoginPage } from "./components/auth/LoginPage";
import { SignupPage } from "./components/auth/SignupPage";
import { ForgotPasswordPage } from "./components/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./components/auth/ResetPasswordPage";
import { VerifyEmailPage } from "./components/auth/VerifyEmailPage";
import { AdminPage } from "./components/admin/AdminPage";
import { ChatPage } from "./components/chat/ChatPage";
import { EditorPage } from "./components/editor/EditorPage";
import { SettingsPage } from "./components/settings/SettingsPage";

export function App() {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Toaster
        position="top-right"
        toastOptions={{
          className: "!bg-surface-900 !text-white !rounded-lg",
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route index element={<ChatPage />} />
          <Route path="editor" element={<EditorPage />} />
          <Route path="editor/:projectId" element={<EditorPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
