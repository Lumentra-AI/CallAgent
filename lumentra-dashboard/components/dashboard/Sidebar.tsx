"use client";

import React from "react";
import { useConfig } from "@/context/ConfigContext";
import type { ViewType } from "@/types";
import {
  LayoutDashboard,
  Phone,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// NAV ITEMS
// ============================================================================

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "calls", label: "Calls", icon: Phone },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

export default function Sidebar() {
  const { config, uiState, setView, toggleSidebar, resetConfig } = useConfig();
  const { currentView, sidebarCollapsed } = uiState;

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-200",
        sidebarCollapsed ? "w-16" : "w-56",
      )}
    >
      {/* Logo Area */}
      <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-indigo-500" />
            <span className="font-semibold text-white">Lumentra</span>
          </div>
        )}
        {sidebarCollapsed && (
          <Zap className="mx-auto h-5 w-5 text-indigo-500" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-white",
                sidebarCollapsed && "justify-center px-2",
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Business Info */}
      {!sidebarCollapsed && config && (
        <div className="border-t border-zinc-800 p-4">
          <div className="mb-1 truncate text-sm font-medium text-white">
            {config.businessName}
          </div>
          <div className="truncate text-xs text-zinc-500">
            {config.agentName} Agent
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <div className="border-t border-zinc-800 p-2">
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-white"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* Reset (Dev) */}
      <div className="border-t border-zinc-800 p-2">
        <button
          onClick={resetConfig}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-red-400",
            sidebarCollapsed && "justify-center",
          )}
          title="Reset Configuration"
        >
          <LogOut className="h-4 w-4" />
          {!sidebarCollapsed && <span>Reset</span>}
        </button>
      </div>
    </aside>
  );
}
