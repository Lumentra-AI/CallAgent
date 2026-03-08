"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard, AuthLogo } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { buildAuthCallbackUrl } from "@/lib/supabase/auth-redirect";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, Loader2, MailCheck, RefreshCw } from "lucide-react";

const RESEND_COOLDOWN_MS = 60_000;

function getResendStorageKey(email: string): string {
  return `verify-email:last-resend:${email.toLowerCase()}`;
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isConfigured } = useAuth();
  const supabase = createClient();
  const emailFromQuery = searchParams.get("email");
  const resolvedEmail = user?.email || emailFromQuery || "";
  const storageKey = useMemo(
    () => (resolvedEmail ? getResendStorageKey(resolvedEmail) : null),
    [resolvedEmail],
  );

  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(() => {
    if (typeof window === "undefined" || !storageKey) return 0;
    const stored = Number(window.localStorage.getItem(storageKey) || 0);
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  });
  const [now, setNow] = useState(() => Date.now());

  const resendCooldownSeconds = Math.max(
    0,
    Math.ceil((resendAvailableAt - now) / 1000),
  );

  const checkVerification = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setIsChecking(true);
    setError("");

    const {
      data: { user: refreshedUser },
      error: refreshError,
    } = await supabase.auth.getUser();

    if (refreshError) {
      setError("Unable to refresh your verification status right now.");
      setIsChecking(false);
      return;
    }

    if (refreshedUser?.email_confirmed_at) {
      router.replace("/setup");
      return;
    }

    setStatusMessage(
      "Still waiting for the verification link to be clicked. Once it is, you can continue to setup.",
    );
    setIsChecking(false);
  }, [router, supabase]);

  const handleResend = useCallback(async () => {
    if (!supabase || !resolvedEmail) {
      setError("Verification email resend is not available right now.");
      return;
    }

    setIsResending(true);
    setError("");
    setStatusMessage("");

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: resolvedEmail,
      options: {
        emailRedirectTo: buildAuthCallbackUrl(window.location.origin),
      },
    });

    if (resendError) {
      setError(resendError.message);
      setIsResending(false);
      return;
    }

    const availableAt = Date.now() + RESEND_COOLDOWN_MS;
    setResendAvailableAt(availableAt);
    setNow(Date.now());
    setStatusMessage(`We sent a fresh verification link to ${resolvedEmail}.`);

    if (storageKey) {
      window.localStorage.setItem(storageKey, String(availableAt));
    }

    setIsResending(false);
  }, [resolvedEmail, storageKey, supabase]);

  useEffect(() => {
    if (user?.email_confirmed_at) {
      router.replace("/setup");
    }
  }, [router, user]);

  useEffect(() => {
    if (resendAvailableAt <= now) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [resendAvailableAt, now]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void checkVerification();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [checkVerification, supabase]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <AuthCard className="text-center">
        <div className="mb-6 flex justify-center">
          <AuthLogo />
        </div>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-8 w-8 text-primary" />
        </div>

        <h1 className="text-2xl font-bold text-foreground">
          Verify your email
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We sent a verification link to{" "}
          <strong>{resolvedEmail || "the email you used to sign up"}</strong>.
          Open that message, click the link, then return here to continue.
        </p>

        <div className="mt-4 rounded-lg border border-border/60 bg-muted/40 p-4 text-left text-sm text-muted-foreground">
          Your account is signed in, but setup stays locked until the email
          address is confirmed. OAuth sign-ins skip this because the provider
          already verifies the email.
        </div>

        {statusMessage && (
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm text-foreground">
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 grid gap-3">
          <Button
            onClick={() => void handleResend()}
            disabled={
              !isConfigured ||
              !supabase ||
              !resolvedEmail ||
              isResending ||
              resendCooldownSeconds > 0
            }
          >
            {isResending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending email...
              </>
            ) : resendCooldownSeconds > 0 ? (
              `Resend in ${resendCooldownSeconds}s`
            ) : (
              "Resend verification email"
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => void checkVerification()}
            disabled={!supabase || isChecking}
          >
            {isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking status...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check again
              </>
            )}
          </Button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Need a different account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Go to login
          </Link>
        </p>
      </AuthCard>
    </div>
  );
}
