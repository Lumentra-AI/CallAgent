"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSetup } from "../SetupContext";
import { INDUSTRY_PRESETS } from "@/lib/industryPresets";
import type { IndustryType } from "@/types";

// Aceternity & MagicUI components
import { WobbleCard } from "@/components/aceternity/wobble-card";
import { TextGenerateEffect } from "@/components/aceternity/text-generate-effect";
import { SpotlightNew } from "@/components/aceternity/spotlight";
import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/magicui/shine-border";

export function BusinessStep() {
  const router = useRouter();
  const { state, dispatch, saveStep, goToNextStep } = useSetup();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const industries = Object.values(INDUSTRY_PRESETS);

  const canContinue =
    state.businessData.name.trim() !== "" &&
    state.businessData.industry !== null &&
    state.businessData.city.trim() !== "";

  const handleContinue = async () => {
    if (!canContinue) return;

    setIsSubmitting(true);
    const success = await saveStep("business");
    if (success) {
      goToNextStep();
      router.push("/setup/capabilities");
    }
    setIsSubmitting(false);
  };

  const handleSelectIndustry = (industry: IndustryType) => {
    dispatch({
      type: "SET_BUSINESS_DATA",
      payload: { industry },
    });
  };

  // Industry colors for wobble cards
  const industryColors: Record<string, string> = {
    healthcare: "bg-emerald-800",
    hospitality: "bg-amber-800",
    personal_care: "bg-violet-800",
    automotive: "bg-red-800",
  };

  return (
    <div className="relative space-y-8">
      {/* Subtle spotlight background */}
      <SpotlightNew className="opacity-30" />

      {/* Header with text generation effect */}
      <div className="relative z-10">
        <TextGenerateEffect
          words="Let's get to know your business"
          className="text-2xl md:text-3xl text-foreground"
          duration={0.3}
        />
        <p className="mt-2 text-muted-foreground">
          This helps us customize your AI assistant for your specific needs
        </p>
      </div>

      {/* Business name with shine border when focused */}
      <div className="relative z-10 space-y-2">
        <Label htmlFor="business-name">Business Name</Label>
        <ShineBorder
          borderRadius={8}
          borderWidth={1}
          duration={10}
          color={state.businessData.name ? "#6366f1" : "#64748b"}
          className="w-full min-w-full bg-background p-0"
        >
          <Input
            id="business-name"
            placeholder="Sunrise Dental"
            value={state.businessData.name}
            onChange={(e) =>
              dispatch({
                type: "SET_BUSINESS_DATA",
                payload: { name: e.target.value },
              })
            }
            className="border-0 bg-transparent focus-visible:ring-0"
          />
        </ShineBorder>
      </div>

      {/* Industry selection */}
      <div className="relative z-10 space-y-4">
        <Label>What type of business do you run?</Label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((industry) => {
            const isSelected = state.businessData.industry === industry.id;
            const colorClass =
              industryColors[industry.category] || "bg-indigo-800";

            return (
              <div key={industry.id} className="relative">
                {isSelected && (
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary via-primary/50 to-primary opacity-75 blur-sm" />
                )}
                <WobbleCard
                  containerClassName={cn(
                    "min-h-[120px] cursor-pointer relative",
                    isSelected ? "bg-primary" : colorClass,
                  )}
                  className="p-4"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectIndustry(industry.id)}
                    className="flex h-full w-full flex-col items-start text-left"
                  >
                    {isSelected && (
                      <div className="absolute right-3 top-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                          <Check className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    )}
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-white">
                      {industry.label}
                    </h3>
                    <p className="mt-1 text-sm text-white/70">
                      {industry.description}
                    </p>
                  </button>
                </WobbleCard>
              </div>
            );
          })}
        </div>
      </div>

      {/* Location */}
      <div className="relative z-10 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="city">City / Region</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="city"
              placeholder="Austin, TX"
              value={state.businessData.city}
              onChange={(e) =>
                dispatch({
                  type: "SET_BUSINESS_DATA",
                  payload: { city: e.target.value },
                })
              }
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">
            Full Address{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="address"
            placeholder="123 Main St, Austin, TX 78701"
            value={state.businessData.address}
            onChange={(e) =>
              dispatch({
                type: "SET_BUSINESS_DATA",
                payload: { address: e.target.value },
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            Used to give directions to callers
          </p>
        </div>
      </div>

      <div className="relative z-10 flex justify-end pt-4">
        <Button
          onClick={handleContinue}
          disabled={!canContinue || isSubmitting}
          size="lg"
          className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-black shadow-sm transition-all hover:bg-white/90 active:scale-[0.98]"
        >
          {isSubmitting ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
