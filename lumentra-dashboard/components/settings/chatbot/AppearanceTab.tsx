"use client";

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import WidgetPreview from "./WidgetPreview";
import type { ChatAppearanceConfig, WidgetPosition } from "./types";

interface AppearanceTabProps {
  config: ChatAppearanceConfig;
  onChange: (updates: Partial<ChatAppearanceConfig>) => void;
  onToggleEnabled: (enabled: boolean) => void;
  businessName?: string;
  isSavingToggle: boolean;
}

const POSITION_OPTIONS: { value: WidgetPosition; label: string }[] = [
  { value: "bottom-right", label: "Bottom Right" },
  { value: "bottom-left", label: "Bottom Left" },
];

export default function AppearanceTab({
  config,
  onChange,
  onToggleEnabled,
  businessName,
  isSavingToggle,
}: AppearanceTabProps) {
  const handleColorChange = useCallback(
    (color: string) => {
      onChange({ theme_color: color });
    },
    [onChange],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
      {/* Left column: settings */}
      <div className="space-y-6">
        {/* Enable/disable toggle */}
        <div className="flex items-center justify-between rounded-xl border bg-card p-5">
          <div>
            <h3 className="text-sm font-semibold">Enable Chat Widget</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              When enabled, the widget appears on websites using your embed code
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSavingToggle && (
              <span className="text-xs text-muted-foreground">Saving...</span>
            )}
            <Switch
              checked={config.chat_widget_enabled}
              onCheckedChange={onToggleEnabled}
              disabled={isSavingToggle}
            />
          </div>
        </div>

        {/* Brand color */}
        <div className="rounded-xl border bg-card p-5">
          <Label htmlFor="theme_color" className="text-sm font-semibold">
            Brand Color
          </Label>
          <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
            Used for the widget header, buttons, and accents
          </p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              id="theme_color_picker"
              value={config.theme_color}
              onChange={(e) => handleColorChange(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
            />
            <Input
              id="theme_color"
              value={config.theme_color}
              onChange={(e) => handleColorChange(e.target.value)}
              onBlur={() => {
                // Validate hex on blur and fix if invalid
                const hex = config.theme_color;
                if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
                  onChange({ theme_color: "#6366f1" });
                }
              }}
              placeholder="#6366f1"
              className="w-32 font-mono text-sm"
            />
            <div
              className="h-10 w-10 rounded-lg shadow-sm"
              style={{ backgroundColor: config.theme_color }}
            />
          </div>
        </div>

        {/* Logo URL */}
        <div className="rounded-xl border bg-card p-5">
          <Label htmlFor="logo_url" className="text-sm font-semibold">
            Logo URL
          </Label>
          <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
            Displayed in the widget header. Leave empty to use the default icon.
          </p>
          <Input
            id="logo_url"
            value={config.logo_url}
            onChange={(e) => onChange({ logo_url: e.target.value })}
            placeholder="https://example.com/logo.png"
            className="text-sm"
          />
        </div>

        {/* Greeting message */}
        <div className="rounded-xl border bg-card p-5">
          <Label htmlFor="greeting" className="text-sm font-semibold">
            Greeting Message
          </Label>
          <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
            The first message visitors see when they open the chat
          </p>
          <textarea
            id="greeting"
            value={config.greeting}
            onChange={(e) => onChange({ greeting: e.target.value })}
            placeholder="Hi! How can I help you today?"
            rows={3}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          />
        </div>

        {/* Widget position */}
        <div className="rounded-xl border bg-card p-5">
          <Label className="text-sm font-semibold">Widget Position</Label>
          <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
            Where the chat button appears on the page
          </p>
          <div className="flex gap-3">
            {POSITION_OPTIONS.map((opt) => {
              const isSelected = config.position === opt.value;
              return (
                <label
                  key={opt.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border hover:bg-muted/50 text-muted-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="widget_position"
                    value={opt.value}
                    checked={isSelected}
                    onChange={() => onChange({ position: opt.value })}
                    className="h-3.5 w-3.5"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right column: live preview */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <WidgetPreview
          enabled={config.chat_widget_enabled}
          themeColor={config.theme_color}
          greeting={config.greeting}
          position={config.position}
          logoUrl={config.logo_url || undefined}
          businessName={businessName}
        />
      </div>
    </div>
  );
}
