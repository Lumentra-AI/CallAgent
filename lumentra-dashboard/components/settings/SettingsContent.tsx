"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConfig } from "@/context/ConfigContext";
import GeneralTab from "./GeneralTab";
import VoiceTab from "./VoiceTab";
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
        {![
          "general",
          "agent",
          "voice",
          "greetings",
          "responses",
          "instructions",
          "hours",
          "escalation",
          "billing",
        ].includes(settingsTab) && <GeneralTab />}
      </motion.div>
    </AnimatePresence>
  );
}
