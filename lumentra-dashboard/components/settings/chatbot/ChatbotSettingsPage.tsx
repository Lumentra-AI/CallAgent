"use client";

import { useEffect, useState, useCallback } from "react";
import { useTenant } from "@/context/TenantContext";
import { get, put } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  MessageSquare,
  Loader2,
  Check,
  AlertCircle,
  Paintbrush,
  Settings2,
  BookOpen,
  Code,
} from "lucide-react";

import AppearanceTab from "./AppearanceTab";
import BehaviorTab from "./BehaviorTab";
import KnowledgeBaseTab from "./KnowledgeBaseTab";
import EmbedCodeTab from "./EmbedCodeTab";

import type {
  ChatAppearanceConfig,
  ChatBehaviorConfig,
  ChatbotTab,
  KnowledgeBaseItem,
} from "./types";

const DEFAULT_THEME_COLOR = "#6366f1";

export default function ChatbotSettingsPage() {
  const { currentTenant, refreshCurrentTenant } = useTenant();

  // Loading & save state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingToggle, setIsSavingToggle] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChatbotTab>("appearance");

  // Appearance config
  const [appearance, setAppearance] = useState<ChatAppearanceConfig>({
    chat_widget_enabled: false,
    theme_color: DEFAULT_THEME_COLOR,
    logo_url: "",
    greeting: "",
    position: "bottom-right",
  });

  // Behavior config
  const [behavior, setBehavior] = useState<ChatBehaviorConfig>({
    contact_collection_mode: "soft",
    escalation_triggers: "",
    offline_message: "",
    max_conversation_length: 40,
  });

  // Knowledge base items
  const [kbItems, setKbItems] = useState<KnowledgeBaseItem[]>([]);
  const [kbLoading, setKbLoading] = useState(true);

  // Dirty tracking
  const [isDirty, setIsDirty] = useState(false);

  // -------------------------------------------------------------------------
  // Load tenant data into form state
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!currentTenant) return;

    const chatConfig = currentTenant.chat_config || {};

    setAppearance({
      chat_widget_enabled: currentTenant.chat_widget_enabled || false,
      theme_color:
        ((chatConfig as Record<string, unknown>).theme_color as string) ||
        DEFAULT_THEME_COLOR,
      logo_url:
        ((chatConfig as Record<string, unknown>).logo_url as string) || "",
      greeting:
        ((chatConfig as Record<string, unknown>).greeting as string) || "",
      position:
        ((chatConfig as Record<string, unknown>).position as string) ===
        "bottom-left"
          ? "bottom-left"
          : "bottom-right",
    });

    const cfg = chatConfig as Record<string, unknown>;
    setBehavior({
      contact_collection_mode:
        cfg.contact_collection_mode === "persistent" ? "persistent" : "soft",
      escalation_triggers: Array.isArray(cfg.escalation_triggers)
        ? (cfg.escalation_triggers as string[]).join("\n")
        : (cfg.escalation_triggers as string) || "",
      offline_message: (cfg.offline_message as string) || "",
      max_conversation_length:
        typeof cfg.max_conversation_length === "number"
          ? (cfg.max_conversation_length as number)
          : 40,
    });

    setIsDirty(false);
    setIsLoading(false);
  }, [currentTenant]);

  // -------------------------------------------------------------------------
  // Load knowledge base items
  // -------------------------------------------------------------------------
  const loadKnowledgeBase = useCallback(async () => {
    setKbLoading(true);
    try {
      const data = await get<{ items: KnowledgeBaseItem[] }>(
        "/api/knowledge-base",
      );
      setKbItems(data.items || []);
    } catch {
      // Knowledge base might not exist yet -- that is fine
      setKbItems([]);
    } finally {
      setKbLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentTenant) {
      loadKnowledgeBase();
    }
  }, [currentTenant, loadKnowledgeBase]);

  // -------------------------------------------------------------------------
  // Appearance changes
  // -------------------------------------------------------------------------
  const handleAppearanceChange = useCallback(
    (updates: Partial<ChatAppearanceConfig>) => {
      setAppearance((prev) => ({ ...prev, ...updates }));
      setIsDirty(true);
      setSaveSuccess(false);
      setError(null);
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Toggle enabled (saves immediately)
  // -------------------------------------------------------------------------
  const handleToggleEnabled = useCallback(
    async (enabled: boolean) => {
      if (!currentTenant) return;

      // Optimistically update the local state
      setAppearance((prev) => ({ ...prev, chat_widget_enabled: enabled }));
      setIsSavingToggle(true);
      setError(null);

      try {
        await put(`/api/tenants/${currentTenant.id}`, {
          chat_widget_enabled: enabled,
        });
        await refreshCurrentTenant();
      } catch (err) {
        // Revert on failure
        setAppearance((prev) => ({
          ...prev,
          chat_widget_enabled: !enabled,
        }));
        setError(
          err instanceof Error ? err.message : "Failed to toggle widget",
        );
      } finally {
        setIsSavingToggle(false);
      }
    },
    [currentTenant, refreshCurrentTenant],
  );

  // -------------------------------------------------------------------------
  // Behavior changes
  // -------------------------------------------------------------------------
  const handleBehaviorChange = useCallback(
    (updates: Partial<ChatBehaviorConfig>) => {
      setBehavior((prev) => ({ ...prev, ...updates }));
      setIsDirty(true);
      setSaveSuccess(false);
      setError(null);
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Save all settings (appearance + behavior)
  // -------------------------------------------------------------------------
  const handleSave = useCallback(async () => {
    if (!currentTenant) return;

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      // Build triggers array from newline-separated string
      const triggers = behavior.escalation_triggers
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean);

      await put(`/api/tenants/${currentTenant.id}`, {
        chat_widget_enabled: appearance.chat_widget_enabled,
        chat_config: {
          theme_color: appearance.theme_color,
          logo_url: appearance.logo_url || undefined,
          greeting: appearance.greeting || undefined,
          position: appearance.position,
          contact_collection_mode: behavior.contact_collection_mode,
          escalation_triggers: triggers.length > 0 ? triggers : undefined,
          offline_message: behavior.offline_message || undefined,
          max_conversation_length: behavior.max_conversation_length,
        },
      });

      await refreshCurrentTenant();
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save chat settings",
      );
    } finally {
      setIsSaving(false);
    }
  }, [currentTenant, appearance, behavior, refreshCurrentTenant]);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (isLoading || !currentTenant) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Chat Widget</h2>
            <p className="text-sm text-muted-foreground">
              Configure the embeddable chat widget for your website
            </p>
          </div>
        </div>
      </div>

      {/* Error / Success banners */}
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="mb-4 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-600">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" />
            Chat widget settings saved successfully
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ChatbotTab)}
      >
        <div className="mb-6 flex items-center justify-between">
          <TabsList className="bg-muted">
            <TabsTrigger
              value="appearance"
              className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Paintbrush className="h-3.5 w-3.5" />
              Appearance
            </TabsTrigger>
            <TabsTrigger
              value="behavior"
              className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Behavior
            </TabsTrigger>
            <TabsTrigger
              value="knowledge"
              className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Knowledge Base
            </TabsTrigger>
            <TabsTrigger
              value="embed"
              className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Code className="h-3.5 w-3.5" />
              Embed Code
            </TabsTrigger>
          </TabsList>

          {/* Save button -- visible for appearance & behavior tabs */}
          {(activeTab === "appearance" || activeTab === "behavior") && (
            <Button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              size="sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          )}
        </div>

        <TabsContent value="appearance" className="mt-0">
          <AppearanceTab
            config={appearance}
            onChange={handleAppearanceChange}
            onToggleEnabled={handleToggleEnabled}
            businessName={currentTenant.business_name}
            isSavingToggle={isSavingToggle}
          />
        </TabsContent>

        <TabsContent value="behavior" className="mt-0">
          <BehaviorTab config={behavior} onChange={handleBehaviorChange} />
        </TabsContent>

        <TabsContent value="knowledge" className="mt-0">
          <KnowledgeBaseTab
            items={kbItems}
            isLoading={kbLoading}
            onRefresh={loadKnowledgeBase}
          />
        </TabsContent>

        <TabsContent value="embed" className="mt-0">
          <EmbedCodeTab tenantId={currentTenant.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
