"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Phone,
  MessageSquare,
  FileQuestion,
  AlertTriangle,
  Megaphone,
  Clock,
  Receipt,
  Check,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSetup } from "../SetupContext";
import { INDUSTRY_PRESETS } from "@/lib/industryPresets";
import type { CapabilityOption } from "@/types";

// Aceternity & MagicUI components
import { BentoGrid, BentoGridItem } from "@/components/aceternity/bento-grid";
import { TextGenerateEffect } from "@/components/aceternity/text-generate-effect";
import { SpotlightNew } from "@/components/aceternity/spotlight";
import { ShineBorder } from "@/components/magicui/shine-border";

const CAPABILITY_ICONS: Record<string, React.ElementType> = {
  appointments: CalendarCheck,
  reservations: CalendarCheck,
  call_handling: Phone,
  message_taking: MessageSquare,
  faq: FileQuestion,
  emergency_dispatch: AlertTriangle,
  promotions: Megaphone,
  after_hours: Clock,
  patient_intake: Receipt,
};

// Define capabilities by category
const CAPABILITY_OPTIONS: CapabilityOption[] = [
  {
    id: "appointments",
    label: "Appointments",
    description: "Schedule, reschedule, and cancel appointments",
    icon: "CalendarCheck",
    category: "core",
  },
  {
    id: "reservations",
    label: "Reservations",
    description: "Book tables, rooms, or services",
    icon: "CalendarCheck",
    category: "core",
  },
  {
    id: "patient_intake",
    label: "Patient Intake",
    description: "Collect patient information before visits",
    icon: "Receipt",
    category: "core",
  },
  {
    id: "call_handling",
    label: "Call Handling",
    description: "Answer calls and route to the right person",
    icon: "Phone",
    category: "core",
  },
  {
    id: "message_taking",
    label: "Message Taking",
    description: "Record messages when you're unavailable",
    icon: "MessageSquare",
    category: "communication",
  },
  {
    id: "faq",
    label: "FAQ & Information",
    description: "Answer common questions about your business",
    icon: "FileQuestion",
    category: "communication",
  },
  {
    id: "emergency_dispatch",
    label: "Emergency Routing",
    description: "Identify and escalate urgent situations",
    icon: "AlertTriangle",
    category: "advanced",
  },
  {
    id: "promotions",
    label: "Promotions",
    description: "Mention special offers to callers",
    icon: "Megaphone",
    category: "advanced",
  },
  {
    id: "after_hours",
    label: "After Hours",
    description: "Handle calls outside business hours",
    icon: "Clock",
    category: "advanced",
  },
];

// Map industries to recommended capabilities
const INDUSTRY_CAPABILITIES: Record<string, string[]> = {
  dental: ["appointments", "patient_intake", "faq", "emergency_dispatch"],
  medical: ["appointments", "patient_intake", "faq", "emergency_dispatch"],
  veterinary: ["appointments", "patient_intake", "faq", "emergency_dispatch"],
  restaurant: ["reservations", "faq", "promotions", "after_hours"],
  pizza: ["call_handling", "faq", "promotions"],
  hotel: ["reservations", "faq", "after_hours"],
  salon: ["appointments", "faq", "promotions"],
  spa: ["appointments", "faq", "promotions"],
  barbershop: ["appointments", "faq"],
  legal: ["appointments", "message_taking", "faq"],
  accounting: ["appointments", "message_taking", "faq"],
  auto_service: ["appointments", "faq", "promotions"],
  auto_dealer: ["appointments", "faq", "message_taking"],
  real_estate: ["appointments", "message_taking", "faq"],
  fitness: ["appointments", "faq", "promotions"],
  default: ["call_handling", "message_taking", "faq"],
};

