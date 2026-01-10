"use client";

import React from "react";
import { useConfig } from "@/context/ConfigContext";
import { Label } from "@/components/ui/label";
import { MessageSquare, Sun, Moon, Gift, Clock, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// GREETING TYPES
// ============================================================================

interface GreetingField {
  id: keyof NonNullable<ReturnType<typeof useConfig>["config"]>["greetings"];
  label: string;
  description: string;
  icon: React.ElementType;
  placeholder: string;
}

const GREETING_FIELDS: GreetingField[] = [
  {
    id: "standard",
    label: "Standard Greeting",
    description: "Default greeting during business hours",
    icon: MessageSquare,
    placeholder:
      "Thank you for calling {businessName}. This is {agentName}, how may I assist you today?",
  },
  {
    id: "afterHours",
    label: "After Hours",
    description: "Greeting when calling outside business hours",
    icon: Moon,
    placeholder:
      "Thank you for calling {businessName}. We are currently closed...",
  },
  {
    id: "holiday",
    label: "Holiday Greeting",
    description: "Special greeting for holidays",
    icon: Gift,
    placeholder:
      "Happy holidays from {businessName}! We are currently closed...",
  },
  {
    id: "busy",
    label: "High Volume",
    description: "When experiencing high call volume",
    icon: Clock,
    placeholder:
      "Thank you for your patience. I'm {agentName} with {businessName}...",
  },
  {
    id: "returning",
    label: "Returning Caller",
    description: "Personalized greeting for recognized callers",
    icon: UserCheck,
    placeholder: "Welcome back! Thank you for calling {businessName} again...",
  },
];

// ============================================================================
// GREETINGS TAB COMPONENT
// ============================================================================

export default function GreetingsTab() {
  const { config, updateConfig } = useConfig();

  if (!config) return null;

  const { greetings } = config;

  const updateGreeting = (field: keyof typeof greetings, value: string) => {
    updateConfig("greetings", { ...greetings, [field]: value });
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white">Greetings</h3>
        <p className="text-sm text-zinc-500">
          Customize how your AI agent greets callers in different situations
        </p>
      </div>

      {/* Variables Reference */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Available Variables
        </div>
        <div className="flex flex-wrap gap-2">
          {["{businessName}", "{agentName}"].map((variable) => (
            <code
              key={variable}
              className="rounded bg-zinc-800 px-2 py-1 font-mono text-xs text-indigo-400"
            >
              {variable}
            </code>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          Use these variables in your greetings and they will be automatically
          replaced.
        </p>
      </div>

      {/* Greeting Fields */}
      <div className="space-y-6">
        {GREETING_FIELDS.map((field) => {
          const Icon = field.icon;
          const value = greetings[field.id] || "";

          return (
            <section key={field.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800">
                  <Icon className="h-4 w-4 text-zinc-400" />
                </div>
                <div>
                  <Label className="text-white">{field.label}</Label>
                  <p className="text-xs text-zinc-600">{field.description}</p>
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={value}
                  onChange={(e) => updateGreeting(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className={cn(
                    "w-full resize-none rounded-lg border bg-zinc-950 px-4 py-3 text-sm text-white",
                    "placeholder:text-zinc-600",
                    "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
                    "border-zinc-800",
                  )}
                />
                <div className="absolute bottom-2 right-2 text-[10px] text-zinc-600">
                  {value.length} characters
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Preview */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">Preview</h4>
          <p className="text-xs text-zinc-600">
            How your standard greeting will sound
          </p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <div className="mb-1 text-xs text-zinc-500">
                {config.agentName || "Lumentra"}
              </div>
              <p className="text-sm text-white">
                {(greetings.standard || GREETING_FIELDS[0].placeholder)
                  .replace(
                    "{businessName}",
                    config.businessName || "Your Business",
                  )
                  .replace("{agentName}", config.agentName || "Lumentra")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tips */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="text-sm font-medium text-amber-400">
          Tips for effective greetings
        </div>
        <ul className="mt-2 space-y-1 text-xs text-zinc-400">
          <li>Keep greetings concise - callers appreciate efficiency</li>
          <li>Include your business name for brand reinforcement</li>
          <li>Mention how you can help to guide the conversation</li>
          <li>Use a warm but professional tone</li>
        </ul>
      </div>
    </div>
  );
}
