"use client";

import { useConfig } from "@/context/ConfigContext";
import { Volume2, Play, Shield, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// VOICE OPTIONS
// ============================================================================
// Developer-controlled: Provider selection determines available voices
// Admin-controlled: Voice selection, speaking rate, pitch within provider

const VOICE_PROVIDERS = [
  { value: "openai", label: "OpenAI", description: "Nova, Alloy, Echo voices" },
  {
    value: "elevenlabs",
    label: "ElevenLabs",
    description: "Premium cloned voices",
  },
  { value: "cartesia", label: "Cartesia", description: "Ultra-low latency" },
] as const;

const VOICES = {
  openai: [
    { id: "nova", name: "Nova", description: "Warm, professional female" },
    { id: "alloy", name: "Alloy", description: "Neutral, clear" },
    { id: "echo", name: "Echo", description: "Formal, authoritative male" },
    { id: "shimmer", name: "Shimmer", description: "Friendly, upbeat female" },
  ],
  elevenlabs: [
    { id: "rachel", name: "Rachel", description: "Calm, professional female" },
    { id: "adam", name: "Adam", description: "Deep, trustworthy male" },
    { id: "domi", name: "Domi", description: "Energetic, youthful female" },
  ],
  cartesia: [
    { id: "sonic", name: "Sonic", description: "Fast, clear voice" },
    { id: "neutral", name: "Neutral", description: "Balanced, professional" },
  ],
};

// ============================================================================
// VOICE TAB COMPONENT
// ============================================================================

export default function VoiceTab() {
  const { config, updateConfig, hasPermission } = useConfig();

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
          <Shield className="mx-auto h-12 w-12 text-zinc-700" />
          <p className="mt-4 text-sm text-zinc-500">
            Voice settings are managed by your administrator
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white">Voice Settings</h3>
        <p className="text-sm text-zinc-500">
          Configure how your AI agent sounds to callers
        </p>
      </div>

      {/* ================================================================== */}
      {/* DEVELOPER SECTION: Voice Provider Infrastructure                   */}
      {/* Only visible to developers - controls backend voice API            */}
      {/* ================================================================== */}
      {canManageVoiceProviders && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
            <Settings2 className="h-4 w-4 text-amber-500" />
            <h4 className="text-sm font-medium text-white">Voice Provider</h4>
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-500">
              Platform
            </span>
          </div>
          <p className="text-xs text-zinc-600">
            Backend infrastructure setting. Determines which voice API is used.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {VOICE_PROVIDERS.map((provider) => (
              <button
                key={provider.value}
                type="button"
                onClick={() =>
                  updateConfig("agentVoice", {
                    ...agentVoice,
                    provider: provider.value,
                    voiceId: VOICES[provider.value][0]?.id || "",
                    voiceName: VOICES[provider.value][0]?.name || "",
                  })
                }
                className={cn(
                  "rounded-lg border p-4 text-left transition-all",
                  agentVoice.provider === provider.value
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-700",
                )}
              >
                <div className="text-sm font-medium text-white">
                  {provider.label}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {provider.description}
                </div>
              </button>
            ))}
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
            <div className="border-b border-zinc-800 pb-2">
              <h4 className="text-sm font-medium text-white">Agent Voice</h4>
            </div>
            <p className="text-xs text-zinc-600">
              Select the voice your AI agent will use when speaking to callers.
            </p>

            <div className="space-y-2">
              {availableVoices.map((voice) => (
                <div
                  key={voice.id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    updateConfig("agentVoice", {
                      ...agentVoice,
                      voiceId: voice.id,
                      voiceName: voice.name,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateConfig("agentVoice", {
                        ...agentVoice,
                        voiceId: voice.id,
                        voiceName: voice.name,
                      });
                    }
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-all",
                    agentVoice.voiceId === voice.id
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-zinc-800 bg-zinc-900 hover:border-zinc-700",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Volume2
                      className={cn(
                        "h-4 w-4",
                        agentVoice.voiceId === voice.id
                          ? "text-indigo-400"
                          : "text-zinc-500",
                      )}
                    />
                    <div className="text-left">
                      <div className="text-sm font-medium text-white">
                        {voice.name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {voice.description}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Preview would play audio here
                    }}
                  >
                    <Play className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Speaking Rate */}
          <section className="space-y-4">
            <div className="border-b border-zinc-800 pb-2">
              <h4 className="text-sm font-medium text-white">Speaking Rate</h4>
            </div>
            <p className="text-xs text-zinc-600">
              Adjust how fast or slow the agent speaks.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Speed</span>
                <span className="font-mono text-sm text-white">
                  {agentVoice.speakingRate.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.25"
                step="0.05"
                value={agentVoice.speakingRate}
                onChange={(e) =>
                  updateConfig("agentVoice", {
                    ...agentVoice,
                    speakingRate: parseFloat(e.target.value),
                  })
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>Slower (0.75x)</span>
                <span>Normal (1.0x)</span>
                <span>Faster (1.25x)</span>
              </div>
            </div>
          </section>

          {/* Pitch */}
          <section className="space-y-4">
            <div className="border-b border-zinc-800 pb-2">
              <h4 className="text-sm font-medium text-white">Pitch</h4>
            </div>
            <p className="text-xs text-zinc-600">
              Fine-tune the voice pitch for your brand.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Pitch Adjustment</span>
                <span className="font-mono text-sm text-white">
                  {agentVoice.pitch.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.05"
                value={agentVoice.pitch}
                onChange={(e) =>
                  updateConfig("agentVoice", {
                    ...agentVoice,
                    pitch: parseFloat(e.target.value),
                  })
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>Lower</span>
                <span>Natural</span>
                <span>Higher</span>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
