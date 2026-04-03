"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowLeft, User, Volume2, Plus, X, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSetup } from "../SetupContext";
import { VOICE_OPTIONS, getIndustryDefaults } from "@/lib/onboarding-defaults";
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

export function AssistantStep() {
  const router = useRouter();
  const { state, dispatch, saveStep, goToNextStep, goToPreviousStep } =
    useSetup();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { name, voice, greeting } = state.assistantData;
  const businessName = state.businessData.name || "your business";
  const industry = state.businessData.industry;
  const { contacts } = state.escalationData;

  // Set defaults on mount: personality, name, greeting
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

    if (Object.keys(updates).length > 0) {
      dispatch({
        type: "SET_ASSISTANT_DATA",
        payload: updates,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canContinue = name.trim() !== "";

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
      availability: "business_hours",
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

  const handleContinue = async () => {
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

            return (
              <button
                key={voiceOption.id}
                type="button"
                onClick={() =>
                  dispatch({
                    type: "SET_ASSISTANT_DATA",
                    payload: { voice: voiceOption.cartesiaId },
                  })
                }
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40",
                )}
              >
                <div className="flex items-center gap-3">
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
                </div>
              </button>
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
            {contacts.map((contact, idx) => (
              <div key={contact.id} className="rounded-lg border p-4">
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
                      onChange={(e) =>
                        updateContact(contact.id, "name", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`phone-${contact.id}`} className="text-xs">
                      Phone
                    </Label>
                    <Input
                      id={`phone-${contact.id}`}
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={contact.phone}
                      onChange={(e) =>
                        updateContact(contact.id, "phone", e.target.value)
                      }
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
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`role-${contact.id}`} className="text-xs">
                      Role
                    </Label>
                    <Input
                      id={`role-${contact.id}`}
                      placeholder="Front Desk"
                      value={contact.role || ""}
                      onChange={(e) =>
                        updateContact(contact.id, "role", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

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
