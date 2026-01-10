"use client";

import React, { useState, useCallback } from "react";
import { useConfig } from "@/context/ConfigContext";
import {
  INDUSTRY_PRESETS,
  INDUSTRY_CATEGORIES,
  createDefaultConfig,
  getPopularIndustries,
} from "@/lib/industryPresets";
import type { IndustryType, IndustryCategory, IndustryPreset } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Stethoscope,
  Wrench,
  Car,
  Briefcase,
  Scissors,
  Home,
  ArrowRight,
  ArrowLeft,
  Check,
  Zap,
  ChevronDown,
  UtensilsCrossed,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface WizardStep {
  id: number;
  title: string;
  description: string;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    title: "Select Industry",
    description: "Configure specialized AI models for your business",
  },
  {
    id: 2,
    title: "Business Identity",
    description: "Give your digital assistant a local identity",
  },
  {
    id: 3,
    title: "Launch",
    description: "Review your settings and activate the dashboard",
  },
];

// Icon mapping for industries
const INDUSTRY_ICON_MAP: Record<string, React.ElementType> = {
  // Hospitality
  hotel: Building2,
  motel: Building2,
  vacation_rental: Home,
  restaurant: UtensilsCrossed,
  catering: UtensilsCrossed,
  // Healthcare
  medical: Stethoscope,
  dental: Stethoscope,
  veterinary: Stethoscope,
  mental_health: Stethoscope,
  chiropractic: Stethoscope,
  // Automotive
  auto_dealer: Car,
  auto_service: Car,
  car_rental: Car,
  towing: Car,
  // Professional
  legal: Scale,
  accounting: Briefcase,
  insurance: Briefcase,
  consulting: Briefcase,
  // Personal Care
  salon: Scissors,
  spa: Scissors,
  barbershop: Scissors,
  fitness: Scissors,
  // Property
  real_estate: Home,
  property_management: Home,
  home_services: Wrench,
  hvac: Wrench,
  plumbing: Wrench,
  electrical: Wrench,
  cleaning: Wrench,
};

const CATEGORY_ICONS: Record<IndustryCategory, React.ElementType> = {
  hospitality: Building2,
  healthcare: Stethoscope,
  automotive: Car,
  professional: Briefcase,
  personal_care: Scissors,
  property: Home,
};

// ============================================================================
// SETUP WIZARD COMPONENT
// ============================================================================

