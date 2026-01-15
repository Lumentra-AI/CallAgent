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
  Users,
  Calendar,
  Bell,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// NAV ITEMS
// ============================================================================

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ElementType;
  section?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Agent",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "calls", label: "Calls", icon: Phone },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    title: "CRM",
    items: [
      { id: "contacts", label: "Contacts", icon: Users },
      { id: "calendar", label: "Calendar", icon: Calendar },
      { id: "notifications", label: "Notifications", icon: Bell },
      { id: "resources", label: "Resources", icon: Package },
    ],
  },
  {
    title: "System",
    items: [{ id: "settings", label: "Settings", icon: Settings }],
  },
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
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
        sidebarCollapsed ? "w-16" : "w-56",
      )}
    >
      {/* Logo Area */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sidebar-foreground">
              Lumentra
            </span>
          </div>
        )}
        {sidebarCollapsed && <Zap className="mx-auto h-5 w-5 text-primary" />}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={section.title} className={cn(sectionIndex > 0 && "mt-4")}>
            {!sidebarCollapsed && (
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </div>
            )}
            {sidebarCollapsed && sectionIndex > 0 && (
              <div className="mx-2 mb-2 border-t border-sidebar-border" />
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = currentView === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      sidebarCollapsed && "justify-center px-2",
                    )}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Business Info */}
      {!sidebarCollapsed && config && (
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-1 truncate text-sm font-medium text-sidebar-foreground">
            {config.businessName}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {config.agentName} Agent
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={resetConfig}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-destructive",
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
