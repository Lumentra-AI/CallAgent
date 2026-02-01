"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useConfig } from "@/context/ConfigContext";
import { useTenantSettings } from "@/hooks/useTenantSettings";
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
// Developer-controlled: Provider selection determines available voices
// Admin-controlled: Voice selection, speaking rate, pitch within provider

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
      id: "sonic",
      name: "Sonic",
      description: "Fast, clear voice",
      gender: "neutral",
    },
    {
      id: "neutral",
      name: "Neutral",
      description: "Balanced, professional",
      gender: "neutral",
    },
    {
      id: "warm",
      name: "Warm",
      description: "Friendly, welcoming",
      gender: "female",
    },
    {
      id: "deep",
      name: "Deep",
      description: "Authoritative, calm",
      gender: "male",
    },
  ],
};

// ============================================================================
// VOICE TAB COMPONENT
// ============================================================================

export default function VoiceTab() {
  const { config, updateConfig, hasPermission } = useConfig();
  const { updateSettings, error, clearError } = useTenantSettings();
  const [sampleText, setSampleText] = useState(
    "Hello! Thank you for calling. How can I assist you today?",
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(clearError, 5000);
      return () => clearTimeout(timeout);
    }
  }, [error, clearError]);

  // Debounced save to database
  const saveToDatabase = useCallback(
    async (voiceConfig: {
      provider: "openai" | "elevenlabs" | "cartesia";
      voice_id: string;
      voice_name: string;
      speaking_rate: number;
      pitch: number;
    }) => {
      // Clear any existing debounce timer
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce: wait 500ms before saving
      debounceRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await updateSettings({ voice_config: voiceConfig });
          setSaveStatus("saved");

          // Reset to idle after 2 seconds
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          saveTimeoutRef.current = setTimeout(() => {
            setSaveStatus("idle");
          }, 2000);
        } catch {
          setSaveStatus("idle");
        }
      }, 500);
    },
    [updateSettings],
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Helper to update voice config and save to database
  const updateVoice = useCallback(
    (updates: {
      provider?: "openai" | "elevenlabs" | "cartesia";
      voiceId?: string;
      voiceName?: string;
      speakingRate?: number;
      pitch?: number;
    }) => {
      if (!config) return;
      const newVoice = { ...config.agentVoice, ...updates };
      updateConfig("agentVoice", newVoice);
      // Save to database - cast provider to correct type
      saveToDatabase({
        provider: newVoice.provider as "openai" | "elevenlabs" | "cartesia",
        voice_id: newVoice.voiceId,
        voice_name: newVoice.voiceName,
        speaking_rate: newVoice.speakingRate,
        pitch: newVoice.pitch,
      });
    },
    [config, updateConfig, saveToDatabase],
  );

  if (!config) return null;

  const { agentVoice } = config;
  const availableVoices = VOICES[agentVoice.provider] || [];

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

  const selectedVoice = availableVoices.find(
    (v) => v.id === agentVoice.voiceId,
  );

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
            <div className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-400">
              <AlertCircle className="h-3 w-3" />
              <span>Failed to save</span>
            </div>
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
      {/* DEVELOPER SECTION: Voice Provider Infrastructure                   */}
      {/* Only visible to developers - controls backend voice API            */}
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
            Backend infrastructure setting. Determines which voice API is used.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {VOICE_PROVIDERS.map((provider) => {
              const isSelected = agentVoice.provider === provider.value;
              return (
                <button
                  key={provider.value}
                  type="button"
                  onClick={() =>
                    updateVoice({
                      provider: provider.value,
                      voiceId: VOICES[provider.value][0]?.id || "",
                      voiceName: VOICES[provider.value][0]?.name || "",
                    })
                  }
                  className={cn(
                    "relative rounded-xl border p-4 text-left transition-all",
                    isSelected
                      ? "border-amber-500/50 bg-amber-500/5 shadow-sm"
                      : "border-border bg-card hover:border-amber-500/30 hover:bg-muted/50",
                  )}
                >
                  {isSelected && (
                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="text-sm font-medium text-foreground">
                    {provider.label}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {provider.description}
                  </div>
                </button>
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
                const isSelected = agentVoice.voiceId === voice.id;
                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() =>
                      updateVoice({
                        voiceId: voice.id,
                        voiceName: voice.name,
                      })
                    }
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:border-primary/50 hover:bg-muted/50",
                    )}
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

                    {/* Play Preview Button */}
                    <VoicePreview
                      voiceId={voice.id}
                      voiceName={voice.name}
                      provider={agentVoice.provider}
                      speakingRate={agentVoice.speakingRate}
                      pitch={agentVoice.pitch}
                      sampleText={sampleText}
                      compact
                    />
                  </button>
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
              voiceId={agentVoice.voiceId}
              voiceName={agentVoice.voiceName}
              provider={agentVoice.provider}
              speakingRate={agentVoice.speakingRate}
              pitch={agentVoice.pitch}
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
                    {agentVoice.speakingRate.toFixed(2)}x
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min="0.75"
                  max="1.25"
                  step="0.05"
                  value={agentVoice.speakingRate}
                  onChange={(e) =>
                    updateVoice({
                      speakingRate: parseFloat(e.target.value),
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

            {/* Pitch */}
            <div className="space-y-4 border-t border-border pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    Pitch
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Voice pitch adjustment
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1">
                  <span className="font-mono text-sm font-medium text-foreground">
                    {agentVoice.pitch.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min="0.8"
                  max="1.2"
                  step="0.05"
                  value={agentVoice.pitch}
                  onChange={(e) =>
                    updateVoice({
                      pitch: parseFloat(e.target.value),
                    })
                  }
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Lower</span>
                  <span>Natural</span>
                  <span>Higher</span>
                </div>
              </div>
            </div>

            {/* Reset to Defaults */}
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() =>
                  updateVoice({
                    speakingRate: 1.0,
                    pitch: 1.0,
                  })
                }
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                Reset to defaults
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