export default function SetupWizard() {
  const { saveConfig } = useConfig();
  const [step, setStep] = useState(1);
  const [isLaunching, setIsLaunching] = useState(false);
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<IndustryCategory | null>(null);

  // Form State
  const [industry, setIndustry] = useState<IndustryType | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [agentName, setAgentName] = useState("");

  // Get popular industries
  const popularIndustries = getPopularIndustries();

  // Handlers
  const handleNext = useCallback(() => {
    if (step < 3) setStep(step + 1);
  }, [step]);

  const handleBack = useCallback(() => {
    if (step > 1) setStep(step - 1);
  }, [step]);

  const handleLaunch = useCallback(() => {
    if (!industry || !businessName) return;

    setIsLaunching(true);

    // Create config from preset
    const config = createDefaultConfig(industry);

    // Small delay for animation
    setTimeout(() => {
      saveConfig({
        ...config,
        industry,
        businessName,
        agentName: agentName || "Lumentra",
        isConfigured: true,
      });
    }, 1500);
  }, [industry, businessName, agentName, saveConfig]);

  const canProceed = useCallback(() => {
    switch (step) {
      case 1:
        return industry !== null;
      case 2:
        return businessName.trim().length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  }, [step, industry, businessName]);

  const getIndustryIcon = (industryId: string) => {
    return INDUSTRY_ICON_MAP[industryId] || Building2;
  };

  const currentStep = WIZARD_STEPS[step - 1];

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      {/* Background Pattern */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.15) 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Main Card */}
      <Card className="relative w-full max-w-4xl border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        {/* Progress Bar */}
        <div className="absolute left-0 right-0 top-0 h-1 overflow-hidden rounded-t-lg bg-zinc-800">
          <div
            className="h-full bg-indigo-500 transition-all duration-500 ease-out"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <CardHeader className="pt-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Zap className="h-5 w-5 text-indigo-500" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Lumentra Core
            </span>
          </div>
          <CardTitle className="text-2xl font-semibold text-white">
            {currentStep.title}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {currentStep.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-6">
          {/* Step 1: Industry Selection */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Popular Industries */}
              {!showAllIndustries && (
                <>
                  <div className="text-center">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Popular Industries
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {popularIndustries.map((preset) => {
                      const Icon = getIndustryIcon(preset.id);
                      const isSelected = industry === preset.id;

                      return (
                        <IndustryCard
                          key={preset.id}
                          preset={preset}
                          Icon={Icon}
                          isSelected={isSelected}
                          onClick={() => setIndustry(preset.id)}
                        />
                      );
                    })}
                  </div>

                  <div className="text-center">
                    <Button
                      variant="ghost"
                      onClick={() => setShowAllIndustries(true)}
                      className="text-zinc-400 hover:text-white"
                    >
                      Show all industries
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}

              {/* All Industries by Category */}
              {showAllIndustries && (
                <>
                  <div className="text-center">
                    <Button
                      variant="ghost"
                      onClick={() => setShowAllIndustries(false)}
                      className="text-zinc-400 hover:text-white"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to popular
                    </Button>
                  </div>

                  {/* Category Tabs */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {(
                      Object.keys(INDUSTRY_CATEGORIES) as IndustryCategory[]
                    ).map((cat) => {
                      const CatIcon = CATEGORY_ICONS[cat];
                      return (
                        <button
                          key={cat}
                          onClick={() =>
                            setSelectedCategory(
                              selectedCategory === cat ? null : cat,
                            )
                          }
                          className={cn(
                            "flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all",
                            selectedCategory === cat
                              ? "bg-indigo-500/20 text-indigo-400"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white",
                          )}
                        >
                          <CatIcon className="h-4 w-4" />
                          {INDUSTRY_CATEGORIES[cat].label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Industries Grid */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Object.values(INDUSTRY_PRESETS)
                      .filter(
                        (preset) =>
                          !selectedCategory ||
                          preset.category === selectedCategory,
                      )
                      .map((preset) => {
                        const Icon = getIndustryIcon(preset.id);
                        const isSelected = industry === preset.id;

                        return (
                          <button
                            key={preset.id}
                            onClick={() => setIndustry(preset.id)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                              isSelected
                                ? "border-indigo-500 bg-indigo-500/10"
                                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700",
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-5 w-5 shrink-0",
                                isSelected
                                  ? "text-indigo-400"
                                  : "text-zinc-500",
                              )}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">
                                {preset.label}
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="ml-auto h-4 w-4 shrink-0 text-indigo-500" />
                            )}
                          </button>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: Business Identity */}
          {step === 2 && (
            <div className="mx-auto max-w-md space-y-6">
              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-sm text-zinc-400">
                  Business Name
                </Label>
                <Input
                  id="businessName"
                  placeholder="e.g. Grand Plaza Hotel"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="border-zinc-800 bg-zinc-950 text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-indigo-500/20"
                  autoFocus
                />
                <p className="text-xs text-zinc-600">
                  This will appear in confirmations and caller interactions
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agentName" className="text-sm text-zinc-400">
                  AI Agent Name{" "}
                  <span className="text-zinc-600">(Optional)</span>
                </Label>
                <Input
                  id="agentName"
                  placeholder="e.g. Jessica, Alex, Sam"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="border-zinc-800 bg-zinc-950 text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-indigo-500/20"
                />
                <p className="text-xs text-zinc-600">
                  The name your AI will use to introduce itself. Default:
                  &ldquo;Lumentra&rdquo;
                </p>
              </div>

              {/* Industry summary */}
              {industry && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-center gap-3">
                    {React.createElement(getIndustryIcon(industry), {
                      className: "h-5 w-5 text-indigo-500",
                    })}
                    <div>
                      <p className="text-sm font-medium text-white">
                        {INDUSTRY_PRESETS[industry].label} Configuration
                      </p>
                      <p className="text-xs text-zinc-500">
                        {
                          INDUSTRY_PRESETS[industry].terminology
                            .transactionPlural
                        }{" "}
                        &bull;{" "}
                        {INDUSTRY_PRESETS[industry].terminology.customerPlural}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Launch */}
          {step === 3 && industry && (
            <div className="mx-auto max-w-md">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center">
                {isLaunching ? (
                  <div className="space-y-4 py-4">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
                    <p className="text-sm text-zinc-400">
                      Initializing your command center...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10">
                      <Zap className="h-7 w-7 text-indigo-500" />
                    </div>

                    <h3 className="mb-1 text-xl font-semibold text-white">
                      {businessName || "Your Business"}
                    </h3>

                    <p className="mb-4 text-xs font-medium uppercase tracking-wider text-indigo-500">
                      {INDUSTRY_PRESETS[industry].label} Edition
                    </p>

                    <p className="text-sm leading-relaxed text-zinc-400">
                      Your AI agent{" "}
                      <span className="font-medium text-white">
                        &ldquo;{agentName || "Lumentra"}&rdquo;
                      </span>{" "}
                      is configured and ready to handle live calls.
                    </p>

                    {/* Config Summary */}
                    <div className="mt-6 space-y-2 border-t border-zinc-800 pt-4 text-left">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Base Rate</span>
                        <span className="font-mono text-zinc-300">
                          ${INDUSTRY_PRESETS[industry].defaultPricing.baseRate}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">24/7 Coverage</span>
                        <span className="text-green-500">Enabled</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">SMS Confirmations</span>
                        <span className="text-green-500">Enabled</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between border-t border-zinc-800 px-8 py-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={step === 1 || isLaunching}
            className="text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {step < 3 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-30"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleLaunch}
              disabled={isLaunching}
              className="bg-indigo-600 px-8 text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {isLaunching ? "Launching..." : "Launch Dashboard"}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Step Indicators */}
      <div className="absolute bottom-8 flex gap-2">
        {WIZARD_STEPS.map((s) => (
          <div
            key={s.id}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              step === s.id
                ? "w-8 bg-indigo-500"
                : step > s.id
                  ? "w-2 bg-indigo-500/50"
                  : "w-2 bg-zinc-700",
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// INDUSTRY CARD COMPONENT
// ============================================================================

function IndustryCard({
  preset,
  Icon,
  isSelected,
  onClick,
}: {
  preset: IndustryPreset;
  Icon: React.ElementType;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative rounded-lg border p-5 text-left transition-all duration-200",
        isSelected
          ? "border-indigo-500 bg-indigo-500/10"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/50",
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      <div
        className={cn(
          "mb-3 flex h-10 w-10 items-center justify-center rounded-lg border",
          isSelected
            ? "border-indigo-500/30 bg-indigo-500/20"
            : "border-zinc-700 bg-zinc-800 group-hover:border-zinc-600",
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5",
            isSelected
              ? "text-indigo-400"
              : "text-zinc-400 group-hover:text-zinc-300",
          )}
        />
      </div>

      <h3 className="mb-1 font-medium text-white">{preset.label}</h3>
      <p className="text-xs leading-relaxed text-zinc-500">
        {preset.description}
      </p>

      {/* SOW-aligned pricing hint */}
      <div className="mt-3 border-t border-zinc-800 pt-3">
        <span className="font-mono text-xs text-zinc-600">
          Base: ${preset.defaultPricing.baseRate}
        </span>
      </div>
    </button>
  );
}
