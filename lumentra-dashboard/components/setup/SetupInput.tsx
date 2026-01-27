"use client";

import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SetupInputProps {
  label: string;
  placeholder: string;
  onSubmit: (value: string) => void;
  optional?: boolean;
  autoFocus?: boolean;
  className?: string;
  defaultValue?: string;
}

export function SetupInput({
  label,
  placeholder,
  onSubmit,
  optional = false,
  autoFocus = true,
  className,
  defaultValue = "",
}: SetupInputProps) {
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim() || optional) {
      onSubmit(value.trim());
    }
  };

  const canSubmit = optional || value.trim().length > 0;

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit}
      className={cn("w-full max-w-md space-y-4", className)}
    >
      <div className="space-y-2">
        <Label htmlFor="setup-input" className="text-sm text-muted-foreground">
          {label}
          {optional && (
            <span className="ml-2 text-xs text-muted-foreground/60">
              (Optional)
            </span>
          )}
        </Label>
        <div className="relative">
          <Input
            id="setup-input"
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus={autoFocus}
            className={cn(
              "pr-12 text-base",
              "border-border bg-card/50 backdrop-blur-sm",
              "focus:border-primary focus:ring-primary/20",
            )}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit}
            className={cn(
              "absolute right-1 top-1/2 -translate-y-1/2",
              "h-8 w-8 p-0",
            )}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {optional && (
        <p className="text-xs text-muted-foreground/60">
          Press Enter to continue, or leave empty to use the default
        </p>
      )}
    </motion.form>
  );
}
