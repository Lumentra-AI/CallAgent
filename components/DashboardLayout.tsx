"use client";

import React, { ReactNode } from "react";
import { Monitor, Settings, Activity } from "lucide-react";
import { useConfig } from "@/context/ConfigContext";

interface DashboardLayoutProps {
  children: ReactNode;
  activeView: "monitor" | "settings";
  onViewChange: (view: "monitor" | "settings") => void;
}

export default function DashboardLayout({
  children,
  activeView,
  onViewChange,
}: DashboardLayoutProps) {
  const { systemStatus, config } = useConfig();

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden">
      {/* Grid Container */}
      <div className="grid grid-cols-[64px_1fr] h-full">
        {/* Sidebar - Fixed 64px */}
        <aside className="h-full bg-zinc-950 border-r border-zinc-800 flex flex-col">
          {/* Logo Area */}
          <div className="h-12 flex items-center justify-center border-b border-zinc-800">
            <Activity className="w-5 h-5 text-emerald-500" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 flex flex-col items-center gap-2">
            <button
              onClick={() => onViewChange("monitor")}
              className={`w-10 h-10 rounded flex items-center justify-center transition-colors ${
                activeView === "monitor"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
              }`}
              aria-label="Live Monitor"
            >
              <Monitor className="w-5 h-5" />
            </button>
            <button
              onClick={() => onViewChange("settings")}
              className={`w-10 h-10 rounded flex items-center justify-center transition-colors ${
                activeView === "settings"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
              }`}
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </nav>

          {/* Status Indicator */}
          <div className="h-12 flex items-center justify-center border-t border-zinc-800">
            <div
              className={`w-2 h-2 rounded-full ${
                systemStatus.online ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex flex-col h-full overflow-hidden">
          {/* Top Status Bar - Dense */}
          <header className="h-8 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
            {/* Left: System Status */}
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono text-zinc-500">
                SYSTEM:{" "}
                <span
                  className={
                    systemStatus.online ? "text-emerald-500" : "text-rose-500"
                  }
                >
                  {systemStatus.online ? "ONLINE" : "OFFLINE"}
                </span>
              </span>
              <span className="text-xs font-mono text-zinc-600">|</span>
              <span className="text-xs font-mono text-zinc-500">
                LATENCY:{" "}
                <span className="text-zinc-300">{systemStatus.latency}ms</span>
              </span>
              <span className="text-xs font-mono text-zinc-600">|</span>
              <span className="text-xs font-mono text-zinc-500">
                ACTIVE:{" "}
                <span className="text-zinc-300">
                  {systemStatus.activeCalls}
                </span>
              </span>
            </div>

            {/* Center: Business Name */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                {config.businessName}
              </span>
            </div>

            {/* Right: Version */}
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono text-zinc-600">
                {config.industry.toUpperCase()}
              </span>
              <span className="text-xs font-mono text-zinc-500">
                {systemStatus.version}
              </span>
            </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
    </div>
  );
}
