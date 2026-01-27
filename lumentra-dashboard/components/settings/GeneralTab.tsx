"use client";

import React, { useState } from "react";
import { useConfig } from "@/context/ConfigContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Building2,
  Stethoscope,
  Wrench,
  Check,
  Car,
  Briefcase,
  Scissors,
  Home,
  ChevronDown,
  UtensilsCrossed,
  Scale,
  Palette,
} from "lucide-react";
import type { IndustryType, ThemeColor, IndustryCategory } from "@/types";
import {
  INDUSTRY_CATEGORIES,
  getPopularIndustries,
} from "@/lib/industryPresets";
import { cn } from "@/lib/utils";

// ============================================================================
// INDUSTRY ICONS
// ============================================================================

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

const THEME_COLORS: { value: ThemeColor; label: string; class: string }[] = [
  { value: "zinc", label: "Zinc", class: "bg-zinc-500" },
  { value: "indigo", label: "Indigo", class: "bg-indigo-500" },
  { value: "emerald", label: "Emerald", class: "bg-emerald-500" },
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "violet", label: "Violet", class: "bg-violet-500" },
  { value: "amber", label: "Amber", class: "bg-amber-500" },
  { value: "rose", label: "Rose", class: "bg-rose-500" },
];

// ============================================================================
// GENERAL TAB COMPONENT
// ============================================================================

export default function GeneralTab() {
  const {
    config,
    updateConfig,
    switchIndustry,
    industryPresets,
    hasPermission,
  } = useConfig();
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<IndustryCategory | null>(null);

  if (!config) return null;

  const canSwitchIndustry = hasPermission("switch_industry");
  const popularIndustries = getPopularIndustries();

  const getIndustryIcon = (industryId: string) => {
    return INDUSTRY_ICON_MAP[industryId] || Building2;
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          General Settings
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure your business identity and agent personality
        </p>
      </div>

      {/* Business Identity */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Building2 className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium text-foreground">
            Business Identity
          </h4>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Business Name</Label>
            <Input
              value={config.businessName}
              onChange={(e) => updateConfig("businessName", e.target.value)}
              placeholder="Your business name"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Agent Name</Label>
            <Input
              value={config.agentName}
              onChange={(e) => updateConfig("agentName", e.target.value)}
              placeholder="e.g., Jessica"
            />
            <p className="text-xs text-muted-foreground">
              The name your AI agent will use when greeting callers
            </p>
          </div>
        </div>
      </section>

      {/* Industry Selection */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium text-foreground">Industry</h4>
          </div>
          {canSwitchIndustry && (
            <p className="text-xs text-muted-foreground">
              Changing industry will reset pricing to defaults
            </p>
          )}
        </div>

        {/* Current Industry Display */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            {React.createElement(getIndustryIcon(config.industry), {
              className: "h-6 w-6 text-primary",
            })}
            <div className="flex-1">
              <div className="font-medium text-foreground">
                {industryPresets[config.industry]?.label || config.industry}
              </div>
              <div className="text-sm text-muted-foreground">
                {
                  industryPresets[config.industry]?.terminology
                    .transactionPlural
                }
              </div>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Current
            </span>
          </div>
        </div>

        {canSwitchIndustry && (
          <>
            {/* Popular Industries */}
            {!showAllIndustries && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  {popularIndustries.slice(0, 6).map((preset) => {
                    const Icon = getIndustryIcon(preset.id);
                    const isSelected = config.industry === preset.id;

                    return (
                      <button
                        key={preset.id}
                        onClick={() => switchIndustry(preset.id)}
                        className={cn(
                          "relative rounded-xl border p-4 text-left transition-all",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border bg-background hover:border-primary/50 hover:bg-muted/50",
                        )}
                      >
                        {isSelected && (
                          <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                        <Icon
                          className={cn(
                            "mb-2 h-5 w-5",
                            isSelected
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        />
                        <div className="text-sm font-medium text-foreground">
                          {preset.label}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setShowAllIndustries(true)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Show all industries
                  <ChevronDown className="h-4 w-4" />
                </button>
              </>
            )}

            {/* All Industries */}
            {showAllIndustries && (
              <>
                <button
                  onClick={() => setShowAllIndustries(false)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Back to popular
                </button>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(INDUSTRY_CATEGORIES) as IndustryCategory[]).map(
                    (cat) => {
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
                            "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-all",
                            selectedCategory === cat
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground hover:bg-muted/80",
                          )}
                        >
                          <CatIcon className="h-3 w-3" />
                          {INDUSTRY_CATEGORIES[cat].label}
                        </button>
                      );
                    },
                  )}
                </div>

                {/* Grid */}
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {Object.values(industryPresets)
                    .filter(
                      (preset) =>
                        !selectedCategory ||
                        preset.category === selectedCategory,
                    )
                    .map((preset) => {
                      const Icon = getIndustryIcon(preset.id);
                      const isSelected = config.industry === preset.id;

                      return (
                        <button
                          key={preset.id}
                          onClick={() => switchIndustry(preset.id)}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border p-3 text-left transition-all",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:border-primary/50",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isSelected
                                ? "text-primary"
                                : "text-muted-foreground",
                            )}
                          />
                          <span className="truncate text-xs text-foreground">
                            {preset.label}
                          </span>
                          {isSelected && (
                            <Check className="ml-auto h-3 w-3 text-primary" />
                          )}
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </>
        )}
      </section>

      {/* Theme Color */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Palette className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium text-foreground">Theme Color</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Choose an accent color for your dashboard
        </p>

        <div className="flex gap-3">
          {THEME_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => updateConfig("themeColor", color.value)}
              className={cn(
                "h-10 w-10 rounded-full transition-all",
                color.class,
                config.themeColor === color.value
                  ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  : "opacity-60 hover:opacity-80",
              )}
              title={color.label}
            />
          ))}
        </div>
      </section>

      {/* Feature Flags */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="border-b border-border pb-3">
          <h4 className="text-sm font-medium text-foreground">Features</h4>
          <p className="text-xs text-muted-foreground">
            Enable or disable features for your agent
          </p>
        </div>

        <div className="space-y-4">
          <FeatureToggle
            label="SMS Confirmations"
            description="Send booking confirmations via SMS"
            checked={config.features.smsConfirmations}
            onChange={(v) =>
              updateConfig("features", {
                ...config.features,
                smsConfirmations: v,
              })
            }
          />
          <FeatureToggle
            label="Email Notifications"
            description="Send email alerts for bookings"
            checked={config.features.emailNotifications}
            onChange={(v) =>
              updateConfig("features", {
                ...config.features,
                emailNotifications: v,
              })
            }
          />
          <FeatureToggle
            label="Live Transfer"
            description="Allow transfer to human agents"
            checked={config.features.liveTransfer}
            onChange={(v) =>
              updateConfig("features", { ...config.features, liveTransfer: v })
            }
          />
          <FeatureToggle
            label="Call Recording"
            description="Record calls for quality assurance"
            checked={config.features.recordingEnabled}
            onChange={(v) =>
              updateConfig("features", {
                ...config.features,
                recordingEnabled: v,
              })
            }
          />
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// FEATURE TOGGLE COMPONENT
// ============================================================================

interface FeatureToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function FeatureToggle({
  label,
  description,
  checked,
  onChange,
}: FeatureToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
