"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/context/TenantContext";
import { put } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

// Aceternity & MagicUI
import { TextGenerateEffect } from "@/components/aceternity/text-generate-effect";
import { SpotlightNew } from "@/components/aceternity/spotlight";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { ShineBorder } from "@/components/magicui/shine-border";

const POSITION_OPTIONS = [
  { value: "bottom-right", label: "Bottom Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "top-right", label: "Top Right" },
  { value: "top-left", label: "Top Left" },
];

const DEFAULT_THEME_COLOR = "#6366f1";

interface FormData {
  chat_widget_enabled: boolean;
  theme_color: string;
  greeting: string;
  position: string;
  allowed_origins: string;
}

export default function ChatbotSettingsPage() {
  const { currentTenant, refreshTenants } = useTenant();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    chat_widget_enabled: false,
    theme_color: DEFAULT_THEME_COLOR,
    greeting: "",
    position: "bottom-right",
    allowed_origins: "",
  });

  useEffect(() => {
    if (currentTenant) {
      const chatConfig = currentTenant.chat_config || {};
      setFormData({
        chat_widget_enabled: currentTenant.chat_widget_enabled || false,
        theme_color: chatConfig.theme_color || DEFAULT_THEME_COLOR,
        greeting: chatConfig.greeting || "",
        position: chatConfig.position || "bottom-right",
        allowed_origins: (chatConfig.allowed_origins || []).join(", "),
      });
      setIsLoading(false);
    }
  }, [currentTenant]);

  const handleSave = async () => {
    if (!currentTenant) return;

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const origins = formData.allowed_origins
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

      await put(`/api/tenants/${currentTenant.id}`, {
        chat_widget_enabled: formData.chat_widget_enabled,
        chat_config: {
          theme_color: formData.theme_color,
          greeting: formData.greeting || undefined,
          position: formData.position,
          allowed_origins: origins.length > 0 ? origins : undefined,
        },
      });
      await refreshTenants();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save chat settings",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const embedCode = currentTenant
    ? `<script src="https://app.lumentra.ai/widget/lumentra-chat.js"></script>\n<script>\n  new LumentraChat({ tenantId: '${currentTenant.id}' });\n</script>`
    : "";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <SpotlightNew />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/settings"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <TextGenerateEffect
                words="Chat Widget"
                className="text-2xl font-bold"
              />
              <p className="text-sm text-muted-foreground">
                Configure the embeddable chat widget for your website
              </p>
            </div>
          </div>
        </div>

        {/* Error / Success messages */}
        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          </div>
        )}

        {saveSuccess && (
          <div className="mb-6 rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-sm text-green-600">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Chat widget settings saved successfully
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Enable/Disable */}
          <ShineBorder
            className="w-full rounded-xl border bg-card p-6"
            borderRadius={12}
            color={formData.chat_widget_enabled ? "#22c55e" : "#71717a"}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Enable Chat Widget</h3>
                <p className="text-sm text-muted-foreground">
                  When enabled, the chat widget will appear on websites using
                  your embed code
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.chat_widget_enabled}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    chat_widget_enabled: !prev.chat_widget_enabled,
                  }))
                }
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                  formData.chat_widget_enabled
                    ? "bg-green-500"
                    : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200",
                    formData.chat_widget_enabled
                      ? "translate-x-5"
                      : "translate-x-0",
                  )}
                />
              </button>
            </div>
          </ShineBorder>

          {/* Appearance */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">Appearance</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="theme_color">Theme Color</Label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <input
                      type="color"
                      id="theme_color"
                      value={formData.theme_color}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          theme_color: e.target.value,
                        }))
                      }
                      className="h-10 w-10 cursor-pointer rounded border border-border bg-transparent"
                    />
                    <Input
                      value={formData.theme_color}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          theme_color: e.target.value,
                        }))
                      }
                      placeholder="#6366f1"
                      className="font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="position">Widget Position</Label>
                  <select
                    id="position"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        position: e.target.value,
                      }))
                    }
                    className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {POSITION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview */}
              <div className="mt-4 rounded-lg border border-border/50 bg-zinc-900 p-4">
                <p className="mb-2 text-xs text-muted-foreground">Preview</p>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md"
                    style={{ backgroundColor: formData.theme_color }}
                  >
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div className="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100">
                    {formData.greeting ||
                      currentTenant?.greeting_standard ||
                      "Hi! How can I help you today?"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Greeting */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">Chat Greeting</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              The first message visitors see when they open the chat. Leave
              empty to use your default voice greeting.
            </p>
            <Textarea
              value={formData.greeting}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  greeting: e.target.value,
                }))
              }
              placeholder={
                currentTenant?.greeting_standard ||
                "Hi! How can I help you today?"
              }
              rows={3}
            />
          </div>

          {/* Embed Code */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">Embed Code</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Add this code to your website, just before the closing{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                &lt;/body&gt;
              </code>{" "}
              tag.
            </p>
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg border bg-zinc-900 p-4 text-sm text-zinc-300">
                <code>{embedCode}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(embedCode)}
                className="absolute right-2 top-2"
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Allowed Origins */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">Allowed Origins</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Restrict which domains can use your chat widget. Leave empty to
              allow all domains (recommended for most setups).
            </p>
            <Input
              value={formData.allowed_origins}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  allowed_origins: e.target.value,
                }))
              }
              placeholder="https://example.com, https://www.example.com"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Comma-separated list of allowed origins (e.g.
              https://yourdomain.com)
            </p>
          </div>

          {/* Save */}
          <div className="flex justify-end pt-2 pb-8">
            <ShimmerButton
              onClick={handleSave}
              disabled={isSaving}
              shimmerColor="#ffffff"
              shimmerSize="0.05em"
              shimmerDuration="2s"
              className="px-8 py-2.5"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </ShimmerButton>
          </div>
        </div>
      </div>
    </div>
  );
}
