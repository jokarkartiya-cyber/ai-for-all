import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/common";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import api from "@/services/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch {
      setError("Failed to send reset email. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-950 dark:to-surface-900 p-4">
        <div className="w-full max-w-md card p-8 text-center space-y-4">
          <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
          <h1 className="text-xl font-semibold">Check Your Email</h1>
          <p className="text-sm text-surface-500">
            If an account exists for {email}, we've sent a password reset link.
          </p>
          <Link to="/login" className="btn-primary inline-block px-6 py-2 text-sm rounded-lg">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-950 dark:to-surface-900 p-4">
      <div className="w-full max-w-md card p-8 space-y-6">
        <div className="text-center space-y-2">
          <Mail className="h-10 w-10 mx-auto text-primary-500" />
          <h1 className="text-xl font-semibold">Forgot Password?</h1>
          <p className="text-sm text-surface-500">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="input w-full"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            Send Reset Link
          </Button>
        </form>

        <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-primary-500 hover:text-primary-600">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
        </Link>
      </div>
    </div>
  );
}
