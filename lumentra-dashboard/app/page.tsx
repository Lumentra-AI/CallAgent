"use client";

import React from "react";
import { ConfigProvider, useConfig } from "@/context/ConfigContext";
import SetupWizard from "@/components/SetupWizard";
import Dashboard from "@/components/dashboard";
import SettingsPanel from "@/components/settings";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { Loader2, Zap, AlertTriangle } from "lucide-react";

// ============================================================================
// LOADING SCREEN
// ============================================================================

function LoadingScreen() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950">
      {/* Animated Logo */}
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-ping rounded-full bg-indigo-500/20" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
          <Zap className="h-8 w-8 text-indigo-500" />
        </div>
      </div>

      {/* Loading Text */}
      <div className="text-center">
        <h1 className="mb-2 text-lg font-semibold text-white">Lumentra Core</h1>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
          <span className="text-sm text-zinc-500">Initializing system...</span>
        </div>
      </div>

      {/* Loading Bar */}
      <div className="mt-8 h-1 w-48 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full w-1/2 animate-pulse bg-indigo-500" />
      </div>
    </div>
  );
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

interface ErrorState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[Lumentra] Error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950 p-8">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="mb-2 text-xl font-semibold text-white">
              Something went wrong
            </h1>
            <p className="mb-6 text-sm text-zinc-400">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error && (
              <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-left">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Error Details
                </div>
                <code className="font-mono text-xs text-red-400">
                  {this.state.error.message}
                </code>
              </div>
            )}
            <button
              onClick={() => {
                localStorage.removeItem("lumentra_config_v2");
                window.location.reload();
              }}
              className="rounded-md bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
            >
              Reset & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// MAIN APP CONTENT
// ============================================================================

function AppContent() {
  const { isLoading, isConfigured, uiState } = useConfig();
  const { currentView } = uiState;

  // Loading state
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Not configured - show wizard
  if (!isConfigured) {
    return <SetupWizard />;
  }

  // Configured - show dashboard or settings
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar />

        {/* Content Area */}
        <main className="flex-1 overflow-hidden">
          {currentView === "dashboard" && <DashboardView />}
          {currentView === "calls" && <CallsView />}
          {currentView === "analytics" && <AnalyticsView />}
          {currentView === "settings" && <SettingsPanel />}
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// VIEW COMPONENTS
// ============================================================================

function DashboardView() {
  const {
    SystemHealth,
    Waveform,
    ActivityLog,
  } = require("@/components/dashboard");

  return (
    <div className="grid h-full grid-cols-[240px_1fr_300px] overflow-hidden">
      {/* Left: System Health */}
      <div className="overflow-hidden border-r border-zinc-800">
        <SystemHealth />
      </div>

      {/* Center: Waveform Visualizer */}
      <div className="overflow-hidden">
        <Waveform />
      </div>

      {/* Right: Activity Log */}
      <div className="overflow-hidden">
        <ActivityLog />
      </div>
    </div>
  );
}

function CallsView() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
          <span className="text-2xl">...</span>
        </div>
        <h2 className="mb-2 text-lg font-semibold text-white">Call History</h2>
        <p className="text-sm text-zinc-500">
          Call logs and recordings coming soon
        </p>
      </div>
    </div>
  );
}

function AnalyticsView() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
          <span className="text-2xl">...</span>
        </div>
        <h2 className="mb-2 text-lg font-semibold text-white">Analytics</h2>
        <p className="text-sm text-zinc-500">
          Detailed reports and charts coming soon
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// ROOT COMPONENT
// ============================================================================

export default function Home() {
  return (
    <ErrorBoundary>
      <ConfigProvider>
        <AppContent />
      </ConfigProvider>
    </ErrorBoundary>
  );
}
