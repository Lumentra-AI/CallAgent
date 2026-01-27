"use client";

import { motion, Variants } from "framer-motion";
import { INDUSTRY_PRESETS } from "@/lib/industryPresets";
import type { IndustryType } from "@/types";
import {
  Building2,
  Stethoscope,
  Car,
  Briefcase,
  Scissors,
  Home,
  Check,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SetupSummaryProps {
  industry: IndustryType | null;
  businessName: string;
  agentName: string;
  className?: string;
}

const INDUSTRY_ICON_MAP: Record<string, React.ElementType> = {
  hotel: Building2,
  medical: Stethoscope,
  auto_dealer: Car,
  legal: Briefcase,
  salon: Scissors,
  real_estate: Home,
};

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

export function SetupSummary({
  industry,
  businessName,
  agentName,
  className,
}: SetupSummaryProps) {
  if (!industry) return null;

  const preset = INDUSTRY_PRESETS[industry];
  const Icon =
    INDUSTRY_ICON_MAP[industry] ||
    INDUSTRY_ICON_MAP[preset?.category] ||
    Building2;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "w-full max-w-md rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6",
        className,
      )}
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center mb-6">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
          <Zap className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">{businessName}</h3>
        <p className="text-xs font-medium uppercase tracking-wider text-primary mt-1">
          {preset?.label} Edition
        </p>
      </motion.div>

      {/* Agent Info */}
      <motion.div
        variants={itemVariants}
        className="mb-6 rounded-lg border border-border bg-muted/30 p-4"
      >
        <p className="text-sm text-muted-foreground">
          Your AI agent{" "}
          <span className="font-medium text-foreground">
            &quot;{agentName || "Lumentra"}&quot;
          </span>{" "}
          is configured and ready to handle calls.
        </p>
      </motion.div>

      {/* Config Details */}
      <motion.div variants={containerVariants} className="space-y-3">
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-between text-sm"
        >
          <span className="text-muted-foreground">Industry</span>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <span className="font-medium">{preset?.label}</span>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="flex items-center justify-between text-sm"
        >
          <span className="text-muted-foreground">Base Rate</span>
          <span className="font-mono font-medium">
            ${preset?.defaultPricing.baseRate}/mo
          </span>
        </motion.div>

        <div className="border-t border-border my-4" />

        <motion.div variants={itemVariants} className="space-y-2">
          <FeatureItem label="24/7 Coverage" enabled />
          <FeatureItem label="SMS Confirmations" enabled />
          <FeatureItem label="Call Transcriptions" enabled />
          <FeatureItem label="Real-time Analytics" enabled />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function FeatureItem({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      {enabled ? (
        <span className="flex items-center gap-1 text-green-500">
          <Check className="h-3 w-3" />
          Enabled
        </span>
      ) : (
        <span className="text-muted-foreground/50">Disabled</span>
      )}
    </div>
  );
}
