"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConfig } from "@/context/ConfigContext";
import type { SettingsTab, Permission } from "@/types";
import {
  Settings,
  Mic,
  DollarSign,
  Clock,
  Plug,
  User,
  MessageSquare,
  MessageCircle,
  PhoneForwarded,
  CreditCard,
  Sliders,
  ChevronRight,
  Sparkles,
  Zap,
  Megaphone,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TABS CONFIGURATION
// ============================================================================

type AccessTier = "staff" | "admin" | "developer";

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  description: string;
  requiredPermission?: Permission;
  minAccessTier: AccessTier;
  category: "business" | "agent" | "platform";
  path?: string; // Standalone page path (navigates to URL)
}

const ALL_TABS: TabConfig[] = [
  // Business Settings
  {
    id: "general",
    label: "General",
    icon: Settings,
    description: "Business identity and branding",
    minAccessTier: "admin",
    requiredPermission: "manage_agent",
    category: "business",
  },
  {
    id: "hours",
    label: "Hours",
    icon: Clock,
    description: "Operating schedule",
    minAccessTier: "admin",
    requiredPermission: "manage_hours",
    category: "business",
    path: "/settings/hours",
  },
  {
    id: "chatbot",
    label: "Chat Widget",
    icon: MessageSquare,
    description: "Website chat configuration",
    minAccessTier: "admin",
    requiredPermission: "manage_agent",
    category: "business",
    path: "/settings/chatbot",
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    description: "Payment and subscription",
    minAccessTier: "admin",
    requiredPermission: "manage_billing",
    category: "business",
  },

  // Agent Configuration
  {
    id: "agent",
    label: "Agent",
    icon: User,
    description: "Personality and behavior",
    minAccessTier: "admin",
    requiredPermission: "manage_agent",
    category: "agent",
  },
  {
    id: "voice",
    label: "Voice",
    icon: Mic,
    description: "Voice and speech settings",
    minAccessTier: "admin",
    requiredPermission: "manage_voice",
    category: "agent",
  },
  {
    id: "capabilities",
    label: "Capabilities",
    icon: Zap,
    description: "What your assistant handles",
    minAccessTier: "admin",
    requiredPermission: "manage_agent",
    category: "agent",
    path: "/settings/capabilities",
  },
  {
    id: "greetings",
    label: "Greetings",
    icon: MessageSquare,
    description: "Customize caller greetings",
    minAccessTier: "admin",
    requiredPermission: "manage_greetings",
    category: "agent",
  },
  {
    id: "responses",
    label: "Responses",
    icon: MessageCircle,
    description: "Custom AI responses",
    minAccessTier: "admin",
    requiredPermission: "manage_responses",
    category: "agent",
  },
  {
    id: "escalation",
    label: "Escalation",
    icon: PhoneForwarded,
    description: "Call transfer rules",
    minAccessTier: "admin",
    requiredPermission: "manage_escalation",
    category: "agent",
    path: "/settings/escalation",
  },
  {
    id: "promotions",
    label: "Promotions",
    icon: Megaphone,
    description: "Special offers for callers",
    minAccessTier: "admin",
    requiredPermission: "manage_agent",
    category: "agent",
    path: "/settings/promotions",
  },
  {
    id: "instructions",
    label: "Instructions",
    icon: Sparkles,
    description: "Custom AI instructions",
    minAccessTier: "admin",
    requiredPermission: "manage_agent",
    category: "agent",
  },

  // Platform Settings (Developer only)
  {
    id: "pricing",
    label: "Pricing",
    icon: DollarSign,
    description: "Rates, fees, and modifiers",
    minAccessTier: "developer",
    requiredPermission: "manage_pricing",
    category: "platform",
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Plug,
    description: "Connected services and APIs",
    minAccessTier: "admin",
    requiredPermission: "manage_integrations",
    category: "platform",
    path: "/settings/integrations",
  },
  {
    id: "advanced",
    label: "Advanced",
    icon: Sliders,
    description: "System configuration",
    minAccessTier: "developer",
    requiredPermission: "manage_infrastructure",
    category: "platform",
  },
];

const ACCESS_TIER_LEVEL: Record<AccessTier, number> = {
  staff: 0,
  admin: 1,
  developer: 2,
};

function hasMinAccessTier(userRole: string, requiredTier: AccessTier): boolean {
  const userLevel = ACCESS_TIER_LEVEL[userRole as AccessTier] ?? 0;
  const requiredLevel = ACCESS_TIER_LEVEL[requiredTier];
  return userLevel >= requiredLevel;
}

// Map standalone page paths to tab IDs
const PATH_TO_TAB: Record<string, SettingsTab> = {};
ALL_TABS.forEach((tab) => {
  if (tab.path) {
    PATH_TO_TAB[tab.path] = tab.id;
  }
});

// ============================================================================
// SETTINGS SIDEBAR COMPONENT
// ============================================================================

