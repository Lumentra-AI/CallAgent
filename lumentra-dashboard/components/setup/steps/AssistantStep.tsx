"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ArrowLeft,
  User,
  Volume2,
  Plus,
  X,
  Phone,
  Play,
  Loader2,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSetup } from "../SetupContext";
import { VOICE_OPTIONS, getIndustryDefaults } from "@/lib/onboarding-defaults";
import { apiFetchRaw } from "@/lib/api/client";
import type { EscalationContact } from "@/types";

const NAME_SUGGESTIONS = ["Sarah", "Emma", "James", "Alex", "Madison", "Maya"];

/**
 * Normalize a US phone number to E.164 format (+1XXXXXXXXXX).
 */
function normalizePhoneE164(phone: string): string {
  const hasPlus = phone.startsWith("+");
  const digits = phone.replace(/\D/g, "");

  if (hasPlus && digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (hasPlus) return `+${digits}`;
  return phone;
}

/**
 * Check if a phone string is a valid E.164 US number (10 or 11 digits).
 */
function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return (
    digits.length === 10 || (digits.length === 11 && digits.startsWith("1"))
  );
}

type ContactErrors = Record<string, { name?: string; phone?: string }>;

export function AssistantStep() {
  const router = useRouter();
  const { state, dispatch, saveStep, goToNextStep, goToPreviousStep } =
    useSetup();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { name, voice, greeting } = state.assistantData;
  const businessName = state.businessData.name || "your business";
  const industry = state.businessData.industry;
  const { contacts } = state.escalationData;
  const [contactErrors, setContactErrors] = useState<ContactErrors>({});
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  // Set defaults on mount: personality, name, greeting, voice
  useEffect(() => {
    const defaults = getIndustryDefaults(industry);
    const updates: Partial<typeof state.assistantData> = {};

    if (!name) {
      updates.name = defaults.agentName;
    }
    updates.personality = "professional";

    if (!greeting) {
      updates.greeting = `Thank you for calling ${businessName}, how can I help you today?`;
    }

    // Set industry-appropriate voice if voice hasn't been explicitly chosen yet.
    // The default initial voice is Sarah's UUID -- override it with the industry
    // default so hotel gets Madison, restaurant gets Emily, etc.
    const DEFAULT_VOICE = "694f9389-aac1-45b6-b726-9d9369183238";
    if (!voice || voice === DEFAULT_VOICE) {
      const industryVoice = defaults.voiceId;
      if (industryVoice && industryVoice !== DEFAULT_VOICE) {
        updates.voice = industryVoice;
      }
    }

    if (Object.keys(updates).length > 0) {
      dispatch({
        type: "SET_ASSISTANT_DATA",
        payload: updates,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validate contacts: if any exist, every one must have name + valid phone
  const validateContacts = useCallback((): ContactErrors => {
    const errors: ContactErrors = {};
    for (const c of contacts) {
      const e: { name?: string; phone?: string } = {};
      if (!c.name.trim()) e.name = "Name is required";
      if (!c.phone.trim()) e.phone = "Phone is required";
      else if (!isValidPhone(c.phone))
        e.phone = "Enter a valid US phone number";
      if (Object.keys(e).length > 0) errors[c.id] = e;
    }
    return errors;
  }, [contacts]);

  const contactsValid =
    contacts.length === 0 || Object.keys(validateContacts()).length === 0;
  const canContinue = name.trim() !== "" && contactsValid;

  // --- Contact helpers ---
  const addContact = () => {
    if (contacts.length >= 3) return;
    const newContact: EscalationContact = {
      id: `contact_${Date.now()}`,
      tenant_id: state.tenantId || "",
      name: "",
      phone: "",
      role: "",
      is_primary: contacts.length === 0,
      availability: "always",
      sort_order: contacts.length,
      created_at: new Date().toISOString(),
    };
    dispatch({
      type: "SET_ESCALATION_DATA",
      payload: { contacts: [...contacts, newContact] },
    });
  };

  const updateContact = (
    id: string,
    field: keyof EscalationContact,
    value: unknown,
  ) => {
    const updated = contacts.map((c) =>
      c.id === id ? { ...c, [field]: value } : c,
    );
    dispatch({
      type: "SET_ESCALATION_DATA",
      payload: { contacts: updated },
    });
  };

  const removeContact = (id: string) => {
    const updated = contacts.filter((c) => c.id !== id);
    if (updated.length > 0 && !updated.some((c) => c.is_primary)) {
      updated[0].is_primary = true;
    }
    dispatch({
      type: "SET_ESCALATION_DATA",
      payload: { contacts: updated },
    });
  };

  // Voice preview
  const playPreview = useCallback(
    async (voiceId: string) => {
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (playingVoice === voiceId) {
        setPlayingVoice(null);
        return;
      }

      setPreviewLoading(voiceId);
      setPlayingVoice(null);
      try {
        const sampleText =
          greeting?.trim() ||
          `Thank you for calling ${businessName}, how can I help you today?`;
        const res = await apiFetchRaw("/api/voice/preview", {
          method: "POST",
          body: JSON.stringify({ voiceId, sampleText }),
        });
        if (!res.ok) throw new Error("Preview failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setPlayingVoice(null);
          URL.revokeObjectURL(url);
        };
        audio.play();
        setPlayingVoice(voiceId);
      } catch {
        // Silently fail -- preview is non-critical
      } finally {
        setPreviewLoading(null);
      }
    },
    [playingVoice, greeting, businessName],
  );

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleContinue = async () => {
    // Validate contacts before submitting
    if (contacts.length > 0) {
      const errors = validateContacts();
      setContactErrors(errors);
      if (Object.keys(errors).length > 0) return;
    }
    if (!canContinue) return;

    setIsSubmitting(true);
    const success = await saveStep("assistant");
    if (success) {
      goToNextStep();
      router.push("/setup/review");
    }
    setIsSubmitting(false);
  };

  const handleBack = () => {
    goToPreviousStep();
    router.push("/setup/business");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Set up call handling
        </h1>
        <p className="mt-2 text-muted-foreground">
          Configure how your AI assistant answers the phone
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* YOUR AI ASSISTANT */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium">Your AI Assistant</h2>
        <Label htmlFor="assistant-name">Assistant name</Label>
        <Input
          id="assistant-name"
          placeholder="Sarah"
          value={name}
          onChange={(e) =>
            dispatch({
              type: "SET_ASSISTANT_DATA",
              payload: { name: e.target.value },
            })
          }
        />
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Suggestions:</span>
          {NAME_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() =>
                dispatch({
                  type: "SET_ASSISTANT_DATA",
                  payload: { name: suggestion },
                })
              }
              className="rounded-full bg-muted px-3 py-1 text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* VOICE */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          Voice
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VOICE_OPTIONS.map((voiceOption) => {
            const isSelected = voice === voiceOption.cartesiaId;
            const isLoading = previewLoading === voiceOption.cartesiaId;
            const isPlaying = playingVoice === voiceOption.cartesiaId;

            return (
              <div
                key={voiceOption.id}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40",
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "SET_ASSISTANT_DATA",
                      payload: { voice: voiceOption.cartesiaId },
                    })
                  }
                  className="flex w-full items-center gap-3 text-left"
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                      voiceOption.type === "female"
                        ? "bg-pink-500/20"
                        : "bg-blue-500/20",
                    )}
                  >
                    <User className="h-6 w-6 text-foreground/70" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">
                        {voiceOption.name}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                          voiceOption.type === "female"
                            ? "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                        )}
                      >
                        {voiceOption.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {voiceOption.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
                {/* Preview play button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playPreview(voiceOption.cartesiaId);
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isPlaying ? (
                    <Square className="h-3 w-3" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  {isLoading ? "Loading..." : isPlaying ? "Stop" : "Preview"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* WHAT CALLERS HEAR FIRST */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium">What callers hear first</h2>
        <p className="text-sm text-muted-foreground">
          The greeting your assistant says when answering the phone
        </p>
        <textarea
          value={greeting}
          onChange={(e) =>
            dispatch({
              type: "SET_ASSISTANT_DATA",
              payload: { greeting: e.target.value },
            })
          }
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={`Thank you for calling ${businessName}, how can I help you today?`}
        />
        <p className="text-xs text-muted-foreground">
          Keep it short and friendly. The assistant will use this exact phrase
          to greet every caller.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* WHO TO TRANSFER TO (optional) */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Who to transfer to</h2>
          <p className="text-sm text-muted-foreground">
            Add people your assistant can transfer calls to when a human is
            needed (optional, up to 3)
          </p>
        </div>

        {contacts.length === 0 ? (
          <button
            type="button"
            onClick={addContact}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-5 w-5" />
            <span className="font-medium">Add a contact</span>
          </button>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact, idx) => {
              const errors = contactErrors[contact.id];
              return (
                <div
                  key={contact.id}
                  className={cn(
                    "rounded-lg border p-4",
                    errors ? "border-red-300 dark:border-red-800" : "",
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                        <Phone className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-medium">
                        Contact {idx + 1}
                      </span>
                      {contact.is_primary && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Primary
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeContact(contact.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor={`name-${contact.id}`} className="text-xs">
                        Name
                      </Label>
                      <Input
                        id={`name-${contact.id}`}
                        placeholder="John Smith"
                        value={contact.name}
                        onChange={(e) => {
                          updateContact(contact.id, "name", e.target.value);
                          if (contactErrors[contact.id]?.name) {
                            setContactErrors((prev) => {
                              const next = { ...prev };
                              if (next[contact.id]) {
                                delete next[contact.id].name;
                                if (Object.keys(next[contact.id]).length === 0)
                                  delete next[contact.id];
                              }
                              return next;
                            });
                          }
                        }}
                        className={cn(errors?.name && "border-red-400")}
                      />
                      {errors?.name && (
                        <p className="text-[11px] text-red-500">
                          {errors.name}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor={`phone-${contact.id}`}
                        className="text-xs"
                      >
                        Phone
                      </Label>
                      <Input
                        id={`phone-${contact.id}`}
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={contact.phone}
                        onChange={(e) => {
                          updateContact(contact.id, "phone", e.target.value);
                          if (contactErrors[contact.id]?.phone) {
                            setContactErrors((prev) => {
                              const next = { ...prev };
                              if (next[contact.id]) {
                                delete next[contact.id].phone;
                                if (Object.keys(next[contact.id]).length === 0)
                                  delete next[contact.id];
                              }
                              return next;
                            });
                          }
                        }}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val) {
                            updateContact(
                              contact.id,
                              "phone",
                              normalizePhoneE164(val),
                            );
                          }
                        }}
                        className={cn(errors?.phone && "border-red-400")}
                      />
                      {errors?.phone && (
                        <p className="text-[11px] text-red-500">
                          {errors.phone}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`role-${contact.id}`} className="text-xs">
                        Department or role
                      </Label>
                      <Input
                        id={`role-${contact.id}`}
                        placeholder="Front Desk"
                        value={contact.role || ""}
                        onChange={(e) =>
                          updateContact(contact.id, "role", e.target.value)
                        }
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Helps route &quot;transfer to front desk&quot; requests
                      </p>
                    </div>
                  </div>

                  {/* Availability selector */}
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      Available:
                    </span>
                    <div className="flex gap-2">
                      {(
                        [
                          { value: "always", label: "Anytime" },
                          {
                            value: "business_hours",
                            label: "Business hours",
                          },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            updateContact(contact.id, "availability", opt.value)
                          }
                          className={cn(
                            "rounded-full px-3 py-1 text-xs transition-colors",
                            contact.availability === opt.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {contacts.length < 3 && (
              <Button variant="outline" size="sm" onClick={addContact}>
                <Plus className="mr-1 h-4 w-4" />
                Add another contact
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!canContinue || isSubmitting}
          size="lg"
        >
          {isSubmitting ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
