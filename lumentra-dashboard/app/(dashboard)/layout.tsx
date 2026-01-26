"use client";

import { ConfigProvider, useConfig } from "@/context/ConfigContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { IndustryProvider } from "@/context/IndustryContext";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { Loader2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isLoading: configLoading } = useConfig();
  const { isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  if (authLoading || configLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
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
        <ConfigProvider>
          <IndustryProvider>
            <DashboardContent>{children}</DashboardContent>
          </IndustryProvider>
        </ConfigProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
