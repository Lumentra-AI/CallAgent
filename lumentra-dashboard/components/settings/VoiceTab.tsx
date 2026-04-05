"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useConfig } from "@/context/ConfigContext";
import { useTenantConfig } from "@/hooks/useTenantConfig";
import {
  Volume2,
  Play,
  Shield,
  Settings2,
  Check,
  Mic,
  Sliders,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VoicePreview, SampleTextSelector } from "./VoicePreview";

// ============================================================================
// VOICE OPTIONS
// ============================================================================
// Platform admin-controlled: Provider selection determines available voices
// Business admin-controlled: Voice selection, speaking rate, pitch within provider

const VOICE_PROVIDERS = [
  {
    value: "openai",
    label: "OpenAI",
    description: "Nova, Alloy, Echo voices",
    color: "emerald",
  },
  {
    value: "elevenlabs",
    label: "ElevenLabs",
    description: "Premium cloned voices",
    color: "violet",
  },
  {
    value: "cartesia",
    label: "Cartesia",
    description: "Ultra-low latency",
    color: "blue",
  },
] as const;

const VOICES = {
  openai: [
    {
      id: "nova",
      name: "Nova",
      description: "Warm, professional female",
      gender: "female",
    },
    {
      id: "alloy",
      name: "Alloy",
      description: "Neutral, clear",
      gender: "neutral",
    },
    {
      id: "echo",
      name: "Echo",
      description: "Formal, authoritative male",
      gender: "male",
    },
    {
      id: "shimmer",
      name: "Shimmer",
      description: "Friendly, upbeat female",
      gender: "female",
    },
    {
      id: "onyx",
      name: "Onyx",
      description: "Deep, resonant male",
      gender: "male",
    },
    {
      id: "fable",
      name: "Fable",
      description: "British, expressive",
      gender: "neutral",
    },
  ],
  elevenlabs: [
    {
      id: "rachel",
      name: "Rachel",
      description: "Calm, professional female",
      gender: "female",
    },
    {
      id: "adam",
      name: "Adam",
      description: "Deep, trustworthy male",
      gender: "male",
    },
    {
      id: "domi",
      name: "Domi",
      description: "Energetic, youthful female",
      gender: "female",
    },
    {
      id: "elli",
      name: "Elli",
      description: "Young, friendly female",
      gender: "female",
    },
    {
      id: "josh",
      name: "Josh",
      description: "Confident, American male",
      gender: "male",
    },
    {
      id: "sam",
      name: "Sam",
      description: "Raspy, mature male",
      gender: "male",
    },
  ],
  cartesia: [
    {
      id: "694f9389-aac1-45b6-b726-9d9369183238",
      name: "Sarah",
      description: "Natural, conversational female",
      gender: "female",
    },
    {
      id: "829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30",
      name: "Customer Support Lady",
      description: "Warm, professional female",
      gender: "female",
    },
    {
      id: "248be419-c632-4f23-adf1-5324ed7dbf1d",
      name: "Professional Woman",
      description: "Polished, clear female",
      gender: "female",
    },
    {
      id: "a167e0f3-df7e-4d52-a9c3-f949145efdab",
      name: "Customer Support Man",
      description: "Friendly, helpful male",
      gender: "male",
    },
    {
      id: "a0e99841-438c-4a64-b679-ae501e7d6091",
      name: "Barbershop Man",
      description: "Warm, approachable male",
      gender: "male",
    },
    {
      id: "00a77add-48d5-4ef6-8157-71e5437b282d",
      name: "Calm Lady",
      description: "Soothing, reassuring female",
      gender: "female",
    },
  ],
};

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_VOICE_CONFIG = {
  provider: "cartesia" as const,
  voice_id: "694f9389-aac1-45b6-b726-9d9369183238",
  voice_name: "Sarah",
  speaking_rate: 1.0,
  pitch: 1.0,
};

// ============================================================================
// VOICE TAB COMPONENT
// ============================================================================

