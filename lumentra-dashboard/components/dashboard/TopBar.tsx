"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useConfig } from "@/context/ConfigContext";
import { useAuth } from "@/context/AuthContext";
import { Circle, Clock, User, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

// ============================================================================
// TOP BAR COMPONENT - Dense Status Strip
// ============================================================================

export default function TopBar() {
  const router = useRouter();
  const { config, metrics } = useConfig();
  const { user, signOut } = useAuth();
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  const userName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Update time every second
  React.useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const systemStatus = metrics?.system.status || "offline";
  const latency = metrics?.system.latency || 0;
  const activeCalls = metrics?.system.activeCalls || 0;

  return (
    <header className="flex h-10 items-center justify-between border-b border-border bg-background px-4">
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
          <span className="font-mono text-[10px] uppercase text-muted-foreground">
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

        <span className="text-border">|</span>

        {/* Latency */}
        <span className="font-mono text-[10px] text-muted-foreground">
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

        <span className="text-border">|</span>

        {/* Active Calls */}
        <span className="font-mono text-[10px] text-muted-foreground">
          ACTIVE:{" "}
          <span
            className={
              activeCalls > 0 ? "text-primary" : "text-muted-foreground"
            }
          >
            {activeCalls}
          </span>
        </span>
      </div>

      {/* Center: Business Name */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {config?.businessName || "Lumentra Core"}
        </span>
      </div>

      {/* Right: Time & Version */}
      <div className="flex items-center gap-4">
        {/* Industry Tag */}
        <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
          {config?.industry || "---"}
        </span>

        <span className="text-border">|</span>

        {/* Theme Toggle */}
        <AnimatedThemeToggler size={18} />

        <span className="text-border">|</span>

        {/* Time */}
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {currentTime.toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>

        <span className="text-border">|</span>

        {/* Version */}
        <span className="font-mono text-[10px] text-muted-foreground">
          v0.1.0
        </span>

        <span className="text-border">|</span>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            {userInitials}
          </button>

          {/* Dropdown */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                <div className="border-b border-border p-3">
                  <div className="text-sm font-medium text-foreground">
                    {userName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {user?.email}
                  </div>
                </div>
                <div className="p-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      router.push("/profile");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      router.push("/settings");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                </div>
                <div className="border-t border-border p-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      signOut();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
