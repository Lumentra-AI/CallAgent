"use client";

import React, { useState } from "react";
import { Building2, Mic, DollarSign, RotateCcw } from "lucide-react";
import { useConfig, DEFAULT_CONFIGS } from "@/context/ConfigContext";
import type { Industry } from "@/types";

type TabId = "general" | "voice" | "pricing";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const TABS: Tab[] = [
  { id: "general", label: "General", icon: Building2 },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "pricing", label: "Pricing", icon: DollarSign },
];

const INDUSTRIES: { value: Industry; label: string }[] = [
  { value: "hotel", label: "Hotel / Hospitality" },
  { value: "medical", label: "Medical / Healthcare" },
  { value: "service", label: "Service Business" },
];

const ACCENT_COLORS = [
  { value: "emerald", label: "Emerald", class: "bg-emerald-500" },
  { value: "cyan", label: "Cyan", class: "bg-cyan-500" },
  { value: "violet", label: "Violet", class: "bg-violet-500" },
] as const;

export default function SettingsPanel() {
  const {
    config,
    updateConfig,
    updateNestedConfig,
    resetConfig,
    switchIndustry,
  } = useConfig();
  const [activeTab, setActiveTab] = useState<TabId>("general");

  return (
    <div className="h-full bg-zinc-950 flex">
      {/* Tabs Sidebar */}
      <div className="w-48 border-r border-zinc-800 p-4">
        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-4">
          Configuration
        </div>
        <nav className="space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="mt-8 pt-4 border-t border-zinc-800">
          <button
            onClick={resetConfig}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-zinc-500 hover:text-rose-500 hover:bg-zinc-900 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === "general" && (
          <GeneralSettings
            config={config}
            updateConfig={updateConfig}
            switchIndustry={switchIndustry}
          />
        )}
        {activeTab === "voice" && (
          <VoiceSettings
            config={config}
            updateNestedConfig={updateNestedConfig}
          />
        )}
        {activeTab === "pricing" && (
          <PricingSettings
            config={config}
            updateNestedConfig={updateNestedConfig}
          />
        )}
      </div>
    </div>
  );
}

