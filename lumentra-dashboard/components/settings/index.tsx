"use client";

import React from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import GeneralTab from "./GeneralTab";
import VoiceTab from "./VoiceTab";
import PricingTab from "./PricingTab";
import HoursTab from "./HoursTab";
import IntegrationsTab from "./IntegrationsTab";
import BillingTab from "./BillingTab";
import GreetingsTab from "./GreetingsTab";
import ResponsesTab from "./ResponsesTab";
import AgentTab from "./AgentTab";
import EscalationTab from "./EscalationTab";

// ============================================================================
// TABS CONFIGURATION
// ============================================================================
// Access tiers:
// - developer: Platform-level controls (infrastructure, all customers)
// - admin: Business owner controls (agent config, billing)
// - staff: Monitoring only (no settings access in most tabs)

type AccessTier = "staff" | "admin" | "developer";

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  description: string;
  requiredPermission?: Permission;
  minAccessTier: AccessTier;
}

const ALL_TABS: TabConfig[] = [
  // Admin accessible tabs (business owner controls)
  {
    id: "general",
    label: "General",
    icon: Settings,
    description: "Business identity settings",
    minAccessTier: "admin",
    requiredPermission: "manage_agent",
  },
  {
    id: "agent",
    label: "Agent",
    icon: User,
    description: "Agent personality and behavior",
    minAccessTier: "admin",
    requiredPermission: "manage_agent",
  },
  {
    id: "voice",
    label: "Voice",
    icon: Mic,
    description: "Voice and speech settings",
    minAccessTier: "admin",
    requiredPermission: "manage_voice",
  },
  {
    id: "greetings",
    label: "Greetings",
    icon: MessageSquare,
    description: "Customize caller greetings",
    minAccessTier: "admin",
    requiredPermission: "manage_greetings",
  },
  {
    id: "responses",
    label: "Responses",
    icon: MessageCircle,
    description: "Custom AI responses",
    minAccessTier: "admin",
    requiredPermission: "manage_responses",
  },
  {
    id: "hours",
    label: "Hours",
    icon: Clock,
    description: "Operating schedule",
    minAccessTier: "admin",
    requiredPermission: "manage_hours",
  },
  {
    id: "escalation",
    label: "Escalation",
    icon: PhoneForwarded,
    description: "Call transfer rules",
    minAccessTier: "admin",
    requiredPermission: "manage_escalation",
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    description: "Payment and subscription",
    minAccessTier: "admin",
    requiredPermission: "manage_billing",
  },

  // Developer only tabs (platform infrastructure)
  {
    id: "pricing",
    label: "Pricing",
    icon: DollarSign,
    description: "Rates, fees, and modifiers",
    minAccessTier: "developer",
    requiredPermission: "manage_pricing",
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Plug,
    description: "Connected services and APIs",
    minAccessTier: "developer",
    requiredPermission: "manage_integrations",
  },
  {
    id: "advanced",
    label: "Advanced",
    icon: Sliders,
    description: "System configuration",
    minAccessTier: "developer",
    requiredPermission: "manage_infrastructure",
  },
];

// Access tier hierarchy for comparison
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

// ============================================================================
// SETTINGS PANEL COMPONENT
// ============================================================================

