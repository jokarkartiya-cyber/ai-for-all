import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import api from "@/services/api";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"loading" | "verified" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("No verification token provided.");
      return;
    }

    const verify = async () => {
      try {
        await api.post("/auth/verify-email", { token });
        setStatus("verified");
      } catch (err: unknown) {
        setStatus("error");
        setError(
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "Verification failed. The link may have expired."
        );
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-950 dark:to-surface-900 p-4">
      <div className="w-full max-w-md card p-8 text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 mx-auto text-primary-500 animate-spin" />
            <h1 className="text-xl font-semibold">Verifying your email...</h1>
          </>
        )}
        {status === "verified" && (
          <>
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <h1 className="text-xl font-semibold">Email Verified!</h1>
            <p className="text-sm text-surface-500">Your email has been verified successfully.</p>
            <Link to="/login" className="btn-primary inline-block px-6 py-2 text-sm rounded-lg">
              Sign In
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-12 w-12 mx-auto text-red-500" />
            <h1 className="text-xl font-semibold">Verification Failed</h1>
            <p className="text-sm text-red-500">{error}</p>
            <Link to="/login" className="text-primary-500 text-sm hover:text-primary-600">
              Back to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
