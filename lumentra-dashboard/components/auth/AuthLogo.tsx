"use client";

import { Zap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AuthLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const SIZE_MAP = {
  sm: { container: "h-8 w-8", icon: "h-4 w-4", text: "text-lg" },
  md: { container: "h-10 w-10", icon: "h-5 w-5", text: "text-xl" },
  lg: { container: "h-12 w-12", icon: "h-6 w-6", text: "text-2xl" },
};

export function AuthLogo({
  className,
  size = "md",
  showText = true,
}: AuthLogoProps) {
  const sizes = SIZE_MAP[size];

  return (
    <Link href="/" className={cn("inline-flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-xl bg-primary",
          sizes.container,
        )}
      >
        {/* Glow effect */}
        <div
          className="absolute inset-0 rounded-xl bg-primary"
          style={{ boxShadow: "0 0 20px rgba(99, 102, 241, 0.3)" }}
        />
        <Zap
          className={cn("relative z-10 text-primary-foreground", sizes.icon)}
        />
      </div>
      {showText && (
        <span className={cn("font-bold", sizes.text)}>Lumentra</span>
      )}
    </Link>
  );
}
