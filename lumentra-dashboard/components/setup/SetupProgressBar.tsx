"use client";

import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SETUP_STEPS, STEP_LABELS, canAccessStep } from "./SetupContext";
import type { SetupStep } from "@/types";
import { useState } from "react";

interface SetupProgressBarProps {
  currentStep: SetupStep;
  completedSteps: SetupStep[];
  onStepClick?: (step: SetupStep) => void;
}

export function SetupProgressBar({
  currentStep,
  completedSteps,
  onStepClick,
}: SetupProgressBarProps) {
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const currentIndex = SETUP_STEPS.indexOf(currentStep);

  return (
    <div className="border-b bg-background">
      {/* Desktop view */}
      <div className="mx-auto hidden max-w-4xl px-4 py-4 md:block">
        <div className="flex items-center justify-between">
          {SETUP_STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(step);
            const isCurrent = step === currentStep;
            const isAccessible = canAccessStep(step, completedSteps);
            const isClickable = isAccessible && onStepClick;

            return (
              <div key={step} className="flex items-center">
                {/* Step circle and label */}
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(step)}
                  disabled={!isAccessible}
                  className={cn(
                    "flex flex-col items-center gap-1",
                    isClickable && "cursor-pointer",
                    !isAccessible && "cursor-not-allowed opacity-50",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                      isCompleted &&
                        "border-primary bg-primary text-primary-foreground",
                      isCurrent &&
                        !isCompleted &&
                        "border-primary bg-primary/10 text-primary",
                      !isCurrent &&
                        !isCompleted &&
                        "border-muted-foreground/30 text-muted-foreground",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isCurrent && "text-primary",
                      !isCurrent && "text-muted-foreground",
                    )}
                  >
                    {STEP_LABELS[step]}
                  </span>
                </button>

                {/* Connector line */}
                {index < SETUP_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 w-8 flex-1 transition-colors lg:w-12",
                      completedSteps.includes(step)
                        ? "bg-primary"
                        : "bg-muted-foreground/30",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile view */}
      <div className="relative px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-sm font-medium text-primary">
              {currentIndex + 1}
            </div>
            <div className="text-left">
              <p className="font-medium">{STEP_LABELS[currentStep]}</p>
              <p className="text-xs text-muted-foreground">
                Step {currentIndex + 1} of {SETUP_STEPS.length}
              </p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              mobileDropdownOpen && "rotate-180",
            )}
          />
        </button>

        {/* Mobile dropdown */}
        {mobileDropdownOpen && (
          <div className="absolute left-0 right-0 top-full z-10 border-b bg-background shadow-lg">
            <div className="max-h-64 overflow-y-auto">
              {SETUP_STEPS.map((step, index) => {
                const isCompleted = completedSteps.includes(step);
                const isCurrent = step === currentStep;
                const isAccessible = canAccessStep(step, completedSteps);

                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => {
                      if (isAccessible && onStepClick) {
                        onStepClick(step);
                        setMobileDropdownOpen(false);
                      }
                    }}
                    disabled={!isAccessible}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                      isCurrent && "bg-primary/5",
                      isAccessible && !isCurrent && "hover:bg-muted/50",
                      !isAccessible && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-medium",
                        isCompleted &&
                          "border-primary bg-primary text-primary-foreground",
                        isCurrent &&
                          !isCompleted &&
                          "border-primary bg-primary/10 text-primary",
                        !isCurrent &&
                          !isCompleted &&
                          "border-muted-foreground/30 text-muted-foreground",
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isCurrent && "text-primary",
                        !isCurrent && "text-foreground",
                      )}
                    >
                      {STEP_LABELS[step]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
