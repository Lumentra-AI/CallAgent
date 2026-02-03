"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  Plus,
  ArrowLeftRight,
  PhoneForwarded,
  Check,
  ArrowLeft,
  Search,
  Clock,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSetup } from "../SetupContext";
import { get } from "@/lib/api/client";
import type { PhoneSetupType } from "@/types";

// Aceternity & MagicUI components
import { WobbleCard } from "@/components/aceternity/wobble-card";
import { TextGenerateEffect } from "@/components/aceternity/text-generate-effect";
import { SpotlightNew } from "@/components/aceternity/spotlight";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { ShineBorder } from "@/components/magicui/shine-border";

// Texas area codes first, then common US codes
const AREA_CODES = [
  { code: "512", region: "Austin" },
  { code: "214", region: "Dallas" },
  { code: "713", region: "Houston" },
  { code: "210", region: "San Antonio" },
  { code: "817", region: "Fort Worth" },
  { code: "469", region: "Dallas" },
  { code: "972", region: "Dallas" },
  { code: "281", region: "Houston" },
  { code: "832", region: "Houston" },
  { code: "737", region: "Austin" },
];

const CARRIERS = [
  { id: "att", name: "AT&T" },
  { id: "verizon", name: "Verizon" },
  { id: "tmobile", name: "T-Mobile" },
  { id: "sprint", name: "Sprint" },
  { id: "other", name: "Other" },
];

const FORWARDING_INSTRUCTIONS: Record<string, string[]> = {
  att: [
    "Dial *72 from your phone",
    "Enter the forwarding number when prompted",
    "Wait for confirmation tone",
  ],
  verizon: [
    "Dial *71 from your phone",
    "Enter the forwarding number",
    "Press # and hang up",
  ],
  tmobile: [
    "Go to Settings > Phone > Call Forwarding",
    "Enable call forwarding",
    "Enter the forwarding number",
  ],
  sprint: [
    "Dial *72 from your phone",
    "Enter the forwarding number",
    "Wait for two beeps to confirm",
  ],
  other: [
    "Contact your carrier for call forwarding instructions",
    "Ask to forward all calls to the number below",
  ],
};

interface PhoneOption {
  type: PhoneSetupType;
  title: string;
  description: string;
  timeline: string;
  icon: React.ElementType;
}

const PHONE_OPTIONS: PhoneOption[] = [
  {
    type: "new",
    title: "Get a new number",
    description: "We'll provision a dedicated phone number for your assistant",
    timeline: "Ready in minutes",
    icon: Plus,
  },
  {
    type: "port",
    title: "Port my existing number",
    description: "Transfer your current business number to our service",
    timeline: "Takes 5-15 business days",
    icon: ArrowLeftRight,
  },
  {
    type: "forward",
    title: "Forward calls to us",
    description: "Keep your number and forward calls to your assistant",
    timeline: "Ready in minutes",
    icon: PhoneForwarded,
  },
];

