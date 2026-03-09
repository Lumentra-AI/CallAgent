"use client";

import {
  ConfigProvider,
  useConfig,
  useDemoMode,
} from "@/context/ConfigContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AdminProvider } from "@/context/AdminContext";
import { TenantProvider, useTenant } from "@/context/TenantContext";
import { IndustryProvider } from "@/context/IndustryContext";
import { EscalationProvider } from "@/context/EscalationContext";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import MobileNav from "@/components/dashboard/MobileNav";
import { EscalationDock, EscalationPanel } from "@/components/escalation";
import { SkipLinks } from "@/components/ui/skip-links";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  ShieldX,
  Zap,
  Info,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function LoadingScreen() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card">
          <Zap className="h-8 w-8 text-primary" />
        </div>
      </div>
      <div className="text-center">
        <h1 className="mb-2 text-lg font-semibold text-foreground">Lumentra</h1>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Loading dashboard...
          </span>
        </div>
      </div>
      <div className="mt-8 h-1 w-48 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 animate-pulse bg-primary" />
      </div>
    </div>
  );
}

function SuspendedScreen() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
        <ShieldX className="h-8 w-8 text-destructive" />
      </div>
      <div className="text-center max-w-md px-4">
        <h1 className="mb-2 text-lg font-semibold text-foreground">
          Account Suspended
        </h1>
        <p className="text-sm text-muted-foreground">
          Your account has been suspended. Contact{" "}
          <a
            href="mailto:support@lumentra.ai"
            className="text-primary underline"
          >
            support@lumentra.ai
          </a>{" "}
          for assistance.
        </p>
      </div>
    </div>
  );
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
      </div>
      <div className="text-center max-w-md px-4">
        <h1 className="mb-2 text-lg font-semibold text-foreground">
          Unable to Load Account
        </h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Something went wrong loading your account. Please try again.
        </p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}

function DemoModeBanner() {
  const isDemoMode = useDemoMode();
  const [dismissed, setDismissed] = useState(false);

  if (!isDemoMode || dismissed) return null;

  return (
    <div className="flex items-center justify-between bg-amber-500/15 border-b border-amber-500/20 px-4 py-2">
      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
        <Info className="h-4 w-4 shrink-0" />
        <span>
          Demo Mode - Showing sample data. Connect a tenant to see real data.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-xs text-amber-600/70 hover:text-amber-600 dark:text-amber-400/70 dark:hover:text-amber-400"
      >
        Dismiss
      </button>
    </div>
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isLoading: configLoading } = useConfig();
  const { isLoading: authLoading, user } = useAuth();
  const {
    isLoading: tenantLoading,
    currentTenant,
    tenants,
    error,
    isSuspended,
    refreshTenants,
  } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Redirect to setup if user has no tenants
  useEffect(() => {
    if (
      !authLoading &&
      !tenantLoading &&
      user &&
      tenants.length === 0 &&
      !error
    ) {
      router.replace("/setup");
    }
  }, [authLoading, tenantLoading, user, tenants, error, router]);

  if (authLoading || configLoading || tenantLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoadingScreen />;
  }

  // Show error screen with retry if tenant load failed
  if (error && !currentTenant) {
    return <ErrorScreen onRetry={refreshTenants} />;
  }

  // Show suspended screen
  if (isSuspended) {
    return <SuspendedScreen />;
  }

  if (!currentTenant) {
    return <LoadingScreen />;
  }

  return (
    <>
      {/* Accessibility: Skip Links */}
      <SkipLinks
        links={[
          { href: "#main-content", label: "Skip to main content" },
          { href: "#navigation", label: "Skip to navigation" },
        ]}
      />

      <div className="flex h-screen w-screen overflow-hidden bg-background">
        {/* Desktop Navigation Sidebar */}
        <nav
          id="navigation"
          aria-label="Main navigation"
          className="hidden md:block"
        >
          <Sidebar />
        </nav>

        <div className="flex flex-1 flex-col overflow-hidden">
          <DemoModeBanner />
          <TopBar />
          {/* Main Content with ARIA landmark */}
          <main
            id="main-content"
            role="main"
            aria-label="Dashboard content"
            tabIndex={-1}
            className="flex-1 overflow-hidden outline-none pb-16 md:pb-14"
          >
            {children}
          </main>
        </div>

        {/* Escalation System */}
        <aside aria-label="Escalation queue">
          <EscalationDock />
          <EscalationPanel />
        </aside>
      </div>

      {/* Mobile Navigation */}
      <MobileNav />
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AdminProvider>
          <TenantProvider>
            <ConfigProvider>
              <IndustryProvider>
                <EscalationProvider>
                  <DashboardContent>{children}</DashboardContent>
                </EscalationProvider>
              </IndustryProvider>
            </ConfigProvider>
          </TenantProvider>
        </AdminProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
