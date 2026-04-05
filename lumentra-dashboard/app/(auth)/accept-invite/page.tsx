"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, AuthLogo, PasswordRequirements } from "@/components/auth";
import { validatePassword } from "@/lib/utils/password";
import {
  Loader2,
  Lock,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { motion } from "framer-motion";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:3100");

type AcceptResult = "accepted" | "already_accepted" | "failed";

async function callAcceptInvite(
  accessToken: string,
  tenantId: string,
): Promise<AcceptResult> {
  try {
    const res = await fetch(`${API_BASE}/api/team/accept-invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    if (!res.ok) return "failed";
    const data = await res.json();
    return data.already_accepted ? "already_accepted" : "accepted";
  } catch {
    return "failed";
  }
}

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const isExistingUser = searchParams.get("existing") === "1";
  const tenantId = searchParams.get("tid") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const router = useRouter();
  const passwordValidation = validatePassword(password);
  const passwordsMatch = password === confirmPassword;
  const canSubmit =
    !isLoading &&
    isValidSession === true &&
    passwordValidation.valid &&
    passwordsMatch;

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      if (!supabase) {
        setIsValidSession(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setIsValidSession(false);
        return;
      }

      setIsValidSession(true);

      // For existing users, auto-accept and redirect immediately
      if (isExistingUser && tenantId) {
        setIsAccepting(true);
        const result = await callAcceptInvite(session.access_token, tenantId);
        if (result === "accepted" || result === "already_accepted") {
          setSuccess(true);
          setTimeout(() => router.push("/dashboard"), 1500);
        } else {
          setIsAccepting(false);
          setError("Could not accept the invite. Please try again.");
        }
      }
    };

    checkSession();
  }, [isExistingUser, tenantId, router]);

  const handleRetry = () => {
    setError("");
    setIsAccepting(true);
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsAccepting(false);
        setIsValidSession(false);
        return;
      }
      callAcceptInvite(session.access_token, tenantId).then((result) => {
        if (result === "accepted" || result === "already_accepted") {
          setSuccess(true);
          setTimeout(() => router.push("/dashboard"), 1500);
        } else {
          setIsAccepting(false);
          setError("Could not accept the invite. Please try again.");
        }
      });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!passwordValidation.valid) {
      setError(
        passwordValidation.errors[0] ||
          "Password does not meet the minimum security requirements",
      );
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError("Authentication not configured");
      setIsLoading(false);
      return;
    }

    const { error: pwError } = await supabase.auth.updateUser({ password });

    if (pwError) {
      setIsLoading(false);
      setError(pwError.message);
      return;
    }

    // Accept the specific tenant invite
    if (tenantId) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        const result = await callAcceptInvite(session.access_token, tenantId);
        if (result === "failed") {
          setIsLoading(false);
          setError(
            "Password set, but could not accept the invite. Please try logging in.",
          );
          return;
        }
      }
    }

    setIsLoading(false);
    setSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  };

  // Loading state
  if (isValidSession === null || isAccepting) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Existing user: accept failed -- show retry UI instead of password form
  if (isExistingUser && isValidSession && error && !success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <AuthCard className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-6 w-full" onClick={handleRetry}>
            Try again
          </Button>
          <Link href="/dashboard">
            <Button variant="ghost" className="mt-2 w-full">
              Go to dashboard
            </Button>
          </Link>
        </AuthCard>
      </div>
    );
  }

  // No session -- different messages for existing vs new users
  if (!isValidSession) {
    if (isExistingUser) {
      // Preserve tid in the redirect so it survives the login round-trip
      const returnPath = tenantId
        ? `/accept-invite?existing=1&tid=${tenantId}`
        : "/accept-invite?existing=1";
      const encodedReturn = encodeURIComponent(returnPath);

      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <AuthCard className="text-center">
            <div className="flex justify-center mb-4">
              <AuthLogo />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Accept your invite
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to accept your team invitation and access the dashboard.
            </p>
            <Link href={`/login?redirect=${encodedReturn}`}>
              <Button className="mt-6 w-full">Sign in to accept</Button>
            </Link>
          </AuthCard>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <AuthCard className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Invalid or expired invite
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invite link is invalid or has expired. Please contact your
            administrator for a new invitation.
          </p>
          <Link href="/login">
            <Button className="mt-6 w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to login
            </Button>
          </Link>
        </AuthCard>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <AuthCard className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">All set</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isExistingUser
              ? "Invite accepted. Taking you to the dashboard..."
              : "Your password has been set. Taking you to the dashboard..."}
          </p>
          <Link href="/dashboard">
            <Button className="mt-6 w-full">Go to dashboard</Button>
          </Link>
        </AuthCard>
      </div>
    );
  }

  // Password form -- only shown for new users (not existing user flow)
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <AuthCard>
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <AuthLogo />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome to Lumentra
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Set your password to get started
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Choose a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            <PasswordRequirements password={password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up your account...
              </>
            ) : (
              "Set password and continue"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </AuthCard>
    </div>
  );
}