export function PhoneStep() {
  const router = useRouter();
  const { state, dispatch, saveStep, goToNextStep, goToPreviousStep } =
    useSetup();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New number state
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<string[]>([]);

  // Port state
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [useTempNumber, setUseTempNumber] = useState(true);

  // Forward state
  const [forwardCarrier, setForwardCarrier] = useState("att");
  const [showInstructions, setShowInstructions] = useState(false);

  const { setupType, number, areaCode, portRequest } = state.phoneData;

  const canContinue = setupType !== null;

  const handleSetupTypeSelect = (type: PhoneSetupType) => {
    dispatch({
      type: "SET_PHONE_DATA",
      payload: { setupType: type },
    });
    // Reset other fields when changing type
    setAvailableNumbers([]);
  };

  const searchNumbers = async () => {
    if (!areaCode) return;

    setSearchingNumbers(true);
    try {
      const data = await get<{ numbers: string[] }>(
        `/api/phone/available?areaCode=${areaCode}`,
      );
      setAvailableNumbers(data.numbers || []);
    } catch {
      // Mock numbers for demo
      setAvailableNumbers([
        `+1 (${areaCode}) 555-0123`,
        `+1 (${areaCode}) 555-0456`,
        `+1 (${areaCode}) 555-0789`,
        `+1 (${areaCode}) 555-0147`,
        `+1 (${areaCode}) 555-0258`,
      ]);
    } finally {
      setSearchingNumbers(false);
    }
  };

  const handleContinue = async () => {
    if (!canContinue) return;

    setIsSubmitting(true);
    const success = await saveStep("phone");
    if (success) {
      goToNextStep();
      router.push("/setup/hours");
    }
    setIsSubmitting(false);
  };

  const handleBack = () => {
    goToPreviousStep();
    router.push("/setup/assistant");
  };

  const renderNewNumberFlow = () => (
    <div className="space-y-6">
      {/* Area code selection */}
      <div className="space-y-3">
        <Label htmlFor="area-code">Area code</Label>
        <div className="flex gap-2">
          <select
            id="area-code"
            value={areaCode}
            onChange={(e) =>
              dispatch({
                type: "SET_PHONE_DATA",
                payload: { areaCode: e.target.value },
              })
            }
            className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Select area code</option>
            {AREA_CODES.map((ac) => (
              <option key={ac.code} value={ac.code}>
                {ac.code} - {ac.region}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={searchNumbers}
            disabled={!areaCode || searchingNumbers}
          >
            {searchingNumbers ? (
              "Searching..."
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Available numbers */}
      {availableNumbers.length > 0 && (
        <div className="space-y-3">
          <Label>Select a number</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {availableNumbers.map((phoneNumber) => {
              const isSelected = number === phoneNumber;
              return (
                <button
                  key={phoneNumber}
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "SET_PHONE_DATA",
                      payload: { number: phoneNumber },
                    })
                  }
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5",
                    isSelected &&
                      "border-primary bg-primary/5 ring-2 ring-primary/20",
                  )}
                >
                  <span className="font-mono">{phoneNumber}</span>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderPortNumberFlow = () => (
    <div className="space-y-6">
      {/* Current number */}
      <div className="space-y-2">
        <Label htmlFor="port-number">Current phone number</Label>
        <Input
          id="port-number"
          type="tel"
          placeholder="(555) 123-4567"
          value={portRequest?.phone_number || ""}
          onChange={(e) =>
            dispatch({
              type: "SET_PHONE_DATA",
              payload: {
                portRequest: {
                  ...portRequest,
                  phone_number: e.target.value,
                },
              },
            })
          }
        />
      </div>

      {/* Carrier */}
      <div className="space-y-2">
        <Label htmlFor="carrier">Current carrier</Label>
        <select
          id="carrier"
          value={portRequest?.current_carrier || selectedCarrier}
          onChange={(e) => {
            setSelectedCarrier(e.target.value);
            dispatch({
              type: "SET_PHONE_DATA",
              payload: {
                portRequest: {
                  ...portRequest,
                  current_carrier: e.target.value,
                },
              },
            });
          }}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Select carrier</option>
          {CARRIERS.map((carrier) => (
            <option key={carrier.id} value={carrier.id}>
              {carrier.name}
            </option>
          ))}
        </select>
      </div>

      {/* Account info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="account-number">Account number</Label>
          <Input id="account-number" placeholder="Your carrier account #" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pin">
            PIN{" "}
            <span className="font-normal text-muted-foreground">
              (if required)
            </span>
          </Label>
          <Input id="pin" placeholder="Account PIN" />
        </div>
      </div>

      {/* Authorized name */}
      <div className="space-y-2">
        <Label htmlFor="authorized-name">Authorized name on account</Label>
        <Input
          id="authorized-name"
          placeholder="Name as it appears on carrier account"
          value={portRequest?.authorized_name || ""}
          onChange={(e) =>
            dispatch({
              type: "SET_PHONE_DATA",
              payload: {
                portRequest: {
                  ...portRequest,
                  authorized_name: e.target.value,
                },
              },
            })
          }
        />
      </div>

      {/* Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-50 p-4 dark:bg-amber-950/20">
        <Clock className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Porting typically takes 5-15 business days
          </p>
          <p className="mt-1 text-amber-700 dark:text-amber-300">
            Your current number will remain active during the porting process.
          </p>
        </div>
      </div>

      {/* Temp number option */}
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 hover:bg-muted/50">
        <input
          type="checkbox"
          checked={useTempNumber}
          onChange={(e) => setUseTempNumber(e.target.checked)}
          className="h-4 w-4 rounded"
        />
        <div>
          <p className="font-medium">
            Give me a temporary number while porting
          </p>
          <p className="text-sm text-muted-foreground">
            Start using your assistant immediately with a temporary number
          </p>
        </div>
      </label>
    </div>
  );

  const renderForwardFlow = () => (
    <div className="space-y-6">
      {/* Your number */}
      <div className="space-y-2">
        <Label htmlFor="your-number">Your phone number</Label>
        <Input
          id="your-number"
          type="tel"
          placeholder="(555) 123-4567"
          value={number}
          onChange={(e) =>
            dispatch({
              type: "SET_PHONE_DATA",
              payload: { number: e.target.value },
            })
          }
        />
      </div>

      {/* Forwarding number display */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">Forward your calls to:</p>
        <p className="mt-1 font-mono text-lg font-semibold">
          +1 (800) 555-0199
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          This is your dedicated assistant line
        </p>
      </div>

      {/* Carrier selection and instructions */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowInstructions(!showInstructions)}
          className="flex w-full items-center justify-between text-left"
        >
          <Label className="cursor-pointer">
            How to set up call forwarding
          </Label>
          <ChevronDown
            className={cn(
              "h-5 w-5 transition-transform",
              showInstructions && "rotate-180",
            )}
          />
        </button>

        {showInstructions && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-2">
              <Label htmlFor="forward-carrier" className="text-xs">
                Select your carrier
              </Label>
              <select
                id="forward-carrier"
                value={forwardCarrier}
                onChange={(e) => setForwardCarrier(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {CARRIERS.map((carrier) => (
                  <option key={carrier.id} value={carrier.id}>
                    {carrier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Instructions:</p>
              <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                {FORWARDING_INSTRUCTIONS[forwardCarrier]?.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const optionColors: Record<PhoneSetupType, string> = {
    new: "bg-emerald-800",
    port: "bg-blue-800",
    forward: "bg-purple-800",
  };

  return (
    <div className="relative space-y-8">
      <SpotlightNew className="opacity-20" />

      {/* Header */}
      <div className="relative z-10">
        <TextGenerateEffect
          words="How will customers reach your assistant?"
          className="text-2xl md:text-3xl text-foreground"
          duration={0.3}
        />
        <p className="mt-2 text-muted-foreground">
          Choose how callers will connect to your AI assistant
        </p>
      </div>

      {/* Setup type selection with wobble cards */}
      <div className="relative z-10 grid gap-4 md:grid-cols-3">
        {PHONE_OPTIONS.map((option) => {
          const isSelected = setupType === option.type;
          const Icon = option.icon;

          return (
            <div key={option.type} className="relative">
              {isSelected && (
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary via-primary/50 to-primary opacity-75 blur-sm" />
              )}
              <WobbleCard
                containerClassName={cn(
                  "min-h-[160px] cursor-pointer relative",
                  isSelected ? "bg-primary" : optionColors[option.type],
                )}
                className="p-4"
              >
                <button
                  type="button"
                  onClick={() => handleSetupTypeSelect(option.type)}
                  className="flex h-full w-full flex-col text-left"
                >
                  {isSelected && (
                    <div className="absolute right-3 top-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  )}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-white">
                    {option.title}
                  </h3>
                  <p className="mt-1 text-sm text-white/70">
                    {option.description}
                  </p>
                  <span className="mt-2 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-xs text-white">
                    {option.timeline}
                  </span>
                </button>
              </WobbleCard>
            </div>
          );
        })}
      </div>

      {/* Setup-specific flows */}
      <div className="relative z-10">
        {setupType === "new" && renderNewNumberFlow()}
        {setupType === "port" && renderPortNumberFlow()}
        {setupType === "forward" && renderForwardFlow()}
      </div>

      {/* Navigation buttons */}
      <div className="relative z-10 flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <ShimmerButton
          onClick={handleContinue}
          disabled={!canContinue || isSubmitting}
          shimmerColor="#ffffff"
          shimmerSize="0.05em"
          borderRadius="8px"
          background={canContinue ? "hsl(var(--primary))" : "hsl(var(--muted))"}
          className={cn(
            "px-8 py-3 text-sm font-medium",
            !canContinue && "cursor-not-allowed opacity-50",
          )}
        >
          {isSubmitting ? "Saving..." : "Continue"}
        </ShimmerButton>
      </div>
    </div>
  );
}