export default function VoiceTab() {
  const { hasPermission } = useConfig();
  const { tenant, saveStatus, error, clearError, updateSettings } =
    useTenantConfig();
  const [sampleText, setSampleText] = useState(
    "Hello! Thank you for calling. How can I assist you today?",
  );

  // Derive voice config from tenant, with sensible defaults.
  // IMPORTANT: Only Cartesia is active in the live agent. Force provider to
  // cartesia regardless of what's saved -- this auto-heals legacy tenants
  // that were saved with openai or elevenlabs before those were disabled.
  const rawConfig = tenant?.voice_config ?? DEFAULT_VOICE_CONFIG;
  const provider = "cartesia" as const;

  // Read voice ID from either key shape (setup writes voiceId, settings writes voice_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawVoiceId = rawConfig.voice_id ?? (rawConfig as any).voiceId ?? null;
  const isValidCartesiaId =
    rawVoiceId && VOICES.cartesia.some((v) => v.id === rawVoiceId);
  const voiceId = isValidCartesiaId
    ? rawVoiceId
    : DEFAULT_VOICE_CONFIG.voice_id;
  const voiceName =
    VOICES.cartesia.find((v) => v.id === voiceId)?.name ??
    DEFAULT_VOICE_CONFIG.voice_name;
  const speakingRate = rawConfig.speaking_rate ?? 1.0;

  const availableVoices = VOICES[provider];

  // Auto-heal: persist correction if provider isn't cartesia, voice_id key is
  // missing/invalid, or the canonical snake_case shape is absent.
  const needsHeal =
    rawConfig.provider !== "cartesia" ||
    !isValidCartesiaId ||
    rawConfig.voice_id !== voiceId;
  const healedRef = useRef(false);
  useEffect(() => {
    if (needsHeal && !healedRef.current && tenant) {
      healedRef.current = true;
      updateSettings({
        voice_config: {
          provider: "cartesia",
          voice_id: voiceId,
          voiceId: voiceId,
          voice_name: voiceName,
          speaking_rate: speakingRate,
          pitch: 1.0,
        },
      });
    }
  }, [needsHeal, tenant, voiceId, voiceName, speakingRate, updateSettings]);

  // Helper to update voice config via the unified hook
  const updateVoice = useCallback(
    (
      updates: Partial<{
        voice_id: string;
        voice_name: string;
        speaking_rate: number;
      }>,
    ) => {
      const current = {
        provider: "cartesia" as const,
        voice_id: voiceId,
        voiceId: voiceId,
        voice_name: voiceName,
        speaking_rate: speakingRate,
        pitch: 1.0,
      };
      const newConfig = { ...current, ...updates };
      // Keep both key shapes in sync
      if (updates.voice_id) newConfig.voiceId = updates.voice_id;
      updateSettings({ voice_config: newConfig });
    },
    [voiceId, voiceName, speakingRate, updateSettings],
  );

  if (!tenant) return null;

  const canManageVoiceProviders = hasPermission("manage_voice_providers");
  const canManageVoice = hasPermission("manage_voice");

  // Staff cannot access this tab - they only monitor
  if (!canManageVoice && !canManageVoiceProviders) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Voice settings are managed by your administrator
          </p>
        </div>
      </div>
    );
  }

  const selectedVoice = availableVoices.find((v) => v.id === voiceId);

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header with Save Status */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Voice Settings
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure how your AI agent sounds to callers
          </p>
        </div>

        {/* Save Status Indicator */}
        <div className="flex items-center gap-2">
          {error && (
            <button
              type="button"
              onClick={clearError}
              className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-400"
            >
              <AlertCircle className="h-3 w-3" />
              <span>Failed to save</span>
            </button>
          )}
          {!error && saveStatus === "saving" && (
            <div className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          {!error && saveStatus === "saved" && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
              <Check className="h-3 w-3" />
              <span>Saved</span>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* PLATFORM ADMIN SECTION: Voice Provider Infrastructure              */}
      {/* Only visible to platform admins - controls backend voice API       */}
      {/* NOTE: Only Cartesia is wired to the live agent runtime today.      */}
      {/* OpenAI/ElevenLabs are saved in config but NOT used by the agent.   */}
      {/* ================================================================== */}
      {canManageVoiceProviders && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Settings2 className="h-4 w-4 text-amber-500" />
            <h4 className="text-sm font-medium text-foreground">
              Voice Provider
            </h4>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-500">
              Platform
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Backend infrastructure setting. Only Cartesia is active in the live
            agent today. Other providers are planned but not yet wired to
            runtime.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {VOICE_PROVIDERS.map((p) => {
              const isSelected = provider === p.value;
              const isActive = p.value === "cartesia";
              return (
                <div
                  key={p.value}
                  className={cn(
                    "relative rounded-xl border p-4 text-left transition-all",
                    isActive && isSelected
                      ? "border-amber-500/50 bg-amber-500/5 shadow-sm"
                      : isActive
                        ? "border-border bg-card"
                        : "cursor-not-allowed border-border bg-muted/30 opacity-50",
                  )}
                >
                  {isActive && isSelected && (
                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="text-sm font-medium text-foreground">
                    {p.label}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {p.description}
                  </div>
                  {!isActive && (
                    <div className="mt-1 text-[10px] font-medium text-amber-500">
                      Coming soon
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ================================================================== */}
      {/* ADMIN SECTION: Voice Configuration                                 */}
      {/* Business owner controls - agent personality and voice              */}
      {/* ================================================================== */}
      {canManageVoice && (
        <>
          {/* Voice Selection */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Mic className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium text-foreground">
                Agent Voice
              </h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Select the voice your AI agent will use when speaking to callers.
            </p>

            {/* Current Selection */}
            {selectedVoice && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Volume2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="text-base font-medium text-foreground">
                        {selectedVoice.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {selectedVoice.description}
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    Active
                  </span>
                </div>
              </div>
            )}

            {/* Voice Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              {availableVoices.map((voice) => {
                const isSelected = voiceId === voice.id;
                return (
                  <div
                    key={voice.id}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:border-primary/50 hover:bg-muted/50",
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      updateVoice({
                        voice_id: voice.id,
                        voice_name: voice.name,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        updateVoice({
                          voice_id: voice.id,
                          voice_name: voice.name,
                        });
                      }
                    }}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                        isSelected
                          ? "bg-primary/10"
                          : "bg-muted group-hover:bg-primary/10",
                      )}
                    >
                      <Volume2
                        className={cn(
                          "h-5 w-5 transition-colors",
                          isSelected
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-primary",
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <div
                        className={cn(
                          "text-sm font-medium",
                          isSelected ? "text-primary" : "text-foreground",
                        )}
                      >
                        {voice.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {voice.description}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}

                    {/* Play Preview Button -- sibling, not nested button */}
                    <VoicePreview
                      voiceId={voice.id}
                      voiceName={voice.name}
                      provider={provider}
                      speakingRate={speakingRate}
                      pitch={1.0}
                      sampleText={sampleText}
                      compact
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Voice Preview Panel */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium text-foreground">
                Preview Voice
              </h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Listen to a sample of how your agent will sound with current
              settings.
            </p>

            <SampleTextSelector value={sampleText} onChange={setSampleText} />

            <VoicePreview
              voiceId={voiceId}
              voiceName={voiceName}
              provider={provider}
              speakingRate={speakingRate}
              pitch={1.0}
              sampleText={sampleText}
            />
          </section>

          {/* Voice Fine-Tuning */}
          <section className="space-y-6 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium text-foreground">
                Voice Fine-Tuning
              </h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Adjust how the voice sounds to match your brand.
            </p>

            {/* Speaking Rate */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    Speaking Rate
                  </div>
                  <div className="text-xs text-muted-foreground">
                    How fast or slow the agent speaks
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1">
                  <span className="font-mono text-sm font-medium text-foreground">
                    {speakingRate.toFixed(2)}x
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min="0.75"
                  max="1.25"
                  step="0.05"
                  value={speakingRate}
                  onChange={(e) =>
                    updateVoice({
                      speaking_rate: parseFloat(e.target.value),
                    })
                  }
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Slower</span>
                  <span>Normal</span>
                  <span>Faster</span>
                </div>
              </div>
            </div>

            {/* Reset to Defaults */}
            <div className="border-t border-border pt-6">
              <button
                type="button"
                onClick={() =>
                  updateVoice({
                    speaking_rate: 1.0,
                  })
                }
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                Reset to default speed
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