export default function SettingsSidebar() {
  const { config, uiState, setSettingsTab, hasPermission } = useConfig();
  const pathname = usePathname();
  const router = useRouter();
  const { settingsTab } = uiState;

  if (!config) return null;

  const userRole = config.userRole;
  const isDeveloper = userRole === "developer";

  // Filter tabs based on user role and permissions
  const visibleTabs = ALL_TABS.filter((tab) => {
    if (!hasMinAccessTier(userRole, tab.minAccessTier)) return false;
    if (tab.requiredPermission) return hasPermission(tab.requiredPermission);
    return true;
  });

  // Group tabs by category
  const businessTabs = visibleTabs.filter((t) => t.category === "business");
  const agentTabs = visibleTabs.filter((t) => t.category === "agent");
  const platformTabs = visibleTabs.filter((t) => t.category === "platform");

  // Determine active tab: URL-based for standalone pages, state-based for inline
  const isOnSubPage = pathname !== "/settings";
  const activeTabFromPath = PATH_TO_TAB[pathname];
  const activeTab =
    isOnSubPage && activeTabFromPath ? activeTabFromPath : settingsTab;

  const handleTabClick = (tab: TabConfig) => {
    if (tab.path) {
      // Standalone page: navigate
      router.push(tab.path);
    } else {
      // Inline tab: update state and go to /settings
      setSettingsTab(tab.id);
      if (isOnSubPage) {
        router.push("/settings");
      }
    }
  };

  // Role display configuration
  const roleConfig = {
    developer: {
      label: "Developer Mode",
      color: "amber",
      description: "Full platform access",
    },
    admin: {
      label: "Admin Mode",
      color: "primary",
      description: "Business configuration access",
    },
    staff: {
      label: "Staff Mode",
      color: "muted",
      description: "Monitoring access only",
    },
  };

  const currentRoleConfig =
    roleConfig[userRole as keyof typeof roleConfig] || roleConfig.staff;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="border-b border-border p-6">
        <h2 className="text-xl font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground">
          {isDeveloper ? "Platform configuration" : "Business configuration"}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {/* Business Settings */}
        {businessTabs.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Business
            </h3>
            <ul className="space-y-1">
              {businessTabs.map((tab) => (
                <TabButton
                  key={tab.id}
                  tab={tab}
                  isActive={activeTab === tab.id}
                  onClick={() => handleTabClick(tab)}
                />
              ))}
            </ul>
          </div>
        )}

        {/* Agent Configuration */}
        {agentTabs.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Agent Configuration
            </h3>
            <ul className="space-y-1">
              {agentTabs.map((tab) => (
                <TabButton
                  key={tab.id}
                  tab={tab}
                  isActive={activeTab === tab.id}
                  onClick={() => handleTabClick(tab)}
                />
              ))}
            </ul>
          </div>
        )}

        {/* Platform Settings */}
        {platformTabs.length > 0 && isDeveloper && (
          <div>
            <h3 className="mb-2 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-amber-500">
              Platform
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium">
                DEV
              </span>
            </h3>
            <ul className="space-y-1">
              {platformTabs.map((tab) => (
                <TabButton
                  key={tab.id}
                  tab={tab}
                  isActive={activeTab === tab.id}
                  onClick={() => handleTabClick(tab)}
                  isDeveloperTab
                />
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* Role Indicator */}
      <div className="border-t border-border p-4">
        <div
          className={cn(
            "rounded-xl border p-4",
            currentRoleConfig.color === "amber"
              ? "border-amber-500/20 bg-amber-500/5"
              : currentRoleConfig.color === "primary"
                ? "border-primary/20 bg-primary/5"
                : "border-border bg-muted/50",
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                currentRoleConfig.color === "amber"
                  ? "bg-amber-500"
                  : currentRoleConfig.color === "primary"
                    ? "bg-primary"
                    : "bg-muted-foreground",
              )}
            />
            <span
              className={cn(
                "text-sm font-medium",
                currentRoleConfig.color === "amber"
                  ? "text-amber-500"
                  : currentRoleConfig.color === "primary"
                    ? "text-primary"
                    : "text-muted-foreground",
              )}
            >
              {currentRoleConfig.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {currentRoleConfig.description}
          </p>
        </div>
      </div>
    </aside>
  );
}

// ============================================================================
// TAB BUTTON COMPONENT
// ============================================================================

interface TabButtonProps {
  tab: TabConfig;
  isActive: boolean;
  onClick: () => void;
  isDeveloperTab?: boolean;
}

function TabButton({ tab, isActive, onClick, isDeveloperTab }: TabButtonProps) {
  const Icon = tab.icon;
  const hasPath = !!tab.path;

  const buttonClasses = cn(
    "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
    isActive
      ? isDeveloperTab
        ? "bg-amber-500/10 text-amber-500"
        : "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

  return (
    <li>
      <button type="button" onClick={onClick} className={buttonClasses}>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            isActive
              ? isDeveloperTab
                ? "bg-amber-500/10"
                : "bg-primary/10"
              : "bg-muted group-hover:bg-background",
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
        {isActive && !hasPath && (
          <ChevronRight className="h-4 w-4 opacity-50" />
        )}
      </button>
    </li>
  );
}
