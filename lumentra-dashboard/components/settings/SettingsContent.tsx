"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConfig } from "@/context/ConfigContext";
import GeneralTab from "./GeneralTab";
import VoiceTab from "./VoiceTab";
import HoursTab from "./HoursTab";
import GreetingsTab from "./GreetingsTab";
import EscalationTab from "./EscalationTab";
import type { SettingsTab } from "@/types";

// Only these tabs are accessible in the simplified product
const VALID_TABS: Set<string> = new Set([
  "general",
  "hours",
  "voice",
  "greetings",
  "escalation",
  "team",
]);

export default function SettingsContent() {
  const { config, uiState, setSettingsTab } = useConfig();
  const { settingsTab } = uiState;

  // Clamp stale settingsTab from localStorage to a valid value
  useEffect(() => {
    if (!VALID_TABS.has(settingsTab)) {
      setSettingsTab("general" as SettingsTab);
    }
  }, [settingsTab, setSettingsTab]);

  if (!config) return null;

  // Don't render stale tab content
  const activeTab = VALID_TABS.has(settingsTab) ? settingsTab : "general";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === "general" && <GeneralTab />}
        {activeTab === "voice" && <VoiceTab />}
        {activeTab === "greetings" && <GreetingsTab />}
        {activeTab === "hours" && <HoursTab />}
        {activeTab === "escalation" && <EscalationTab />}
      </motion.div>
    </AnimatePresence>
  );
}
