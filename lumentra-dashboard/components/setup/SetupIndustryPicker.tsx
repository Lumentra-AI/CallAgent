"use client";

import { useState } from "react";
import { motion, Variants } from "framer-motion";
import {
  INDUSTRY_PRESETS,
  INDUSTRY_CATEGORIES,
  getPopularIndustries,
} from "@/lib/industryPresets";
import type { IndustryType, IndustryCategory, IndustryPreset } from "@/types";
import {
  Building2,
  Stethoscope,
  Car,
  Briefcase,
  Scissors,
  Home,
  Wrench,
  UtensilsCrossed,
  Scale,
  Check,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SetupIndustryPickerProps {
  onSelect: (industry: IndustryType) => void;
  className?: string;
}

const INDUSTRY_ICON_MAP: Record<string, React.ElementType> = {
  hotel: Building2,
  motel: Building2,
  vacation_rental: Home,
  restaurant: UtensilsCrossed,
  catering: UtensilsCrossed,
  medical: Stethoscope,
  dental: Stethoscope,
  veterinary: Stethoscope,
  mental_health: Stethoscope,
  chiropractic: Stethoscope,
  auto_dealer: Car,
  auto_service: Car,
  car_rental: Car,
  towing: Car,
  legal: Scale,
  accounting: Briefcase,
  insurance: Briefcase,
  consulting: Briefcase,
  salon: Scissors,
  spa: Scissors,
  barbershop: Scissors,
  fitness: Scissors,
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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

export function SetupIndustryPicker({
  onSelect,
  className,
}: SetupIndustryPickerProps) {
  const [showAll, setShowAll] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<IndustryCategory | null>(null);
  const [hoveredIndustry, setHoveredIndustry] = useState<string | null>(null);

  const popularIndustries = getPopularIndustries();
  const getIndustryIcon = (id: string) => INDUSTRY_ICON_MAP[id] || Building2;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, y: -20 }}
      className={cn("w-full max-w-3xl", className)}
    >
      {!showAll ? (
        <>
          {/* Popular Industries */}
          <div className="mb-4 text-center">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Popular Industries
            </span>
          </div>

          <motion.div
            variants={containerVariants}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {popularIndustries.map((preset) => (
              <IndustryCard
                key={preset.id}
                preset={preset}
                Icon={getIndustryIcon(preset.id)}
                isHovered={hoveredIndustry === preset.id}
                onMouseEnter={() => setHoveredIndustry(preset.id)}
                onMouseLeave={() => setHoveredIndustry(null)}
                onClick={() => onSelect(preset.id)}
              />
            ))}
          </motion.div>

          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              onClick={() => setShowAll(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              Show all industries
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* All Industries */}
          <div className="mb-4 text-center">
            <Button
              variant="ghost"
              onClick={() => setShowAll(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to popular
            </Button>
          </div>

          {/* Category Tabs */}
          <div className="mb-6 flex flex-wrap justify-center gap-2">
            {(Object.keys(INDUSTRY_CATEGORIES) as IndustryCategory[]).map(
              (cat) => {
                const CatIcon = CATEGORY_ICONS[cat];
                return (
                  <button
                    key={cat}
                    onClick={() =>
                      setSelectedCategory(selectedCategory === cat ? null : cat)
                    }
                    className={cn(
                      "flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all",
                      selectedCategory === cat
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                    )}
                  >
                    <CatIcon className="h-4 w-4" />
                    {INDUSTRY_CATEGORIES[cat].label}
                  </button>
                );
              },
            )}
          </div>

          {/* Industries Grid */}
          <motion.div
            variants={containerVariants}
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
          >
            {Object.values(INDUSTRY_PRESETS)
              .filter(
                (preset) =>
                  !selectedCategory || preset.category === selectedCategory,
              )
              .map((preset) => {
                const Icon = getIndustryIcon(preset.id);
                return (
                  <motion.button
                    key={preset.id}
                    variants={cardVariants}
                    onClick={() => onSelect(preset.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                      "border-border bg-card/50 hover:border-primary/50 hover:bg-card",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">
                      {preset.label}
                    </span>
                  </motion.button>
                );
              })}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

function IndustryCard({
  preset,
  Icon,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  preset: IndustryPreset;
  Icon: React.ElementType;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  return (
    <motion.button
      variants={cardVariants}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className={cn(
        "group relative rounded-xl border p-5 text-left transition-all duration-200",
        "border-border bg-card/50 backdrop-blur-sm",
        "hover:border-primary/50 hover:bg-card hover:shadow-lg",
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div
        className={cn(
          "mb-3 flex h-10 w-10 items-center justify-center rounded-lg border",
          "border-border bg-muted/50",
          "group-hover:border-primary/30 group-hover:bg-primary/10",
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 text-muted-foreground",
            "group-hover:text-primary",
          )}
        />
      </div>

      <h3 className="mb-1 font-medium">{preset.label}</h3>
      <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
        {preset.description}
      </p>

      {/* Pricing hint */}
      <div className="mt-3 border-t border-border pt-3">
        <span className="font-mono text-xs text-muted-foreground/60">
          From ${preset.defaultPricing.baseRate}/mo
        </span>
      </div>

      {/* Hover indicator */}
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary"
        >
          <Check className="h-3 w-3 text-primary-foreground" />
        </motion.div>
      )}
    </motion.button>
  );
}
