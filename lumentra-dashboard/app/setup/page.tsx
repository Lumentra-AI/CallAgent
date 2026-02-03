"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { Loader2 } from "lucide-react";
import { get } from "@/lib/api/client";
import type { SetupStep } from "@/types";

interface ProgressResponse {
  step: SetupStep;
  completed: boolean;
}

export default function SetupPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { tenants, isLoading: tenantLoading, refreshTenants } = useTenant();
  const router = useRouter();
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // Check for completed setup or redirect to current step
  useEffect(() => {
    async function checkProgress() {
      if (!authLoading && !tenantLoading && user) {
        // If user has active tenants, go to dashboard
        if (tenants.length > 0) {
          const activeTenants = tenants.filter((t) => t.is_active);
          if (activeTenants.length > 0) {
            router.replace("/dashboard");
            return;
          }
        }

        // Load setup progress and redirect to current step
        setLoadingProgress(true);
        try {
          const progress = await get<ProgressResponse>("/api/setup/progress");

          if (progress.completed) {
            // Refresh tenants and redirect to dashboard
            await refreshTenants();
            router.replace("/dashboard");
          } else {
            // Redirect to current step
            router.replace(`/setup/${progress.step}`);
          }
        } catch {
          // No progress yet, start from beginning
          router.replace("/setup/business");
        } finally {
          setLoadingProgress(false);
        }
      }
    }

    checkProgress();
  }, [authLoading, tenantLoading, user, tenants, router, refreshTenants]);

  if (authLoading || tenantLoading || loadingProgress) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Loading your progress...
        </p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Redirecting...</p>
    </div>
  );
}
