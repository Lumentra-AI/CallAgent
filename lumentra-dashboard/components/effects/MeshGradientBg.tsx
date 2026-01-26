"use client";

import { MeshGradientRenderer } from "@johnn-e/react-mesh-gradient";
import { cn } from "@/lib/utils";

interface MeshGradientBgProps {
  className?: string;
  colors?: string[];
  speed?: number;
}

export function MeshGradientBg({
  className,
  colors = ["#0f172a", "#1e3a5f", "#312e81", "#1e1b4b", "#0c0a1d"],
  speed = 0.01,
}: MeshGradientBgProps) {
  return (
    <div className={cn("absolute inset-0 z-0", className)}>
      <MeshGradientRenderer
        className="w-full h-full"
        colors={colors}
        speed={speed}
      />
    </div>
  );
}