export function CapabilitiesStep() {
  const router = useRouter();
  const { state, dispatch, saveStep, goToNextStep, goToPreviousStep } =
    useSetup();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const industry = state.businessData.industry;
  const industryPreset = industry ? INDUSTRY_PRESETS[industry] : null;

  const recommendedCapabilities =
    (industry && INDUSTRY_CAPABILITIES[industry]) ||
    INDUSTRY_CAPABILITIES.default;

  useEffect(() => {
    if (state.capabilities.length === 0 && recommendedCapabilities.length > 0) {
      dispatch({
        type: "SET_CAPABILITIES",
        payload: recommendedCapabilities,
      });
    }
  }, [recommendedCapabilities, state.capabilities.length, dispatch]);

  const canContinue = state.capabilities.length > 0;

  const handleContinue = async () => {
    if (!canContinue) return;

    setIsSubmitting(true);
    const success = await saveStep("capabilities");
    if (success) {
      goToNextStep();
      router.push("/setup/details");
    }
    setIsSubmitting(false);
  };

  const handleBack = () => {
    goToPreviousStep();
    router.push("/setup/business");
  };

  const toggleCapability = (id: string) => {
    const current = state.capabilities;
    const updated = current.includes(id)
      ? current.filter((c) => c !== id)
      : [...current, id];
    dispatch({ type: "SET_CAPABILITIES", payload: updated });
  };

  const coreCapabilities = CAPABILITY_OPTIONS.filter(
    (c) => c.category === "core",
  );
  const communicationCapabilities = CAPABILITY_OPTIONS.filter(
    (c) => c.category === "communication",
  );
  const advancedCapabilities = CAPABILITY_OPTIONS.filter(
    (c) => c.category === "advanced",
  );

  const renderCapabilityCard = (capability: CapabilityOption) => {
    const isSelected = state.capabilities.includes(capability.id);
    const isRecommended = recommendedCapabilities.includes(capability.id);
    const Icon = CAPABILITY_ICONS[capability.id] || Phone;

    const cardContent = (
      <BentoGridItem
        className={cn(
          "cursor-pointer min-h-[140px]",
          isSelected && "border-primary/50 bg-primary/5",
        )}
        title={
          <div className="flex items-center gap-2">
            <span>{capability.label}</span>
            {isRecommended && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Sparkles className="h-3 w-3" />
                Recommended
              </span>
            )}
          </div>
        }
        description={capability.description}
        header={
          <div className="flex h-full w-full items-center justify-between">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            {isSelected && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <Check className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
          </div>
        }
        icon={null}
      />
    );

    if (isSelected) {
      return (
        <div
          key={capability.id}
          className="w-full cursor-pointer"
          onClick={() => toggleCapability(capability.id)}
        >
          <ShineBorder
            borderRadius={12}
            borderWidth={2}
            duration={8}
            color={["#6366f1", "#8b5cf6", "#a855f7"]}
            className="w-full min-w-0 p-0"
          >
            {cardContent}
          </ShineBorder>
        </div>
      );
    }

    return (
      <div
        key={capability.id}
        className="w-full cursor-pointer"
        onClick={() => toggleCapability(capability.id)}
      >
        {cardContent}
      </div>
    );
  };

  return (
    <div className="relative space-y-8">
      <SpotlightNew className="opacity-20" />

      {/* Header */}
      <div className="relative z-10">
        <TextGenerateEffect
          words="What should your assistant handle?"
          className="text-2xl md:text-3xl text-foreground"
          duration={0.3}
        />
        <p className="mt-2 text-muted-foreground">
          {industryPreset
            ? `Common tasks for ${industryPreset.label.toLowerCase()} businesses`
            : "Select the capabilities your assistant should have"}
        </p>
      </div>

      {/* Core capabilities */}
      <div className="relative z-10 space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="h-1 w-4 rounded-full bg-primary" />
          Core Features
        </h2>
        <BentoGrid className="grid-cols-1 md:grid-cols-2 md:auto-rows-auto gap-4">
          {coreCapabilities.map(renderCapabilityCard)}
        </BentoGrid>
      </div>

      {/* Communication capabilities */}
      <div className="relative z-10 space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="h-1 w-4 rounded-full bg-blue-500" />
          Communication
        </h2>
        <BentoGrid className="grid-cols-1 md:grid-cols-2 md:auto-rows-auto gap-4">
          {communicationCapabilities.map(renderCapabilityCard)}
        </BentoGrid>
      </div>

      {/* Advanced capabilities */}
      <div className="relative z-10 space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="h-1 w-4 rounded-full bg-amber-500" />
          Advanced
        </h2>
        <BentoGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:auto-rows-auto gap-4">
          {advancedCapabilities.map(renderCapabilityCard)}
        </BentoGrid>
      </div>

      {/* Selection summary with shine border */}
      {state.capabilities.length > 0 && (
        <div className="relative z-10">
          <ShineBorder
            borderRadius={12}
            borderWidth={1}
            duration={12}
            color="#22c55e"
            className="w-full min-w-full bg-muted/30"
          >
            <p className="text-sm">
              <span className="font-bold text-primary">
                {state.capabilities.length}
              </span>{" "}
              {state.capabilities.length === 1 ? "capability" : "capabilities"}{" "}
              selected - your assistant is ready to help with{" "}
              {state.capabilities
                .map((c) =>
                  CAPABILITY_OPTIONS.find(
                    (o) => o.id === c,
                  )?.label.toLowerCase(),
                )
                .filter(Boolean)
                .join(", ")}
            </p>
          </ShineBorder>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="relative z-10 flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!canContinue || isSubmitting}
          size="lg"
          className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-black shadow-sm transition-all hover:bg-white/90 active:scale-[0.98]"
        >
          {isSubmitting ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
