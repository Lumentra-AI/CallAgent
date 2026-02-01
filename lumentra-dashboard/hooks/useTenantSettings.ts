"use client";

import { useState, useCallback } from "react";
import { useTenant } from "@/context/TenantContext";
import { put } from "@/lib/api/client";

/**
 * Database tenant settings structure
 * These are the fields that can be updated via PUT /api/tenants/:id
 */
export interface TenantSettings {
  // Basic info
  business_name?: string;
  industry?: string;
  timezone?: string;

  // Agent settings
  agent_name?: string;
  agent_personality?: {
    tone: "professional" | "friendly" | "casual" | "formal";
    verbosity: "concise" | "balanced" | "detailed";
    empathy: "low" | "medium" | "high";
    humor: boolean;
  };

  // Voice settings
  voice_config?: {
    provider: "openai" | "elevenlabs" | "cartesia";
    voice_id: string;
    voice_name: string;
    speaking_rate: number;
    pitch: number;
  };

  // Greetings
  greeting_standard?: string;
  greeting_after_hours?: string;
  greeting_returning?: string | null;

  // Operating hours
  operating_hours?: {
    schedule: Array<{
      day: number;
      enabled: boolean;
      open_time: string;
      close_time: string;
    }>;
    holidays: Array<{
      date: string;
      name: string;
    }>;
  };

  // Escalation
  escalation_enabled?: boolean;
  escalation_phone?: string | null;
  escalation_triggers?: string[];

  // Features
  features?: {
    sms_confirmations: boolean;
    email_notifications: boolean;
    live_transfer: boolean;
    voicemail_fallback: boolean;
    sentiment_analysis: boolean;
    recording_enabled: boolean;
    transcription_enabled: boolean;
  };

  // Custom instructions (for AI prompt)
  custom_instructions?: string | null;

  // Questionnaire answers (for generating custom instructions)
  questionnaire_answers?: Record<string, unknown> | null;
}

interface UseTenantSettingsReturn {
  /** Update tenant settings - persists to database */
  updateSettings: (updates: Partial<TenantSettings>) => Promise<void>;
  /** Whether a save is in progress */
  isSaving: boolean;
  /** Last save error, if any */
  error: string | null;
  /** Clear the error state */
  clearError: () => void;
  /** Current tenant ID */
  tenantId: string | null;
}

/**
 * Hook for updating tenant settings with API persistence
 *
 * Usage:
 * ```tsx
 * const { updateSettings, isSaving, error } = useTenantSettings();
 *
 * // Update agent name
 * await updateSettings({ agent_name: "New Name" });
 *
 * // Update voice config
 * await updateSettings({
 *   voice_config: { provider: "cartesia", voice_id: "xxx", ... }
 * });
 * ```
 */
export function useTenantSettings(): UseTenantSettingsReturn {
  const { currentTenant, refreshTenants } = useTenant();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSettings = useCallback(
    async (updates: Partial<TenantSettings>) => {
      if (!currentTenant?.id) {
        setError("No tenant selected");
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        await put(`/api/tenants/${currentTenant.id}`, updates);

        // Refresh tenant data to get updated values
        await refreshTenants();

        console.log("[useTenantSettings] Settings saved successfully");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to save settings";
        setError(message);
        console.error("[useTenantSettings] Failed to save:", err);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [currentTenant?.id, refreshTenants],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    updateSettings,
    isSaving,
    error,
    clearError,
    tenantId: currentTenant?.id ?? null,
  };
}

/**
 * Helper to convert frontend config format to database format
 */
export function mapConfigToTenantSettings(config: {
  agentName?: string;
  agentPersonality?: {
    tone: string;
    verbosity: string;
    empathy: string;
    humor: boolean;
  };
  agentVoice?: {
    provider: string;
    voiceId: string;
    voiceName: string;
    speakingRate: number;
    pitch: number;
  };
}): Partial<TenantSettings> {
  const settings: Partial<TenantSettings> = {};

  if (config.agentName !== undefined) {
    settings.agent_name = config.agentName;
  }

  if (config.agentPersonality) {
    settings.agent_personality = {
      tone: config.agentPersonality.tone as TenantSettings["agent_personality"] extends { tone: infer T } ? T : never,
      verbosity: config.agentPersonality.verbosity as TenantSettings["agent_personality"] extends { verbosity: infer V } ? V : never,
      empathy: config.agentPersonality.empathy as TenantSettings["agent_personality"] extends { empathy: infer E } ? E : never,
      humor: config.agentPersonality.humor,
    };
  }

  if (config.agentVoice) {
    settings.voice_config = {
      provider: config.agentVoice.provider as TenantSettings["voice_config"] extends { provider: infer P } ? P : never,
      voice_id: config.agentVoice.voiceId,
      voice_name: config.agentVoice.voiceName,
      speaking_rate: config.agentVoice.speakingRate,
      pitch: config.agentVoice.pitch,
    };
  }

  return settings;
}