export default function SettingsPanel() {
  const { config, uiState, setSettingsTab, hasPermission } = useConfig();
  const { settingsTab } = uiState;

  if (!config) return null;

  const userRole = config.userRole;
  const isDeveloper = userRole === "developer";
  const isAdmin = userRole === "admin" || isDeveloper;
  const isStaff = userRole === "staff";

  // Filter tabs based on user role and permissions
  const visibleTabs = ALL_TABS.filter((tab) => {
    // Check access tier first
    if (!hasMinAccessTier(userRole, tab.minAccessTier)) {
      return false;
    }

    // Then check specific permission if required
    if (tab.requiredPermission) {
      return hasPermission(tab.requiredPermission);
    }

    return true;
  });

  // Staff gets no settings tabs - redirect to dashboard
  if (isStaff || visibleTabs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Settings className="mx-auto h-12 w-12 text-zinc-700" />
          <h3 className="mt-4 text-lg font-medium text-white">
            Settings Access Restricted
          </h3>
          <p className="mt-2 text-sm text-zinc-500">
            Contact your administrator to modify agent settings.
          </p>
        </div>
      </div>
    );
  }

  // Ensure current tab is valid for user
  const currentTabValid = visibleTabs.some((tab) => tab.id === settingsTab);
  if (!currentTabValid && visibleTabs.length > 0) {
    setSettingsTab(visibleTabs[0].id);
  }

  // Role display configuration
  const roleConfig = {
    developer: {
      label: "Developer Mode",
      color: "amber",
      description: "Full platform access",
    },
    admin: {
      label: "Admin Mode",
      color: "indigo",
      description: "Business configuration access",
    },
    staff: {
      label: "Staff Mode",
      color: "zinc",
      description: "Monitoring access only",
    },
  };

  const currentRoleConfig =
    roleConfig[userRole as keyof typeof roleConfig] || roleConfig.staff;

  return (
    <div className="flex h-full">
      {/* Sidebar Tabs */}
      <div className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-950">
        <div className="p-4">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <p className="text-xs text-zinc-500">
            {isDeveloper
              ? "Platform configuration"
              : isAdmin
                ? "Business configuration"
                : "View settings"}
          </p>
        </div>

        <nav className="space-y-1 px-2">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = settingsTab === tab.id;
            const isDeveloperTab = tab.minAccessTier === "developer";

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSettingsTab(tab.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                  isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{tab.label}</div>
                  {isActive && (
                    <div className="truncate text-[10px] text-zinc-500">
                      {tab.description}
                    </div>
                  )}
                </div>
                {isDeveloperTab && isDeveloper && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                    DEV
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Role indicator */}
        <div
          className={cn(
            "mx-4 mt-6 rounded-lg border p-3",
            currentRoleConfig.color === "amber"
              ? "border-amber-500/20 bg-amber-500/5"
              : currentRoleConfig.color === "indigo"
                ? "border-indigo-500/20 bg-indigo-500/5"
                : "border-zinc-700 bg-zinc-800/50",
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                currentRoleConfig.color === "amber"
                  ? "bg-amber-500"
                  : currentRoleConfig.color === "indigo"
                    ? "bg-indigo-500"
                    : "bg-zinc-500",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium",
                currentRoleConfig.color === "amber"
                  ? "text-amber-400"
                  : currentRoleConfig.color === "indigo"
                    ? "text-indigo-400"
                    : "text-zinc-400",
              )}
            >
              {currentRoleConfig.label}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">
            {currentRoleConfig.description}
          </p>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-zinc-900/50 p-6 scrollbar-thin">
        {settingsTab === "general" && <GeneralTab />}
        {settingsTab === "agent" && <AgentTab />}
        {settingsTab === "voice" && <VoiceTab />}
        {settingsTab === "greetings" && <GreetingsTab />}
        {settingsTab === "responses" && <ResponsesTab />}
        {settingsTab === "hours" && <HoursTab />}
        {settingsTab === "escalation" && <EscalationTab />}
        {settingsTab === "billing" && <BillingTab />}
        {settingsTab === "pricing" && isDeveloper && <PricingTab />}
        {settingsTab === "integrations" && isDeveloper && <IntegrationsTab />}
        {settingsTab === "advanced" && isDeveloper && <AdvancedTab />}
      </div>
    </div>
  );
}

// ============================================================================
// ADVANCED TAB (Developer Only - Platform Infrastructure)
// ============================================================================

function AdvancedTab() {
  const { config } = useConfig();

  if (!config) return null;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-white">Advanced Settings</h3>
        <p className="text-sm text-zinc-500">
          System-level configuration and feature flags
        </p>
      </div>

      {/* Feature Flags */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">Feature Flags</h4>
          <p className="text-xs text-zinc-600">
            Enable or disable system features
          </p>
        </div>

        <div className="space-y-3">
          {Object.entries(config.features).map(([key, enabled]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-4"
            >
              <div>
                <div className="text-sm font-medium text-white">
                  {key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (s) => s.toUpperCase())}
                </div>
                <div className="text-xs text-zinc-500">
                  {enabled ? "Enabled" : "Disabled"}
                </div>
              </div>
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  enabled ? "bg-green-500" : "bg-zinc-600",
                )}
              />
            </div>
          ))}
        </div>
      </section>

      {/* System Info */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">System Information</h4>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Industry
              </div>
              <div className="mt-1 font-mono text-sm text-white">
                {config.industry}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                User Role
              </div>
              <div className="mt-1 font-mono text-sm text-white">
                {config.userRole}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Configured
              </div>
              <div className="mt-1 font-mono text-sm text-white">
                {config.isConfigured ? "Yes" : "No"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Last Modified
              </div>
              <div className="mt-1 font-mono text-sm text-white">
                {config.lastModified
                  ? new Date(config.lastModified).toLocaleString()
                  : "Never"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="space-y-4">
        <div className="border-b border-red-500/30 pb-2">
          <h4 className="text-sm font-medium text-red-400">Danger Zone</h4>
        </div>

        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">
                Reset Configuration
              </div>
              <div className="text-xs text-zinc-500">
                This will clear all settings and return to setup wizard
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm("Are you sure? This cannot be undone.")) {
                  localStorage.removeItem("lumentra_config_v2");
                  window.location.reload();
                }
              }}
              className="rounded-md border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
            >
              Reset
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  GeneralTab,
  VoiceTab,
  PricingTab,
  HoursTab,
  IntegrationsTab,
  BillingTab,
  GreetingsTab,
  ResponsesTab,
  AgentTab,
  EscalationTab,
};
