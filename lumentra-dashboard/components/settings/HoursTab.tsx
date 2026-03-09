"use client";

import React from "react";
import { useTenantConfig } from "@/hooks/useTenantConfig";
import { Moon, Sun, Clock, Check, Loader2 } from "lucide-react";
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
  // US
  { value: "America/New_York", label: "Eastern Time (ET, UTC-5)" },
  { value: "America/Chicago", label: "Central Time (CT, UTC-6)" },
  { value: "America/Denver", label: "Mountain Time (MT, UTC-7)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT, UTC-8)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT, UTC-9)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT, UTC-10)" },
  // Canada
  { value: "America/Halifax", label: "Atlantic Time (AT, UTC-4)" },
  { value: "America/St_Johns", label: "Newfoundland (NT, UTC-3:30)" },
  // Americas
  { value: "America/Mexico_City", label: "Mexico City (CST, UTC-6)" },
  { value: "America/Bogota", label: "Colombia (COT, UTC-5)" },
  { value: "America/Sao_Paulo", label: "Brazil (BRT, UTC-3)" },
  // Europe
  { value: "Europe/London", label: "London (GMT/BST, UTC+0)" },
  { value: "Europe/Paris", label: "Central Europe (CET, UTC+1)" },
  { value: "Europe/Athens", label: "Eastern Europe (EET, UTC+2)" },
  // Asia / Pacific
  { value: "Asia/Dubai", label: "Dubai (GST, UTC+4)" },
  { value: "Asia/Kolkata", label: "India (IST, UTC+5:30)" },
  { value: "Asia/Tokyo", label: "Japan (JST, UTC+9)" },
  { value: "Australia/Sydney", label: "Sydney (AEST, UTC+10)" },
  { value: "Pacific/Auckland", label: "New Zealand (NZST, UTC+12)" },
];

const DEFAULT_SCHEDULE = DAYS.map((d) => ({
  day: d.value,
  enabled: d.value >= 1 && d.value <= 5,
  open_time: "09:00",
  close_time: "17:00",
}));

const DEFAULT_TIMEZONE = "America/New_York";

// ============================================================================
// HOURS TAB COMPONENT
// ============================================================================

export default function HoursTab() {
  const { tenant, saveStatus, error, clearError, updateSettings } =
    useTenantConfig();

  if (!tenant) return null;

  const timezone = tenant.timezone || DEFAULT_TIMEZONE;
  const schedule = tenant.operating_hours?.schedule || DEFAULT_SCHEDULE;
  const holidays = tenant.operating_hours?.holidays || [];

  const updateTimezone = (newTimezone: string) => {
    updateSettings({ timezone: newTimezone });
  };

  const updateDaySchedule = (
    day: number,
    updates: Partial<(typeof schedule)[0]>,
  ) => {
    const newSchedule = schedule.map((s) =>
      s.day === day ? { ...s, ...updates } : s,
    );
    updateSettings({
      operating_hours: { schedule: newSchedule, holidays },
    });
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Operating Hours</h3>
          <p className="text-sm text-zinc-500">
            Configure when your AI agent handles calls vs. forwards to voicemail
          </p>
        </div>
        {/* Save Status Indicator */}
        {saveStatus === "saving" && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
        {saveStatus === "saved" && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            Saved
          </div>
        )}
        {error && (
          <button
            onClick={clearError}
            className="text-sm text-red-500 hover:underline"
          >
            {error}
          </button>
        )}
      </div>

      {/* Timezone */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">Timezone</h4>
        </div>

        <select
          value={timezone}
          onChange={(e) => updateTimezone(e.target.value)}
          className="h-10 w-full max-w-xs rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          <optgroup label="United States">
            {TIMEZONES.slice(0, 6).map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Canada">
            {TIMEZONES.slice(6, 8).map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Americas">
            {TIMEZONES.slice(8, 11).map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Europe">
            {TIMEZONES.slice(11, 14).map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Asia / Pacific">
            {TIMEZONES.slice(14).map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </optgroup>
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
          {schedule.map((daySchedule) => {
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
                        value={daySchedule.open_time}
                        onChange={(e) =>
                          updateDaySchedule(daySchedule.day, {
                            open_time: e.target.value,
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
                        value={daySchedule.close_time}
                        onChange={(e) =>
                          updateDaySchedule(daySchedule.day, {
                            close_time: e.target.value,
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
