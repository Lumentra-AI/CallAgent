"use client";

import React from "react";
import { useConfig } from "@/context/ConfigContext";
import { Circle, Wifi, WifiOff, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TOP BAR COMPONENT - Dense Status Strip
// ============================================================================

export default function TopBar() {
  const { config, metrics } = useConfig();
  const [currentTime, setCurrentTime] = React.useState(new Date());

  // Update time every second
  React.useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const systemStatus = metrics?.system.status || "offline";
  const latency = metrics?.system.latency || 0;
  const activeCalls = metrics?.system.activeCalls || 0;

  return (
    <header className="flex h-10 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
      {/* Left: System Status */}
      <div className="flex items-center gap-4">
        {/* Online Status */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Circle
              className={cn(
                "h-2 w-2 fill-current",
                systemStatus === "online"
                  ? "text-green-500"
                  : systemStatus === "degraded"
                    ? "text-amber-500"
                    : "text-red-500",
              )}
            />
            {systemStatus === "online" && (
              <Circle className="absolute inset-0 h-2 w-2 animate-ping fill-current text-green-500 opacity-75" />
            )}
          </div>
          <span className="font-mono text-[10px] uppercase text-zinc-500">
            SYS:{" "}
            <span
              className={cn(
                systemStatus === "online"
                  ? "text-green-500"
                  : systemStatus === "degraded"
                    ? "text-amber-500"
                    : "text-red-500",
              )}
            >
              {systemStatus.toUpperCase()}
            </span>
          </span>
        </div>

        <span className="text-zinc-700">|</span>

        {/* Latency */}
        <span className="font-mono text-[10px] text-zinc-500">
          RTT:{" "}
          <span
            className={cn(
              latency < 50
                ? "text-green-500"
                : latency < 100
                  ? "text-amber-500"
                  : "text-red-500",
            )}
          >
            {latency}ms
          </span>
        </span>

        <span className="text-zinc-700">|</span>

        {/* Active Calls */}
        <span className="font-mono text-[10px] text-zinc-500">
          ACTIVE:{" "}
          <span
            className={activeCalls > 0 ? "text-indigo-400" : "text-zinc-400"}
          >
            {activeCalls}
          </span>
        </span>
      </div>

      {/* Center: Business Name */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {config?.businessName || "Lumentra Core"}
        </span>
      </div>

      {/* Right: Time & Version */}
      <div className="flex items-center gap-4">
        {/* Industry Tag */}
        <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-500">
          {config?.industry || "---"}
        </span>

        <span className="text-zinc-700">|</span>

        {/* Time */}
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-zinc-600" />
          <span className="font-mono text-[10px] tabular-nums text-zinc-400">
            {currentTime.toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>

        <span className="text-zinc-700">|</span>

        {/* Version */}
        <span className="font-mono text-[10px] text-zinc-600">v0.1.0</span>
      </div>
    </header>
  );
}
