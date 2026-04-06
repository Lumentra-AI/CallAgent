"use client";

import React, { useEffect } from "react";

import { useConfig } from "@/context/ConfigContext";
import HoursTab from "./HoursTab";
import EscalationTab from "./EscalationTab";
import type { SettingsTab } from "@/types";

// Only these tabs are accessible to tenants
const VALID_TABS: Set<string> = new Set(["hours", "escalation", "team"]);

export default function SettingsContent() {
  const { config, uiState, setSettingsTab } = useConfig();
  const { settingsTab } = uiState;

  // Clamp stale settingsTab from localStorage to a valid value
  useEffect(() => {
    if (!VALID_TABS.has(settingsTab)) {
      setSettingsTab("hours" as SettingsTab);
    }
  }, [settingsTab, setSettingsTab]);

  if (!config) return null;

  const activeTab = VALID_TABS.has(settingsTab) ? settingsTab : "hours";

  return (
    <div key={activeTab}>
      {activeTab === "hours" && <HoursTab />}
      {activeTab === "escalation" && <EscalationTab />}
    </div>
  );
}
