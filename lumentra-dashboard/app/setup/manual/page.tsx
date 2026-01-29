"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import SetupWizard from "@/components/SetupWizard";
import { Loader2 } from "lucide-react";

export default function ManualSetupPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { tenants, isLoading: tenantLoading } = useTenant();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // Redirect to dashboard if user already has tenants
  useEffect(() => {
    if (!authLoading && !tenantLoading && user && tenants.length > 0) {
      router.replace("/dashboard");
    }
  }, [authLoading, tenantLoading, user, tenants, router]);

  if (authLoading || tenantLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  if (tenants.length > 0) {
    return null; // Will redirect to dashboard
  }

  return <SetupWizard />;
}
