"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useConfig } from "@/context/ConfigContext";
import { useAuth } from "@/context/AuthContext";
import { Clock, User, Settings, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

export default function TopBar() {
  const router = useRouter();
  const { config } = useConfig();
  const { user, signOut } = useAuth();
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const userName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Update time every minute (no need for seconds)
  React.useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Close menu on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4">
      {/* Left: Business Name */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {config?.businessName || "Lumentra"}
        </span>
      </div>

      {/* Right: Time, Theme, User */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Theme Toggle */}
        <AnimatedThemeToggler size={20} />

        {/* Time */}
        <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-xs font-mono tabular-nums">
            {currentTime.toLocaleTimeString("en-US", {
              hour12: true,
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
            aria-expanded={showUserMenu}
            aria-haspopup="true"
          >
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground">
              {userInitials}
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-primary transition-transform",
                showUserMenu && "rotate-180",
              )}
            />
          </button>

          {/* Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <div className="border-b border-border p-3">
                <div className="font-medium text-sm text-foreground">
                  {userName}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </div>
              </div>
              <div className="p-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    router.push("/profile");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    router.push("/settings");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
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
          )}
        </div>
      </div>
    </header>
  );
}
