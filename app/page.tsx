"use client";

import React, { useState, useEffect } from "react";
import {
  ConfigProvider,
  useConfig,
  DEFAULT_CONFIGS,
} from "@/context/ConfigContext";
import DashboardLayout from "@/components/DashboardLayout";
import LiveMonitor from "@/components/LiveMonitor";
import SettingsPanel from "@/components/SettingsPanel";

type ViewType = "monitor" | "settings";

function DashboardContent() {
  const [activeView, setActiveView] = useState<ViewType>("monitor");
  const { isLoaded } = useConfig();

  if (!isLoaded) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
            Initializing System
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout activeView={activeView} onViewChange={setActiveView}>
      {activeView === "monitor" ? <LiveMonitor /> : <SettingsPanel />}
    </DashboardLayout>
  );
}

function SafeModeWrapper({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("[SAFE_MODE] Caught error:", event.error);
      setError(event.error);
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  if (error) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="max-w-md text-center p-8">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-amber-500">!</span>
          </div>
          <h1 className="text-lg font-medium text-white mb-2">
            Safe Mode Active
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            Configuration error detected. Running with default hotel
            configuration.
          </p>
          <div className="bg-zinc-950 border border-zinc-800 rounded p-4 text-left">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">
              Error Details
            </div>
            <code className="text-xs text-rose-400 font-mono break-all">
              {error.message}
            </code>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("lumentra_config");
              window.location.reload();
            }}
            className="mt-6 px-4 py-2 bg-zinc-800 text-white text-sm rounded hover:bg-zinc-700 transition-colors"
          >
            Reset and Reload
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function Page() {
  return (
    <SafeModeWrapper>
      <ConfigProvider>
        <DashboardContent />
      </ConfigProvider>
    </SafeModeWrapper>
  );
}
