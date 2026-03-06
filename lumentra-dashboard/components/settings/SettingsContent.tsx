"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConfig } from "@/context/ConfigContext";
import GeneralTab from "./GeneralTab";
import VoiceTab from "./VoiceTab";
import PricingTab from "./PricingTab";
import HoursTab from "./HoursTab";
import BillingTab from "./BillingTab";
import GreetingsTab from "./GreetingsTab";
import ResponsesTab from "./ResponsesTab";
import AgentTab from "./AgentTab";
import EscalationTab from "./EscalationTab";
import InstructionsTab from "./InstructionsTab";

export default function SettingsContent() {
  const { config, uiState } = useConfig();
  const { settingsTab } = uiState;

  if (!config) return null;

  const isDeveloper = config.userRole === "developer";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={settingsTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {settingsTab === "general" && <GeneralTab />}
        {settingsTab === "agent" && <AgentTab />}
        {settingsTab === "voice" && <VoiceTab />}
        {settingsTab === "greetings" && <GreetingsTab />}
        {settingsTab === "responses" && <ResponsesTab />}
        {settingsTab === "instructions" && <InstructionsTab />}
        {settingsTab === "hours" && <HoursTab />}
        {settingsTab === "escalation" && <EscalationTab />}
        {settingsTab === "billing" && <BillingTab />}
        {settingsTab === "pricing" && isDeveloper && <PricingTab />}
        {settingsTab === "advanced" && isDeveloper && <AdvancedTab />}
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// ADVANCED TAB (Developer Only)
// ============================================================================

function AdvancedTab() {
  const { config } = useConfig();

  if (!config) return null;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Advanced Settings
        </h3>
        <p className="text-sm text-muted-foreground">
          System-level configuration and feature flags
        </p>
      </div>

      {/* Feature Flags */}
      <section className="space-y-4">
        <div className="border-b border-border pb-3">
          <h4 className="text-sm font-medium text-foreground">Feature Flags</h4>
          <p className="text-xs text-muted-foreground">
            Enable or disable system features
          </p>
        </div>

        <div className="space-y-3">
          {Object.entries(config.features).map(([key, enabled]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
            >
              <div>
                <div className="text-sm font-medium text-foreground">
                  {key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (s) => s.toUpperCase())}
                </div>
                <div className="text-xs text-muted-foreground">
                  {enabled ? "Enabled" : "Disabled"}
                </div>
              </div>
              <div
                className={`h-3 w-3 rounded-full ${
                  enabled ? "bg-green-500" : "bg-muted-foreground/30"
                }`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* System Info */}
      <section className="space-y-4">
        <div className="border-b border-border pb-3">
          <h4 className="text-sm font-medium text-foreground">
            System Information
          </h4>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Industry
              </div>
              <div className="mt-1 font-mono text-sm text-foreground">
                {config.industry}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                User Role
              </div>
              <div className="mt-1 font-mono text-sm text-foreground">
                {config.userRole}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Configured
              </div>
              <div className="mt-1 font-mono text-sm text-foreground">
                {config.isConfigured ? "Yes" : "No"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Last Modified
              </div>
              <div className="mt-1 font-mono text-sm text-foreground">
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
        <div className="border-b border-destructive/30 pb-3">
          <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">
                Reset Configuration
              </div>
              <div className="text-xs text-muted-foreground">
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
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              Reset
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
