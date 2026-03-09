"use client";

import { cn } from "@/lib/utils";
import type { TenantTier } from "@/lib/api/admin";

const TIER_STYLES: Record<TenantTier, string> = {
  starter: "bg-zinc-100 text-zinc-600 border-zinc-200",
  professional: "bg-blue-50 text-blue-700 border-blue-200",
  enterprise: "bg-purple-50 text-purple-700 border-purple-200",
};

const TIER_LABELS: Record<TenantTier, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

interface TenantTierBadgeProps {
  tier: TenantTier;
  className?: string;
}

export function TenantTierBadge({ tier, className }: TenantTierBadgeProps) {
  const style = TIER_STYLES[tier] || TIER_STYLES.starter;
  const label = TIER_LABELS[tier] || tier;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        style,
        className,
      )}
    >
      {label}
    </span>
  );
}
