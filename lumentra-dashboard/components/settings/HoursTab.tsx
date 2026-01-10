"use client";

import React from "react";
import { useConfig } from "@/context/ConfigContext";
import { Label } from "@/components/ui/label";
import { Moon, Sun, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// DAYS OF WEEK
// ============================================================================

const DAYS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
];

// ============================================================================
// HOURS TAB COMPONENT
// ============================================================================

export default function HoursTab() {
  const { config, updateConfig } = useConfig();

  if (!config) return null;

  const { operatingHours, lateNightMode } = config;

  const updateHours = (updates: Partial<typeof operatingHours>) => {
    updateConfig("operatingHours", { ...operatingHours, ...updates });
  };

  const updateDaySchedule = (
    day: number,
    updates: Partial<(typeof operatingHours.schedule)[0]>,
  ) => {
    updateHours({
      schedule: operatingHours.schedule.map((s) =>
        s.day === day ? { ...s, ...updates } : s,
      ),
    });
  };

  const updateLateNight = (updates: Partial<typeof lateNightMode>) => {
    updateConfig("lateNightMode", { ...lateNightMode, ...updates });
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white">Operating Hours</h3>
        <p className="text-sm text-zinc-500">
          Configure when your AI agent handles calls vs. forwards to voicemail
        </p>
      </div>

      {/* Timezone */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">Timezone</h4>
        </div>

        <select
          value={operatingHours.timezone}
          onChange={(e) => updateHours({ timezone: e.target.value })}
          className="h-10 w-full max-w-xs rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </section>

      {/* Weekly Schedule */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">Weekly Schedule</h4>
          <p className="text-xs text-zinc-600">
            Set business hours when staff are available for transfers
          </p>
        </div>

        <div className="space-y-2">
          {operatingHours.schedule.map((daySchedule) => {
            const day = DAYS.find((d) => d.value === daySchedule.day);
            if (!day) return null;

            return (
              <div
                key={daySchedule.day}
                className={cn(
                  "flex items-center gap-4 rounded-lg border px-4 py-3",
                  daySchedule.enabled
                    ? "border-zinc-800 bg-zinc-900"
                    : "border-zinc-800/50 bg-zinc-900/50",
                )}
              >
                {/* Day Toggle */}
                <button
                  onClick={() =>
                    updateDaySchedule(daySchedule.day, {
                      enabled: !daySchedule.enabled,
                    })
                  }
                  className={cn(
                    "w-20 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    daySchedule.enabled
                      ? "bg-indigo-500/20 text-indigo-400"
                      : "bg-zinc-800 text-zinc-500",
                  )}
                >
                  {day.short}
                </button>

                {/* Time Inputs */}
                {daySchedule.enabled ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-amber-500" />
                      <input
                        type="time"
                        value={daySchedule.openTime}
                        onChange={(e) =>
                          updateDaySchedule(daySchedule.day, {
                            openTime: e.target.value,
                          })
                        }
                        className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-xs text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <span className="text-zinc-600">to</span>

                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4 text-indigo-400" />
                      <input
                        type="time"
                        value={daySchedule.closeTime}
                        onChange={(e) =>
                          updateDaySchedule(daySchedule.day, {
                            closeTime: e.target.value,
                          })
                        }
                        className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-xs text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-zinc-500">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Late Night Mode */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div>
            <h4 className="text-sm font-medium text-white">Late Night Mode</h4>
            <p className="text-xs text-zinc-600">
              Special handling for after-hours calls
            </p>
          </div>
          <button
            onClick={() => updateLateNight({ enabled: !lateNightMode.enabled })}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              lateNightMode.enabled ? "bg-indigo-600" : "bg-zinc-700",
            )}
          >
            <div
              className={cn(
                "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                lateNightMode.enabled && "translate-x-5",
              )}
            />
          </button>
        </div>

        {lateNightMode.enabled && (
          <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            {/* Time Range */}
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-500">Start Time</Label>
                <input
                  type="time"
                  value={lateNightMode.startTime}
                  onChange={(e) =>
                    updateLateNight({ startTime: e.target.value })
                  }
                  className="rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <span className="text-zinc-600">to</span>

              <div className="space-y-1">
                <Label className="text-xs text-zinc-500">End Time</Label>
                <input
                  type="time"
                  value={lateNightMode.endTime}
                  onChange={(e) => updateLateNight({ endTime: e.target.value })}
                  className="rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Behavior */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-500">Behavior</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  {
                    value: "full_service",
                    label: "Full Service",
                    desc: "Handle all calls",
                  },
                  {
                    value: "limited",
                    label: "Limited",
                    desc: "Basic inquiries only",
                  },
                  {
                    value: "message_only",
                    label: "Message Only",
                    desc: "Take messages",
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      updateLateNight({
                        behavior: option.value as typeof lateNightMode.behavior,
                      })
                    }
                    className={cn(
                      "rounded-md border p-3 text-left transition-all",
                      lateNightMode.behavior === option.value
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-zinc-700 bg-zinc-800 hover:border-zinc-600",
                    )}
                  >
                    <div className="text-xs font-medium text-white">
                      {option.label}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {option.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Note */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-4 w-4 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-amber-400">
              24/7 AI Coverage
            </p>
            <p className="text-xs text-zinc-400">
              Your AI agent handles calls around the clock. Business hours
              determine when live transfers to staff are available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
