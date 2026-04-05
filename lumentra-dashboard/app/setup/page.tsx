"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/context/TenantContext";
import { ApiClientError, get } from "@/lib/api/client";
import { Loader2 } from "lucide-react";
import type { SetupStep } from "@/types";

interface ProgressResponse {
  step: SetupStep;
  completed: boolean;
  tenantId?: string;
}

export default function SetupPage() {
  const { isLoading: tenantLoading, refreshTenants } = useTenant();
  const router = useRouter();
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Check for completed setup or redirect to current step
  // Auth is handled by middleware - if we're here, user is authenticated
  useEffect(() => {
    async function checkProgress() {
      if (!tenantLoading) {
        // Load setup progress and redirect to current step
        setLoadingProgress(true);
        try {
          const progress = await get<ProgressResponse>("/api/setup/progress");

          if (progress.completed || progress.tenantId) {
            await refreshTenants();
            router.replace("/dashboard");
          } else {
            router.replace(`/setup/${progress.step}`);
          }
        } catch (error) {
          if (
            error instanceof ApiClientError &&
            error.status === 403 &&
            /email verification required/i.test(error.message)
          ) {
            router.replace("/verify-email");
          } else {
            // No progress yet, start from beginning
            router.replace("/setup/business");
          }
        } finally {
          setLoadingProgress(false);
        }
      }
    }

    checkProgress();
  }, [tenantLoading, router, refreshTenants]);

  if (tenantLoading || loadingProgress) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Loading your progress...
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Redirecting...</p>
    </div>
  );
}
