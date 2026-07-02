import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/common";
import { Lock, CheckCircle } from "lucide-react";
import api from "@/services/api";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-red-500">Invalid reset link. No token provided.</p>
          <Link to="/forgot-password" className="text-primary-500 text-sm">Request a new link</Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-950 dark:to-surface-900 p-4">
        <div className="w-full max-w-md card p-8 text-center space-y-4">
          <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
          <h1 className="text-xl font-semibold">Password Reset!</h1>
          <p className="text-sm text-surface-500">Your password has been updated.</p>
          <button onClick={() => navigate("/login")} className="btn-primary inline-block px-6 py-2 text-sm rounded-lg">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-950 dark:to-surface-900 p-4">
      <div className="w-full max-w-md card p-8 space-y-6">
        <div className="text-center space-y-2">
          <Lock className="h-10 w-10 mx-auto text-primary-500" />
          <h1 className="text-xl font-semibold">Reset Password</h1>
          <p className="text-sm text-surface-500">Enter your new password.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="input w-full"
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <input
            className="input w-full"
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            Reset Password
          </Button>
        </form>
      </div>
    </div>
  );
}