function GeneralSettings({
  config,
  updateConfig,
  switchIndustry,
}: {
  config: ReturnType<typeof useConfig>["config"];
  updateConfig: ReturnType<typeof useConfig>["updateConfig"];
  switchIndustry: ReturnType<typeof useConfig>["switchIndustry"];
}) {
  return (
    <div className="max-w-xl space-y-6">
      <SectionHeader title="General Settings" />

      <SettingRow label="Business Name">
        <input
          type="text"
          value={config.businessName}
          onChange={(e) => updateConfig("businessName", e.target.value)}
          className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none transition-colors"
        />
      </SettingRow>

      <SettingRow label="Industry">
        <select
          value={config.industry}
          onChange={(e) => switchIndustry(e.target.value as Industry)}
          className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none transition-colors appearance-none cursor-pointer"
        >
          {INDUSTRIES.map((industry) => (
            <option key={industry.value} value={industry.value}>
              {industry.label}
            </option>
          ))}
        </select>
      </SettingRow>

      <SettingRow label="Accent Color">
        <div className="flex gap-3">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => updateConfig("accentColor", color.value)}
              className={`w-8 h-8 rounded ${color.class} transition-all ${
                config.accentColor === color.value
                  ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                  : "opacity-50 hover:opacity-75"
              }`}
              aria-label={color.label}
            />
          ))}
        </div>
      </SettingRow>

      <div className="pt-4 border-t border-zinc-800">
        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">
          Preset Templates
        </div>
        <div className="flex gap-2">
          {INDUSTRIES.map((industry) => (
            <button
              key={industry.value}
              onClick={() => switchIndustry(industry.value)}
              className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                config.industry === industry.value
                  ? "border-emerald-500 text-emerald-500"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
              }`}
            >
              {industry.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VoiceSettings({
  config,
  updateNestedConfig,
}: {
  config: ReturnType<typeof useConfig>["config"];
  updateNestedConfig: ReturnType<typeof useConfig>["updateNestedConfig"];
}) {
  return (
    <div className="max-w-xl space-y-6">
      <SectionHeader title="Voice Settings" />

      <SettingRow label="Language">
        <select
          value={config.voiceSettings.language}
          onChange={(e) =>
            updateNestedConfig("voiceSettings", "language", e.target.value)
          }
          className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none transition-colors appearance-none cursor-pointer"
        >
          <option value="en-US">English (US)</option>
          <option value="en-GB">English (UK)</option>
          <option value="es-ES">Spanish</option>
          <option value="fr-FR">French</option>
        </select>
      </SettingRow>

      <SettingRow label="Voice ID">
        <select
          value={config.voiceSettings.voiceId}
          onChange={(e) =>
            updateNestedConfig("voiceSettings", "voiceId", e.target.value)
          }
          className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none transition-colors appearance-none cursor-pointer"
        >
          <option value="nova">Nova (Warm, Professional)</option>
          <option value="alloy">Alloy (Neutral, Clear)</option>
          <option value="echo">Echo (Formal, Authoritative)</option>
          <option value="shimmer">Shimmer (Friendly, Upbeat)</option>
        </select>
      </SettingRow>

      <SettingRow label="Speaking Rate">
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.05"
            value={config.voiceSettings.speakingRate}
            onChange={(e) =>
              updateNestedConfig(
                "voiceSettings",
                "speakingRate",
                parseFloat(e.target.value),
              )
            }
            className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <span className="w-12 text-sm font-mono text-zinc-400 text-right">
            {config.voiceSettings.speakingRate.toFixed(2)}x
          </span>
        </div>
      </SettingRow>

      <SettingRow label="Silence Timeout">
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="1000"
            max="5000"
            step="500"
            value={config.voiceSettings.silenceTimeout}
            onChange={(e) =>
              updateNestedConfig(
                "voiceSettings",
                "silenceTimeout",
                parseInt(e.target.value),
              )
            }
            className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <span className="w-16 text-sm font-mono text-zinc-400 text-right">
            {(config.voiceSettings.silenceTimeout / 1000).toFixed(1)}s
          </span>
        </div>
      </SettingRow>
    </div>
  );
}

function PricingSettings({
  config,
  updateNestedConfig,
}: {
  config: ReturnType<typeof useConfig>["config"];
  updateNestedConfig: ReturnType<typeof useConfig>["updateNestedConfig"];
}) {
  return (
    <div className="max-w-xl space-y-6">
      <SectionHeader title="Pricing Configuration" />

      <SettingRow label="Base Rate">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">$</span>
          <input
            type="number"
            value={config.pricing.baseRate}
            onChange={(e) =>
              updateNestedConfig(
                "pricing",
                "baseRate",
                parseFloat(e.target.value) || 0,
              )
            }
            className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-sm text-white font-mono focus:border-zinc-600 focus:outline-none transition-colors"
          />
        </div>
        <div className="text-[10px] text-zinc-600 mt-1">
          SOW Reference: King Room $139 / Cleaning $120-$180
        </div>
      </SettingRow>

      <SettingRow label="Currency">
        <select
          value={config.pricing.currency}
          onChange={(e) =>
            updateNestedConfig("pricing", "currency", e.target.value)
          }
          className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none transition-colors appearance-none cursor-pointer"
        >
          <option value="USD">USD ($)</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="CAD">CAD ($)</option>
        </select>
      </SettingRow>

      <SettingRow label="Tax Rate">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={(config.pricing.taxRate * 100).toFixed(1)}
            onChange={(e) =>
              updateNestedConfig(
                "pricing",
                "taxRate",
                (parseFloat(e.target.value) || 0) / 100,
              )
            }
            className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-sm text-white font-mono focus:border-zinc-600 focus:outline-none transition-colors"
          />
          <span className="text-zinc-500">%</span>
        </div>
      </SettingRow>

      <div className="pt-4 border-t border-zinc-800">
        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-3">
          Additional Fees
        </div>
        <div className="space-y-2">
          {config.pricing.additionalFees.map((fee, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-black border border-zinc-800 rounded px-3 py-2"
            >
              <span className="text-sm text-zinc-400">{fee.label}</span>
              <span className="text-sm font-mono text-white">
                {fee.type === "fixed" ? `$${fee.amount}` : `${fee.amount}%`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-zinc-800 pb-4 mb-6">
      <h2 className="text-lg font-medium text-white">{title}</h2>
    </div>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
