"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordRequirements } from "@/components/auth";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { validatePassword } from "@/lib/utils/password";

export default function ProfilePage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const passwordValidation = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword;
  const canChangePassword =
    currentPassword.length > 0 &&
    passwordValidation.valid &&
    passwordsMatch &&
    !isUpdating;

  const handlePasswordChange = async () => {
    if (!canChangePassword) return;
    setIsUpdating(true);
    setPasswordMessage(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      if (!supabase) throw new Error("Auth not available");
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setPasswordMessage({ type: "success", text: "Password updated" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update password",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background scrollbar-thin">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Shield className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Account</h1>
            <p className="text-sm text-muted-foreground">
              {user?.email || "Your account"}
            </p>
          </div>
        </div>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div>
            <h2 className="text-sm font-medium text-foreground">
              Change Password
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Use a strong, unique password.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <PasswordRequirements password={newPassword} />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">
                Confirm New Password
              </Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-destructive">
                  Passwords do not match
                </p>
              )}
            </div>
          </div>

          {passwordMessage && (
            <p
              className={cn(
                "text-sm",
                passwordMessage.type === "success"
                  ? "text-emerald-500"
                  : "text-destructive",
              )}
            >
              {passwordMessage.text}
            </p>
          )}

          <Button
            disabled={!canChangePassword}
            onClick={handlePasswordChange}
            className="mt-2"
          >
            {isUpdating ? "Updating..." : "Update Password"}
          </Button>
        </section>
      </div>
    </div>
  );
}
