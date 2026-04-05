"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface AuthCardProps {
  children: ReactNode;
  className?: string;
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        "relative w-full max-w-md",
        "rounded-2xl border border-border bg-card/95 backdrop-blur-sm",
        "p-8 shadow-elevated",
        className,
      )}
    >
      {/* Subtle glow effect behind card */}
      <div
        className="absolute -inset-px rounded-2xl opacity-50 -z-10 blur-xl"
        style={{
          background:
            "linear-gradient(135deg, var(--primary) 0%, transparent 50%, var(--primary) 100%)",
          opacity: 0.1,
        }}
      />
      {children}
    </div>
  );
}
