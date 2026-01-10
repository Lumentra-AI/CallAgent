"use client";

import React from "react";
import { useConfig } from "@/context/ConfigContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Smile, MessageCircle, Sparkles, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// PERSONALITY OPTIONS
// ============================================================================

const TONE_OPTIONS = [
  {
    value: "professional",
    label: "Professional",
    description: "Formal and business-focused",
  },
  {
    value: "friendly",
    label: "Friendly",
    description: "Warm and approachable",
  },
  {
    value: "casual",
    label: "Casual",
    description: "Relaxed and conversational",
  },
  {
    value: "formal",
    label: "Formal",
    description: "Traditional and courteous",
  },
] as const;

const VERBOSITY_OPTIONS = [
  { value: "concise", label: "Concise", description: "Brief and to the point" },
  { value: "balanced", label: "Balanced", description: "Moderate detail" },
  {
    value: "detailed",
    label: "Detailed",
    description: "Comprehensive responses",
  },
] as const;

const EMPATHY_OPTIONS = [
  {
    value: "low",
    label: "Low",
    description: "Minimal emotional acknowledgment",
  },
  { value: "medium", label: "Medium", description: "Balanced empathy" },
  { value: "high", label: "High", description: "Highly empathetic responses" },
] as const;

// ============================================================================
// AGENT TAB COMPONENT
// ============================================================================

export default function AgentTab() {
  const { config, updateConfig } = useConfig();

  if (!config) return null;

  const { agentName, agentPersonality } = config;

  const updatePersonality = (updates: Partial<typeof agentPersonality>) => {
    updateConfig("agentPersonality", { ...agentPersonality, ...updates });
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white">Agent Personality</h3>
        <p className="text-sm text-zinc-500">
          Customize your AI agent's name and communication style
        </p>
      </div>

      {/* Agent Name */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">Agent Identity</h4>
        </div>

        <div className="space-y-2">
          <Label className="text-zinc-400">Agent Name</Label>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
              <User className="h-5 w-5 text-indigo-400" />
            </div>
            <Input
              value={agentName}
              onChange={(e) => updateConfig("agentName", e.target.value)}
              placeholder="Lumentra"
              className="max-w-xs border-zinc-800 bg-zinc-950 text-white"
            />
          </div>
          <p className="text-xs text-zinc-600">
            This name will be used when the agent introduces itself to callers
          </p>
        </div>
      </section>

      {/* Tone */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-zinc-400" />
            <h4 className="text-sm font-medium text-white">
              Conversation Tone
            </h4>
          </div>
          <p className="text-xs text-zinc-600">
            How your agent speaks with callers
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {TONE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => updatePersonality({ tone: option.value })}
              className={cn(
                "rounded-lg border p-4 text-left transition-all",
                agentPersonality.tone === option.value
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700",
              )}
            >
              <div className="text-sm font-medium text-white">
                {option.label}
              </div>
              <div className="text-xs text-zinc-500">{option.description}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Verbosity */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-zinc-400" />
            <h4 className="text-sm font-medium text-white">Response Length</h4>
          </div>
          <p className="text-xs text-zinc-600">
            How detailed the agent's responses are
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {VERBOSITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => updatePersonality({ verbosity: option.value })}
              className={cn(
                "rounded-lg border p-4 text-left transition-all",
                agentPersonality.verbosity === option.value
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700",
              )}
            >
              <div className="text-sm font-medium text-white">
                {option.label}
              </div>
              <div className="text-xs text-zinc-500">{option.description}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Empathy */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-2">
            <Smile className="h-4 w-4 text-zinc-400" />
            <h4 className="text-sm font-medium text-white">Empathy Level</h4>
          </div>
          <p className="text-xs text-zinc-600">
            How emotionally responsive the agent is
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {EMPATHY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => updatePersonality({ empathy: option.value })}
              className={cn(
                "rounded-lg border p-4 text-left transition-all",
                agentPersonality.empathy === option.value
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700",
              )}
            >
              <div className="text-sm font-medium text-white">
                {option.label}
              </div>
              <div className="text-xs text-zinc-500">{option.description}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Humor */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-zinc-400" />
              <h4 className="text-sm font-medium text-white">Light Humor</h4>
            </div>
            <p className="text-xs text-zinc-600">
              Allow occasional appropriate humor in conversations
            </p>
          </div>
          <button
            onClick={() =>
              updatePersonality({ humor: !agentPersonality.humor })
            }
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              agentPersonality.humor ? "bg-indigo-600" : "bg-zinc-700",
            )}
          >
            <div
              className={cn(
                "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                agentPersonality.humor && "translate-x-5",
              )}
            />
          </button>
        </div>

        {agentPersonality.humor && (
          <p className="text-xs text-zinc-500">
            Your agent may use light, appropriate humor to create a more
            personable experience. This is used sparingly and always remains
            professional.
          </p>
        )}
      </section>

      {/* Preview */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">
            Personality Preview
          </h4>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <User className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">
                {agentName || "Lumentra"}
              </div>
              <div className="text-[10px] text-zinc-500">AI Voice Agent</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
              {agentPersonality.tone}
            </span>
            <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
              {agentPersonality.verbosity}
            </span>
            <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
              {agentPersonality.empathy} empathy
            </span>
            {agentPersonality.humor && (
              <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                humor enabled
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
