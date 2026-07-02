import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { useAuthStore } from "@/store/authStore";
import { Spinner } from "@/components/common";
import { X } from "lucide-react";
import { useState } from "react";
import api from "@/services/api";

export function Layout() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const [dismissedVerify, setDismissedVerify] = useState(false);

  const needsVerification = user && !user.emailVerified && !dismissedVerify;

  const handleResendVerification = async () => {
    try {
      await api.post("/auth/send-verification");
    } catch {
      // ignore
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        {needsVerification && (
          <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Please verify your email address.{' '}
              <button onClick={handleResendVerification} className="underline hover:no-underline">
                Resend verification email
              </button>
            </p>
            <button onClick={() => setDismissedVerify(true)} className="btn-ghost p-1">
              <X className="h-3.5 w-3.5 text-amber-500" />
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
