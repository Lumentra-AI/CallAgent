"use client";

import Image from "next/image";
import { MessageSquare, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WidgetPosition } from "./types";

interface WidgetPreviewProps {
  enabled: boolean;
  themeColor: string;
  greeting: string;
  position: WidgetPosition;
  logoUrl?: string;
  businessName?: string;
}

export default function WidgetPreview({
  enabled,
  themeColor,
  greeting,
  position,
  logoUrl,
  businessName,
}: WidgetPreviewProps) {
  const effectiveGreeting = greeting || "Hi! How can I help you today?";
  const effectiveColor = themeColor || "#6366f1";

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Live Preview
      </p>

      {/* Browser mockup */}
      <div
        className="relative overflow-hidden rounded-lg border bg-zinc-50 shadow-sm"
        style={{ minHeight: 340 }}
      >
        {/* Browser chrome */}
        <div className="flex h-7 items-center gap-1.5 border-b bg-white px-3">
          <div className="h-2 w-2 rounded-full bg-red-400" />
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          <div className="h-2 w-2 rounded-full bg-green-400" />
          <div className="ml-3 h-3.5 flex-1 rounded bg-zinc-100" />
        </div>

        {/* Page content placeholder */}
        <div className="p-4">
          <div className="mb-2 h-3 w-3/4 rounded bg-zinc-200" />
          <div className="mb-2 h-3 w-1/2 rounded bg-zinc-200" />
          <div className="mb-4 h-3 w-2/3 rounded bg-zinc-200" />
          <div className="mb-2 h-3 w-5/6 rounded bg-zinc-100" />
          <div className="h-3 w-1/3 rounded bg-zinc-100" />
        </div>

        {enabled ? (
          <>
            {/* Chat window */}
            <div
              className={cn(
                "absolute bottom-14 w-56 rounded-lg border bg-white shadow-lg",
                position === "bottom-right" ? "right-3" : "left-3",
              )}
            >
              {/* Chat header */}
              <div
                className="flex items-center justify-between rounded-t-lg px-3 py-2"
                style={{ backgroundColor: effectiveColor }}
              >
                <div className="flex items-center gap-2">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5 text-white" />
                  )}
                  <span className="text-xs font-medium text-white">
                    {businessName || "Chat"}
                  </span>
                </div>
                <X className="h-3 w-3 text-white/70" />
              </div>

              {/* Chat body */}
              <div className="p-3">
                {/* Bot message */}
                <div className="mb-2 flex gap-2">
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: effectiveColor }}
                  >
                    <MessageSquare className="h-2.5 w-2.5 text-white" />
                  </div>
                  <div className="rounded-lg rounded-tl-none bg-zinc-100 px-2.5 py-1.5">
                    <p className="text-[10px] leading-snug text-zinc-700">
                      {effectiveGreeting}
                    </p>
                  </div>
                </div>

                {/* User message */}
                <div className="mb-2 flex justify-end">
                  <div
                    className="rounded-lg rounded-tr-none px-2.5 py-1.5"
                    style={{ backgroundColor: effectiveColor }}
                  >
                    <p className="text-[10px] leading-snug text-white">
                      I have a question
                    </p>
                  </div>
                </div>

                {/* Bot reply */}
                <div className="flex gap-2">
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: effectiveColor }}
                  >
                    <MessageSquare className="h-2.5 w-2.5 text-white" />
                  </div>
                  <div className="rounded-lg rounded-tl-none bg-zinc-100 px-2.5 py-1.5">
                    <p className="text-[10px] leading-snug text-zinc-700">
                      Sure, I am happy to help!
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat input */}
              <div className="flex items-center gap-2 border-t px-3 py-2">
                <div className="h-5 flex-1 rounded bg-zinc-100" />
                <Send
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: effectiveColor }}
                />
              </div>
            </div>

            {/* FAB button */}
            <div
              className={cn(
                "absolute bottom-3",
                position === "bottom-right" ? "right-3" : "left-3",
              )}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full shadow-md"
                style={{ backgroundColor: effectiveColor }}
              >
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 top-7 flex items-center justify-center bg-zinc-50/80">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
              <p className="text-xs text-zinc-400">Widget disabled</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
