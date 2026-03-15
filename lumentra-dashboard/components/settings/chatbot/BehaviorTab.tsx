"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ChatBehaviorConfig, ContactCollectionMode } from "./types";

interface BehaviorTabProps {
  config: ChatBehaviorConfig;
  onChange: (updates: Partial<ChatBehaviorConfig>) => void;
}

const COLLECTION_MODES: {
  value: ContactCollectionMode;
  label: string;
  description: string;
}[] = [
  {
    value: "soft",
    label: "Soft",
    description: "Ask once for contact info, respect if they decline",
  },
  {
    value: "persistent",
    label: "Persistent",
    description: "Weave contact requests into conversation naturally",
  },
];

export default function BehaviorTab({ config, onChange }: BehaviorTabProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Contact collection mode */}
      <div className="rounded-xl border bg-card p-5">
        <Label className="text-sm font-semibold">Contact Collection Mode</Label>
        <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
          How the chatbot asks visitors for their contact information
        </p>
        <div className="space-y-2">
          {COLLECTION_MODES.map((mode) => {
            const isSelected = config.contact_collection_mode === mode.value;
            return (
              <label
                key={mode.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="contact_collection"
                  value={mode.value}
                  checked={isSelected}
                  onChange={() =>
                    onChange({ contact_collection_mode: mode.value })
                  }
                  className="mt-0.5 h-4 w-4"
                />
                <div>
                  <span className="text-sm font-medium">{mode.label}</span>
                  <p className="text-xs text-muted-foreground">
                    {mode.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Escalation triggers */}
      <div className="rounded-xl border bg-card p-5">
        <Label htmlFor="escalation_triggers" className="text-sm font-semibold">
          Escalation Triggers
        </Label>
        <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
          Phrases or situations that should prompt the chatbot to offer human
          assistance. One trigger per line.
        </p>
        <textarea
          id="escalation_triggers"
          value={config.escalation_triggers}
          onChange={(e) => onChange({ escalation_triggers: e.target.value })}
          placeholder={
            "when someone asks for a manager\nwhen a customer is upset\nwhen the question is about billing"
          }
          rows={5}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        />
      </div>

      {/* Offline message */}
      <div className="rounded-xl border bg-card p-5">
        <Label htmlFor="offline_message" className="text-sm font-semibold">
          Offline Message
        </Label>
        <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
          Shown to visitors when your business is outside operating hours
        </p>
        <textarea
          id="offline_message"
          value={config.offline_message}
          onChange={(e) => onChange({ offline_message: e.target.value })}
          placeholder="We're currently closed. Leave your details and we'll get back to you during business hours."
          rows={3}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        />
      </div>

      {/* Max conversation length */}
      <div className="rounded-xl border bg-card p-5">
        <Label
          htmlFor="max_conversation_length"
          className="text-sm font-semibold"
        >
          Max Conversation Length
        </Label>
        <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
          Maximum number of messages per conversation before prompting to start
          a new one
        </p>
        <Input
          id="max_conversation_length"
          type="number"
          min={5}
          max={200}
          value={config.max_conversation_length}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= 1) {
              onChange({ max_conversation_length: val });
            }
          }}
          className="w-32 text-sm"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Recommended: 20-60 messages
        </p>
      </div>
    </div>
  );
}
