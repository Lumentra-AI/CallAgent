"use client";

import React, { useState } from "react";
import { useConfig } from "@/context/ConfigContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const isAdmin = config.userRole === "admin";
  const canSwitchIndustry = hasPermission("switch_industry");
  const popularIndustries = getPopularIndustries();

  const getIndustryIcon = (industryId: string) => {
    return INDUSTRY_ICON_MAP[industryId] || Building2;
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white">General Settings</h3>
        <p className="text-sm text-zinc-500">
          Configure your business identity and agent personality
        </p>
      </div>

      {/* Business Identity */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">Business Identity</h4>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-zinc-400">Business Name</Label>
            <Input
              value={config.businessName}
              onChange={(e) => updateConfig("businessName", e.target.value)}
              className="border-zinc-800 bg-zinc-950 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-400">Agent Name</Label>
            <Input
              value={config.agentName}
              onChange={(e) => updateConfig("agentName", e.target.value)}
              className="border-zinc-800 bg-zinc-950 text-white"
              placeholder="e.g., Jessica"
            />
          </div>
        </div>
      </section>

      {/* Industry Selection (Admin Only) */}
      {canSwitchIndustry && (
        <section className="space-y-4">
          <div className="border-b border-zinc-800 pb-2">
            <h4 className="text-sm font-medium text-white">Industry</h4>
            <p className="text-xs text-zinc-600">
              Changing industry will reset pricing to defaults
            </p>
          </div>

          {/* Current Industry Display */}
          <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4">
            <div className="flex items-center gap-3">
              {React.createElement(getIndustryIcon(config.industry), {
                className: "h-5 w-5 text-indigo-400",
              })}
              <div>
                <div className="text-sm font-medium text-white">
                  {industryPresets[config.industry]?.label || config.industry}
                </div>
                <div className="text-xs text-zinc-500">
                  {
                    industryPresets[config.industry]?.terminology
                      .transactionPlural
                  }
                </div>
              </div>
            </div>
          </div>

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
                        "relative rounded-lg border p-3 text-left transition-all",
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/10"
                          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700",
                      )}
                    >
                      {isSelected && (
                        <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                      <Icon
                        className={cn(
                          "mb-2 h-5 w-5",
                          isSelected ? "text-indigo-400" : "text-zinc-500",
                        )}
                      />
                      <div className="text-sm font-medium text-white">
                        {preset.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setShowAllIndustries(true)}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
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
                className="text-sm text-zinc-400 hover:text-white"
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
                            ? "bg-indigo-500/20 text-indigo-400"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700",
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
                      !selectedCategory || preset.category === selectedCategory,
                  )
                  .map((preset) => {
                    const Icon = getIndustryIcon(preset.id);
                    const isSelected = config.industry === preset.id;

                    return (
                      <button
                        key={preset.id}
                        onClick={() => switchIndustry(preset.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-2 text-left transition-all",
                          isSelected
                            ? "border-indigo-500 bg-indigo-500/10"
                            : "border-zinc-800 bg-zinc-900 hover:border-zinc-700",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "text-indigo-400" : "text-zinc-500",
                          )}
                        />
                        <span className="truncate text-xs text-white">
                          {preset.label}
                        </span>
                        {isSelected && (
                          <Check className="ml-auto h-3 w-3 text-indigo-500" />
                        )}
                      </button>
                    );
                  })}
              </div>
            </>
          )}
        </section>
      )}

      {/* Current Industry (Customer View) */}
      {!canSwitchIndustry && (
        <section className="space-y-4">
          <div className="border-b border-zinc-800 pb-2">
            <h4 className="text-sm font-medium text-white">Industry</h4>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center gap-3">
              {React.createElement(getIndustryIcon(config.industry), {
                className: "h-5 w-5 text-indigo-400",
              })}
              <div>
                <div className="text-sm font-medium text-white">
                  {industryPresets[config.industry]?.label || config.industry}
                </div>
                <div className="text-xs text-zinc-500">
                  {
                    industryPresets[config.industry]?.terminology
                      .transactionPlural
                  }
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Theme Color */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">Theme Color</h4>
        </div>

        <div className="flex gap-3">
          {THEME_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => updateConfig("themeColor", color.value)}
              className={cn(
                "h-8 w-8 rounded-full transition-all",
                color.class,
                config.themeColor === color.value
                  ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900"
                  : "opacity-50 hover:opacity-75",
              )}
              title={color.label}
            />
          ))}
        </div>
      </section>

      {/* Feature Flags */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">Features</h4>
        </div>

        <div className="space-y-3">
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
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-zinc-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          checked ? "bg-indigo-600" : "bg-zinc-700",
        )}
      >
        <div
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}
