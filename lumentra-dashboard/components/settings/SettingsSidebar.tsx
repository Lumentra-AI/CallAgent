"use client";

import React from "react";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useConfig } from "@/context/ConfigContext";
import type { SettingsTab, Permission } from "@/types";
import {
  Settings,
  Mic,
  Clock,
  MessageSquare,
  PhoneForwarded,
  ChevronRight,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  description: string;
  requiredPermission?: Permission;
  category: "business" | "agent";
  path?: string;
}

const ALL_TABS: TabConfig[] = [
  {
    id: "general",
    label: "Business Info",
    icon: Settings,
    description: "Name, address, and contact details",
    requiredPermission: "manage_agent",
    category: "business",
  },
  {
    id: "hours",
    label: "Business Hours",
    icon: Clock,
    description: "When you're open",
    requiredPermission: "manage_hours",
    category: "business",
    path: "/settings/hours",
  },
  {
    id: "voice",
    label: "Voice & Greeting",
    icon: Mic,
    description: "How your AI assistant sounds",
    requiredPermission: "manage_voice",
    category: "business",
  },
  {
    id: "greetings",
    label: "Call Greetings",
    icon: MessageSquare,
    description: "What callers hear first",
    requiredPermission: "manage_greetings",
    category: "business",
  },
  {
    id: "escalation",
    label: "Human Handoff",
    icon: PhoneForwarded,
    description: "When and how calls go to your team",
    requiredPermission: "manage_escalation",
    category: "business",
    path: "/settings/escalation",
  },
  {
    id: "team" as SettingsTab,
    label: "Team Access",
    icon: UsersRound,
    description: "Who can log in and what they see",
    requiredPermission: "manage_staff",
    category: "business",
    path: "/settings/team",
  },
];

const PATH_TO_TAB: Partial<Record<string, SettingsTab>> = {};
ALL_TABS.forEach((tab) => {
  if (tab.path) {
    PATH_TO_TAB[tab.path] = tab.id;
  }
});

export default function SettingsSidebar() {
  const { config, uiState, setSettingsTab, hasPermission } = useConfig();
  const pathname = usePathname();
  const router = useRouter();
  const { settingsTab } = uiState;

  if (!config) return null;

  const visibleTabs = ALL_TABS.filter((tab) => {
    if (!tab.requiredPermission) return true;
    return hasPermission(tab.requiredPermission);
  });
  const activeTab =
    pathname !== "/settings" && pathname
      ? PATH_TO_TAB[pathname] || settingsTab
      : settingsTab;

  const handleTabClick = (tab: TabConfig) => {
    if (tab.path) {
      router.push(tab.path);
      return;
    }

    setSettingsTab(tab.id);
    if (pathname !== "/settings") {
      router.push("/settings");
    }
  };

  const roleLabel =
    config.userRole === "admin" ? "Admin Access" : "Staff Access";
  const roleDescription =
    config.userRole === "admin"
      ? "Business configuration access"
      : "Monitoring access only";

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-6">
        <h2 className="text-xl font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground">Business configuration</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        <ul className="space-y-1">
          {visibleTabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={() => handleTabClick(tab)}
            />
          ))}
        </ul>
      </nav>

      <div className="border-t border-border p-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="text-sm font-medium text-primary">
              {roleLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {roleDescription}
          </p>
        </div>
      </div>
    </aside>
  );
}

interface TabButtonProps {
  tab: TabConfig;
  isActive: boolean;
  onClick: () => void;
}

function TabButton({ tab, isActive, onClick }: TabButtonProps) {
  const Icon = tab.icon;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            isActive ? "bg-primary/10" : "bg-muted group-hover:bg-background",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {tab.label}
          </div>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="truncate text-[10px] opacity-70"
            >
              {tab.description}
            </motion.div>
          )}
        </div>
        {isActive && !tab.path && (
          <ChevronRight className="h-4 w-4 opacity-50" />
        )}
      </button>
    </li>
  );
}
