"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowLeft, User, Volume2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSetup } from "../SetupContext";
import { SelectionCard } from "../SelectionCard";
import {
  PERSONALITY_TEMPLATES,
  VOICE_OPTIONS,
  getRecommendedTemplate,
  getIndustryDefaults,
} from "@/lib/onboarding-defaults";
import type { PersonalityTemplate } from "@/lib/onboarding-defaults";

type Personality = "professional" | "friendly" | "efficient";

const NAME_SUGGESTIONS: Record<Personality, string[]> = {
  professional: ["Sarah", "James", "Madison", "Michael"],
  friendly: ["Emma", "Alex", "Sophie", "Ben"],
  efficient: ["Kate", "Sam", "Anna", "Max"],
};

export function AssistantStep() {
  const router = useRouter();
  const { state, dispatch, saveStep, goToNextStep, goToPreviousStep } =
    useSetup();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [showCustomize, setShowCustomize] = useState(false);

  const { name, voice, personality } = state.assistantData;
  const businessName = state.businessData.name || "your business";
  const industry = state.businessData.industry;

  const recommendedTemplateId = getRecommendedTemplate(industry);

  // Auto-select recommended template on mount if no template is selected
  useEffect(() => {
    if (!selectedTemplateId) {
      const defaults = getIndustryDefaults(industry);
      const template = PERSONALITY_TEMPLATES.find(
        (t) => t.id === defaults.templateId,
      );

      if (template) {
        setSelectedTemplateId(template.id);

        // Only set personality if it hasn't been set yet or matches default
        if (!personality || personality === "professional") {
          dispatch({
            type: "SET_ASSISTANT_DATA",
            payload: { personality: template.personality },
          });
        }
      }
    }
    // Run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canContinue =
    name.trim() !== "" && voice !== "" && personality !== null;

  const handleTemplateSelect = (template: PersonalityTemplate) => {
    setSelectedTemplateId(template.id);
    dispatch({
      type: "SET_ASSISTANT_DATA",
      payload: { personality: template.personality },
    });
    // Close customization when selecting a template
    setShowCustomize(false);
  };

  const handleContinue = async () => {
    if (!canContinue) return;

    setIsSubmitting(true);
    const success = await saveStep("assistant");
    if (success) {
      goToNextStep();
      router.push("/setup/phone");
    }
    setIsSubmitting(false);
  };

  const handleBack = () => {
    goToPreviousStep();
    router.push("/setup/integrations");
  };

  const interpolateGreeting = (greeting: string) => {
    return greeting
      .replace("{business}", businessName)
      .replace("{name}", name || "{name}");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Give your assistant an identity
        </h1>
        <p className="mt-2 text-muted-foreground">
          This is how callers will experience your business
        </p>
      </div>

      {/* Assistant name */}
      <div className="space-y-3">
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
        {personality && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">Suggestions:</span>
            {(NAME_SUGGESTIONS[personality] ?? []).map((suggestion) => (
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
        )}
      </div>

      {/* Template selection */}
      <div className="space-y-4">
        <Label>Personality template</Label>
        <div className="grid gap-4 md:grid-cols-3">
          {PERSONALITY_TEMPLATES.map((template) => {
            const isSelected = selectedTemplateId === template.id;
            const isRecommended = template.id === recommendedTemplateId;

            return (
              <SelectionCard
                key={template.id}
                selected={isSelected}
                onClick={() => handleTemplateSelect(template)}
                title={template.label}
                description={template.tagline}
                badge={isRecommended ? "Recommended" : undefined}
              >
                <p className="mt-2 text-xs text-muted-foreground">
                  Best for: {template.bestFor}
                </p>
                <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm italic text-muted-foreground">
                  &ldquo;{interpolateGreeting(template.greeting)}&rdquo;
                </div>
              </SelectionCard>
            );
          })}
        </div>

        {/* Customize link */}
        <button
          type="button"
          onClick={() => setShowCustomize(!showCustomize)}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              showCustomize && "rotate-180",
            )}
          />
          Customize personality
        </button>

        {/* Expandable raw personality radio buttons */}
        {showCustomize && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              Override the template personality
            </p>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  {
                    id: "professional" as Personality,
                    label: "Professional",
                    description: "Formal and business-like",
                  },
                  {
                    id: "friendly" as Personality,
                    label: "Friendly",
                    description: "Warm and conversational",
                  },
                  {
                    id: "efficient" as Personality,
                    label: "Efficient",
                    description: "Direct and to the point",
                  },
                ] as const
              ).map((p) => {
                const isActive = personality === p.id;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      dispatch({
                        type: "SET_ASSISTANT_DATA",
                        payload: { personality: p.id },
                      });
                      // Clear template selection since user is customizing
                      setSelectedTemplateId(null);
                    }}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-left transition-colors",
                      isActive
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:border-muted-foreground/40",
                    )}
                  >
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Voice selection */}
      <div className="space-y-4">
        <Label className="flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          Voice
        </Label>
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
                        ? "bg-gradient-to-br from-pink-400 to-rose-600"
                        : "bg-gradient-to-br from-blue-400 to-indigo-600",
                    )}
                  >
                    <User className="h-6 w-6 text-white" />
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
