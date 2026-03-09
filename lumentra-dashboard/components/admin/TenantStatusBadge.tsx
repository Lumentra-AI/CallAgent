"use client";

import { cn } from "@/lib/utils";
import type { TenantStatus } from "@/lib/api/admin";

const STATUS_STYLES: Record<TenantStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  suspended: "bg-amber-50 text-amber-700 border-amber-200",
  draft: "bg-zinc-100 text-zinc-600 border-zinc-200",
  pending_verification: "bg-blue-50 text-blue-700 border-blue-200",
};

const STATUS_LABELS: Record<TenantStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  draft: "Draft",
  pending_verification: "Pending",
};

interface TenantStatusBadgeProps {
  status: TenantStatus;
  className?: string;
}

export function TenantStatusBadge({
  status,
  className,
}: TenantStatusBadgeProps) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft;
  const label = STATUS_LABELS[status] || status;

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
