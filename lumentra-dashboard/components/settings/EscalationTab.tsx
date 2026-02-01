"use client";

import React, { useCallback, useRef, useEffect, useState } from "react";
import { useConfig } from "@/context/ConfigContext";
import { useTenantSettings } from "@/hooks/useTenantSettings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  PhoneForwarded,
  Mail,
  AlertTriangle,
  Plus,
  Trash2,
  Bell,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// ESCALATION TAB COMPONENT
// ============================================================================

export default function EscalationTab() {
  const { config, updateConfig } = useConfig();
  const { updateSettings, error, clearError } = useTenantSettings();
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
    async (dbUpdates: Record<string, unknown>) => {
      // Clear any existing debounce timer
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce: wait 500ms before saving
      debounceRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await updateSettings(dbUpdates);
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

  if (!config) return null;

  const { escalation } = config;

  const updateEscalation = (updates: Partial<typeof escalation>) => {
    const newEscalation = { ...escalation, ...updates };
    updateConfig("escalation", newEscalation);

    // Map to database fields
    const dbUpdates: Record<string, unknown> = {};
    if ("enabled" in updates) {
      dbUpdates.escalation_enabled = updates.enabled;
    }
    if ("fallbackPhone" in updates) {
      dbUpdates.escalation_phone = updates.fallbackPhone || null;
    }

    // Only save if we have mapped updates
    if (Object.keys(dbUpdates).length > 0) {
      saveToDatabase(dbUpdates);
    }
  };

  const addTrigger = () => {
    updateEscalation({
      triggers: [
        ...escalation.triggers,
        {
          id: crypto.randomUUID(),
          condition: "custom",
          action: "message",
          priority: "medium",
        },
      ],
    });
  };

  const updateTrigger = (
    id: string,
    updates: Partial<(typeof escalation.triggers)[0]>,
  ) => {
    updateEscalation({
      triggers: escalation.triggers.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      ),
    });
  };

  const removeTrigger = (id: string) => {
    updateEscalation({
      triggers: escalation.triggers.filter((t) => t.id !== id),
    });
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header with Save Status */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Escalation Rules</h3>
          <p className="text-sm text-zinc-500">
            Configure when and how calls should be escalated to human agents
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

      {/* Enable/Disable */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div>
            <h4 className="text-sm font-medium text-white">Call Escalation</h4>
            <p className="text-xs text-zinc-600">
              Allow calls to be transferred to human agents
            </p>
          </div>
          <button
            onClick={() => updateEscalation({ enabled: !escalation.enabled })}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              escalation.enabled ? "bg-indigo-600" : "bg-zinc-700",
            )}
          >
            <div
              className={cn(
                "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                escalation.enabled && "translate-x-5",
              )}
            />
          </button>
        </div>
      </section>

      {escalation.enabled && (
        <>
          {/* Fallback Contact */}
          <section className="space-y-4">
            <div className="border-b border-zinc-800 pb-2">
              <h4 className="text-sm font-medium text-white">
                Fallback Contact
              </h4>
              <p className="text-xs text-zinc-600">
                Where to route calls when AI cannot help
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-zinc-400">Phone Number</Label>
                <div className="relative">
                  <PhoneForwarded className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={escalation.fallbackPhone || ""}
                    onChange={(e) =>
                      updateEscalation({ fallbackPhone: e.target.value })
                    }
                    placeholder="+1 (555) 123-4567"
                    className="border-zinc-800 bg-zinc-950 pl-9 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-400">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={escalation.fallbackEmail || ""}
                    onChange={(e) =>
                      updateEscalation({ fallbackEmail: e.target.value })
                    }
                    placeholder="support@company.com"
                    className="border-zinc-800 bg-zinc-950 pl-9 text-white"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Max Wait Time */}
          <section className="space-y-4">
            <div className="border-b border-zinc-800 pb-2">
              <h4 className="text-sm font-medium text-white">
                Auto-Escalation
              </h4>
              <p className="text-xs text-zinc-600">
                Automatically escalate if AI struggles too long
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Max Wait Time (seconds)</Label>
              <Input
                type="number"
                min="0"
                max="300"
                value={escalation.maxWaitTime}
                onChange={(e) =>
                  updateEscalation({
                    maxWaitTime: parseInt(e.target.value) || 60,
                  })
                }
                className="max-w-32 border-zinc-800 bg-zinc-950 font-mono text-white"
              />
              <p className="text-xs text-zinc-600">
                Escalate if AI cannot resolve issue within this time
              </p>
            </div>
          </section>

          {/* Notifications */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div>
                <h4 className="text-sm font-medium text-white">
                  Notify on Escalation
                </h4>
                <p className="text-xs text-zinc-600">
                  Send notification when a call is escalated
                </p>
              </div>
              <button
                onClick={() =>
                  updateEscalation({
                    notifyOnEscalation: !escalation.notifyOnEscalation,
                  })
                }
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  escalation.notifyOnEscalation
                    ? "bg-indigo-600"
                    : "bg-zinc-700",
                )}
              >
                <div
                  className={cn(
                    "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                    escalation.notifyOnEscalation && "translate-x-5",
                  )}
                />
              </button>
            </div>

            {escalation.notifyOnEscalation && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                <Bell className="h-4 w-4 text-green-500" />
                <span className="text-xs text-green-400">
                  You&apos;ll be notified via email when escalations occur
                </span>
              </div>
            )}
          </section>

          {/* Escalation Triggers */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div>
                <h4 className="text-sm font-medium text-white">
                  Escalation Triggers
                </h4>
                <p className="text-xs text-zinc-600">
                  Conditions that trigger escalation
                </p>
              </div>
              <Button
                onClick={addTrigger}
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-white"
              >
                <Plus className="mr-1 h-3 w-3" />
                Add
              </Button>
            </div>

            <div className="space-y-3">
              {escalation.triggers.map((trigger) => (
                <div
                  key={trigger.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        trigger.priority === "critical"
                          ? "bg-red-500/20"
                          : trigger.priority === "high"
                            ? "bg-amber-500/20"
                            : "bg-zinc-800",
                      )}
                    >
                      <AlertTriangle
                        className={cn(
                          "h-4 w-4",
                          trigger.priority === "critical"
                            ? "text-red-400"
                            : trigger.priority === "high"
                              ? "text-amber-400"
                              : "text-zinc-400",
                        )}
                      />
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-zinc-500">
                            Condition
                          </Label>
                          <select
                            value={trigger.condition}
                            onChange={(e) =>
                              updateTrigger(trigger.id, {
                                condition: e.target.value,
                              })
                            }
                            className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-white focus:outline-none"
                          >
                            <option value="sentiment < -0.5">
                              Negative sentiment
                            </option>
                            <option value="intent === emergency">
                              Emergency intent
                            </option>
                            <option value="confidence < 0.6">
                              Low confidence
                            </option>
                            <option value="request === transfer">
                              Transfer request
                            </option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-zinc-500">
                            Action
                          </Label>
                          <select
                            value={trigger.action}
                            onChange={(e) =>
                              updateTrigger(trigger.id, {
                                action: e.target.value as typeof trigger.action,
                              })
                            }
                            className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-white focus:outline-none"
                          >
                            <option value="transfer">Transfer call</option>
                            <option value="message">Take message</option>
                            <option value="email">Send email alert</option>
                            <option value="sms">Send SMS alert</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          {(["low", "medium", "high", "critical"] as const).map(
                            (p) => (
                              <button
                                key={p}
                                onClick={() =>
                                  updateTrigger(trigger.id, { priority: p })
                                }
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase transition-colors",
                                  trigger.priority === p
                                    ? p === "critical"
                                      ? "bg-red-500/20 text-red-400"
                                      : p === "high"
                                        ? "bg-amber-500/20 text-amber-400"
                                        : p === "medium"
                                          ? "bg-blue-500/20 text-blue-400"
                                          : "bg-zinc-700 text-zinc-300"
                                    : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700",
                                )}
                              >
                                {p}
                              </button>
                            ),
                          )}
                        </div>

                        <button
                          onClick={() => removeTrigger(trigger.id)}
                          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {escalation.triggers.length === 0 && (
                <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center">
                  <p className="text-sm text-zinc-500">
                    No escalation triggers configured
                  </p>
                  <p className="text-xs text-zinc-600">
                    Add triggers to control when calls are escalated
                  </p>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Info */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <PhoneForwarded className="mt-0.5 h-4 w-4 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-amber-400">
              How escalation works
            </p>
            <p className="text-xs text-zinc-400">
              When a trigger condition is met, the AI will gracefully hand off
              the call based on the configured action. For transfers, the caller
              will be connected to your fallback number. For messages, the AI
              will take detailed notes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
