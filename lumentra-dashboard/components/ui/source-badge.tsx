"use client";

import {
  MessageSquare,
  Phone,
  Pencil,
  Cable,
  CalendarCheck,
  Upload,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm";

interface SourceBadgeProps {
  source?: string | null;
  size?: Size;
  className?: string;
  iconOnly?: boolean;
}

const CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  web: {
    label: "Chat",
    icon: MessageSquare,
    className: "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400",
  },
  chat: {
    label: "Chat",
    icon: MessageSquare,
    className: "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400",
  },
  call: {
    label: "Call",
    icon: Phone,
    className:
      "bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400",
  },
  voice: {
    label: "Call",
    icon: Phone,
    className:
      "bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400",
  },
  manual: {
    label: "Manual",
    icon: Pencil,
    className:
      "bg-zinc-500/10 border-zinc-500/30 text-zinc-600 dark:text-zinc-400",
  },
  api: {
    label: "API",
    icon: Cable,
    className:
      "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
  },
  booking: {
    label: "Booking",
    icon: CalendarCheck,
    className:
      "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  },
  import: {
    label: "Import",
    icon: Upload,
    className:
      "bg-zinc-500/10 border-zinc-500/30 text-zinc-600 dark:text-zinc-400",
  },
  sms: {
    label: "SMS",
    icon: MessageCircle,
    className:
      "bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400",
  },
};

export function SourceBadge({
  source,
  size = "xs",
  className,
  iconOnly = false,
}: SourceBadgeProps) {
  if (!source) return null;

  const config = CONFIG[source.toLowerCase()];
  if (!config) return null;

  const Icon = config.icon;
  const sizing =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5 gap-1"
      : "text-xs px-2 py-0.5 gap-1.5";
  const iconSize = size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium leading-none",
        sizing,
        config.className,
        className,
      )}
      title={`Source: ${config.label}`}
    >
      <Icon className={iconSize} />
      {!iconOnly && config.label}
    </span>
  );
}
