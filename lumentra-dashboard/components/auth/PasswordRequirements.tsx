"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPasswordRequirements } from "@/lib/utils/password";

interface PasswordRequirementsProps {
  password: string;
  className?: string;
}

export function PasswordRequirements({
  password,
  className,
}: PasswordRequirementsProps) {
  const requirements = getPasswordRequirements(password);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/40 p-3",
        className,
      )}
    >
      <p className="mb-2 text-xs font-medium text-foreground">
        Password requirements
      </p>
      <ul className="space-y-1.5">
        {requirements.map((requirement) => (
          <li
            key={requirement.id}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              requirement.met
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground",
            )}
          >
            {requirement.met ? (
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            <span>{requirement.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
