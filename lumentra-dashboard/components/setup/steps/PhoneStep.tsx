"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowLeftRight,
  PhoneForwarded,
  Check,
  ArrowLeft,
  Search,
  Clock,
  CheckCircle,
  Loader2,
  Copy,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSetup } from "../SetupContext";
import { SelectionCard } from "../SelectionCard";
import { get, post } from "@/lib/api/client";
import type { PhoneSetupType } from "@/types";

// Texas area codes first, then common US codes
const AREA_CODES = [
  { code: "817", region: "Fort Worth" },
  { code: "972", region: "Dallas" },
  { code: "281", region: "Houston" },
  { code: "832", region: "Houston" },
  { code: "737", region: "Austin" },
  { code: "945", region: "Dallas/Denton" },
  { code: "346", region: "Houston" },
  { code: "430", region: "East Texas" },
  { code: "903", region: "East Texas" },
  { code: "936", region: "SE Texas" },
];

const CARRIERS = [
  { id: "att", name: "AT&T" },
  { id: "verizon", name: "Verizon" },
  { id: "tmobile", name: "T-Mobile" },
  { id: "sprint", name: "Sprint" },
  { id: "other", name: "Other" },
];

// Conditional forwarding: only when busy or unanswered (not *72 unconditional)
const FORWARDING_INSTRUCTIONS: Record<
  string,
  { steps: string[]; note?: string }
> = {
  att: {
    steps: [
      "From your business phone, dial *92",
      "Enter the forwarding number shown below",
      "Wait for confirmation tone, then hang up",
    ],
    note: "This forwards calls only when you don't answer. To also forward when busy, dial *67 and enter the same number.",
  },
  verizon: {
    steps: [
      "Dial *71 from your phone to forward when busy",
      "Enter the forwarding number shown below",
      "For no-answer forwarding, use the My Verizon app or call 611",
    ],
    note: "Verizon requires separate setup for busy vs no-answer forwarding.",
  },
  tmobile: {
    steps: [
      "For no-answer: dial **61*FORWARDING_NUMBER# and press Call",
      "For busy: dial **67*FORWARDING_NUMBER# and press Call",
      "Replace FORWARDING_NUMBER with the number shown below",
    ],
    note: "You can also set this up in the T-Mobile app under Call Settings.",
  },
  sprint: {
    steps: [
      "Dial *73 from your phone",
      "Enter the forwarding number shown below",
      "Wait for two beeps to confirm",
    ],
    note: "Sprint uses *73 for conditional forwarding (busy/no-answer).",
  },
  other: {
    steps: [
      "Contact your carrier and ask for 'conditional call forwarding'",
      "Request forwarding when busy AND when unanswered",
      "Provide the forwarding number shown below",
    ],
    note: "Most carriers can set this up over the phone in a few minutes. Ask specifically for 'forward on busy' and 'forward on no answer'.",
  },
};

interface PhoneOption {
  type: PhoneSetupType;
  title: string;
  description: string;
  badge: string;
  icon: React.ElementType;
}

const PHONE_OPTIONS: PhoneOption[] = [
  {
    type: "new",
    title: "Get a new phone number",
    description:
      "We'll set you up with a local phone number instantly. Share it with customers and start receiving AI-answered calls.",
    badge: "Recommended",
    icon: Plus,
  },
  {
    type: "port",
    title: "Use my existing phone number",
    description:
      "Want to keep your current business number? We'll transfer it over. This takes 5-15 business days. We'll give you a temporary number in the meantime.",
    badge: "5-15 business days",
    icon: ArrowLeftRight,
  },
  {
    type: "forward",
    title: "Forward my calls",
    description:
      "Keep your current number and set up call forwarding. You'll configure forwarding on your phone provider's website.",
    badge: "Ready in minutes",
    icon: PhoneForwarded,
  },
];

const PORT_STATUS_STEPS = [
  { key: "draft", label: "Submitted" },
  { key: "submitted", label: "Under review" },
  { key: "pending", label: "Carrier processing" },
  { key: "approved", label: "Approved" },
  { key: "completed", label: "Completed" },
] as const;

function getPortStatusIndex(status: string): number {
  const idx = PORT_STATUS_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

function PortStatusTracker({
  portRequest,
  tempNumber,
}: {
  portRequest: {
    status: string;
    phone_number: string;
    estimated_completion?: string | null;
    rejection_reason?: string | null;
    completed_at?: string | null;
  };
  tempNumber: string | null;
}) {
  const isRejected = portRequest.status === "rejected";
  const isCompleted = portRequest.status === "completed";
  const currentIndex = getPortStatusIndex(portRequest.status);

  if (isRejected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <XCircle className="h-5 w-5 text-destructive" />
          <span className="text-sm font-medium text-destructive">
            Port request rejected
          </span>
        </div>
        {portRequest.rejection_reason && (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Reason:</p>
            <p className="mt-1 text-muted-foreground">
              {portRequest.rejection_reason}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-50 p-3 dark:bg-green-950/20">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            Number ported successfully
          </span>
        </div>
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <p>
            Your number{" "}
            <span className="font-mono font-semibold">
              {portRequest.phone_number}
            </span>{" "}
            is now active and receiving calls.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-blue-500/50 bg-blue-50 p-3 dark:bg-blue-950/20">
        <Clock className="h-5 w-5 text-blue-600" />
        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
          Porting {portRequest.phone_number} - in progress
        </span>
      </div>

      {/* Progress steps */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between">
          {PORT_STATUS_STEPS.map((step, i) => {
            const isDone = i < currentIndex;
            const isCurrent = i === currentIndex;

            return (
              <div key={step.key} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  {i > 0 && (
                    <div
                      className={cn(
                        "h-0.5 flex-1",
                        isDone || isCurrent
                          ? "bg-primary"
                          : "bg-muted-foreground/20",
                      )}
                    />
                  )}
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs",
                      isDone && "bg-primary text-primary-foreground",
                      isCurrent &&
                        "border-2 border-primary bg-primary/10 text-primary",
                      !isDone &&
                        !isCurrent &&
                        "border border-muted-foreground/30 text-muted-foreground/50",
                    )}
                  >
                    {isDone ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                  {i < PORT_STATUS_STEPS.length - 1 && (
                    <div
                      className={cn(
                        "h-0.5 flex-1",
                        isDone ? "bg-primary" : "bg-muted-foreground/20",
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "mt-1.5 text-center text-[10px] leading-tight",
                    isCurrent
                      ? "font-medium text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Estimated completion */}
      {portRequest.estimated_completion && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span>
            Estimated completion:{" "}
            {new Date(portRequest.estimated_completion).toLocaleDateString(
              "en-US",
              { month: "long", day: "numeric", year: "numeric" },
            )}
          </span>
        </div>
      )}

      {/* Temporary number info */}
      {tempNumber && (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="text-muted-foreground">
            Your assistant is available at:
          </p>
          <p className="mt-1 font-mono text-lg font-semibold">{tempNumber}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This temporary number will be replaced when porting completes.
          </p>
        </div>
      )}

      {!tempNumber && (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          Your current number stays active during the porting process (5-15
          business days).
        </div>
      )}
    </div>
  );
}

export function PhoneStep() {
  const router = useRouter();
  const { state, dispatch, saveStep, goToNextStep, goToPreviousStep } =
    useSetup();

  // Destructure phone data first so it's available for state initialization
  const { setupType, number, areaCode, portRequest } = state.phoneData;

  const [isSubmitting, setIsSubmitting] = useState(false);

  // New number state
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<string[]>([]);
  const [numberSearchError, setNumberSearchError] = useState<string | null>(
    null,
  );
  const [provisioningNumber, setProvisioningNumber] = useState(false);
  // Initialize from context flag (set by API load or successful provision)
  const [numberProvisioned, setNumberProvisioned] = useState(
    state.phoneData.provisioned,
  );
  const [provisionError, setProvisionError] = useState<string | null>(null);

  // Port state
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [useTempNumber, setUseTempNumber] = useState(true);
  const [portSubmitting, setPortSubmitting] = useState(false);
  const [portSubmitted, setPortSubmitted] = useState(false);
  const [portError, setPortError] = useState<string | null>(null);
  const [portTempNumber, setPortTempNumber] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [pin, setPin] = useState("");
  // Server-side port request data (loaded from API)
  const [existingPortRequest, setExistingPortRequest] = useState<{
    id: string;
    status: string;
    phone_number: string;
    estimated_completion?: string | null;
    rejection_reason?: string | null;
    submitted_at?: string | null;
    completed_at?: string | null;
  } | null>(null);

  // Forward state
  const [forwardCarrier, setForwardCarrier] = useState("att");
  const [forwardStatus, setForwardStatus] = useState<
    "idle" | "provisioning" | "provisioned" | "verified" | "error"
  >("idle");
  const [forwardNumber, setForwardNumber] = useState<string | null>(null);
  const [forwardError, setForwardError] = useState<string | null>(null);
  // Separate state for the business number input (not persisted -- only used to call the API)
  const [businessNumber, setBusinessNumber] = useState("");

  // Restore forward state from loaded config (runs after loadProgress completes)
  useEffect(() => {
    if (setupType === "forward" && number !== "" && forwardStatus === "idle") {
      setForwardNumber(number);
      setForwardStatus("provisioned");
    }
  }, [setupType, number]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync numberProvisioned when the context provisioned flag changes (e.g. after loadProgress)
  useEffect(() => {
    if (state.phoneData.provisioned && !numberProvisioned) {
      setNumberProvisioned(true);
    }
  }, [state.phoneData.provisioned]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch existing port request status on mount
  useEffect(() => {
    if (setupType !== "port") return;

    let cancelled = false;
    (async () => {
      try {
        const data = await get<{
          config: { port_request_id?: string; phone_number?: string } | null;
          portRequest: {
            id: string;
            status: string;
            phone_number: string;
            estimated_completion?: string | null;
            rejection_reason?: string | null;
            submitted_at?: string | null;
            completed_at?: string | null;
          } | null;
        }>("/api/phone/config");

        if (cancelled) return;

        if (data.portRequest) {
          setExistingPortRequest(data.portRequest);
          if (data.portRequest.status !== "draft") {
            setPortSubmitted(true);
          }
          if (data.config?.phone_number) {
            setPortTempNumber(data.config.phone_number);
          }
        }
      } catch {
        // Non-fatal -- form still works
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setupType]);

  const canContinue =
    (setupType === "new" && !!number) ||
    (setupType === "port" && (portSubmitted || !!existingPortRequest)) ||
    (setupType === "forward" &&
      (forwardStatus === "provisioned" || forwardStatus === "verified"));

  const handleSetupTypeSelect = (type: PhoneSetupType) => {
    dispatch({
      type: "SET_PHONE_DATA",
      payload: { setupType: type, provisioned: false },
    });
    // Reset other fields when changing type
    setAvailableNumbers([]);
    setNumberProvisioned(false);
    setProvisionError(null);
    setForwardStatus("idle");
    setForwardNumber(null);
    setForwardError(null);
    setPortSubmitted(false);
    setPortError(null);
  };

  // ---- New Number Flow ----

  const searchNumbers = async () => {
    if (!areaCode) return;

    setSearchingNumbers(true);
    setNumberSearchError(null);
    setNumberProvisioned(false);
    setProvisionError(null);
    try {
      const data = await get<{ numbers: string[] }>(
        `/api/phone/available?areaCode=${areaCode}`,
      );
      const nums = data.numbers || [];
      setAvailableNumbers(nums);
      if (nums.length === 0) {
        setNumberSearchError(
          "No numbers available for this area code. Try a different one.",
        );
      }
    } catch {
      setAvailableNumbers([]);
      setNumberSearchError(
        "Could not fetch available numbers right now. Please try again.",
      );
    } finally {
      setSearchingNumbers(false);
    }
  };

  // ---- Port Number Flow ----

  const handleSubmitPort = async () => {
    if (
      !portRequest?.phone_number ||
      !portRequest?.current_carrier ||
      !portRequest?.authorized_name
    )
      return;

    setPortSubmitting(true);
    setPortError(null);
    try {
      const data = await post<{
        success: boolean;
        portRequestId: string;
        temporaryNumber: string | null;
      }>("/api/phone/port", {
        phone_number: portRequest.phone_number,
        current_carrier: portRequest.current_carrier,
        account_number: accountNumber || undefined,
        pin: pin || undefined,
        authorized_name: portRequest.authorized_name,
        use_temp_number: useTempNumber,
      });

      if (data.success) {
        setPortSubmitted(true);
        setPortTempNumber(data.temporaryNumber);
        setExistingPortRequest({
          id: data.portRequestId,
          status: "draft",
          phone_number: portRequest!.phone_number!,
        });
        if (data.temporaryNumber) {
          dispatch({
            type: "SET_PHONE_DATA",
            payload: { number: data.temporaryNumber, provisioned: true },
          });
        }
      }
    } catch {
      setPortError("Failed to submit port request. Please try again.");
    } finally {
      setPortSubmitting(false);
    }
  };

  // ---- Forward Flow ----

  const handleSetupForward = async () => {
    if (!businessNumber) return;

    setForwardStatus("provisioning");
    setForwardError(null);
    try {
      const data = await post<{
        success: boolean;
        forwardTo: string;
        instructions: string;
      }>("/api/phone/forward", { business_number: businessNumber });

      if (data.success) {
        setForwardNumber(data.forwardTo);
        setForwardStatus("provisioned");
        // Persist the forwarding number so it survives page refresh
        // (the backend already saved it to phone_configurations + tenants.phone_number)
        dispatch({
          type: "SET_PHONE_DATA",
          payload: { number: data.forwardTo, provisioned: true },
        });
      } else {
        setForwardStatus("error");
        setForwardError("Failed to set up forwarding number.");
      }
    } catch {
      setForwardStatus("error");
      setForwardError(
        "Failed to provision forwarding number. Please try again.",
      );
    }
  };

  const handleVerifyForward = async () => {
    try {
      const data = await post<{ success: boolean }>(
        "/api/phone/verify-forward",
      );
      if (data.success) {
        setForwardStatus("verified");
      }
    } catch {
      // Non-fatal: still allow continue
    }
  };

  // ---- Navigation ----

  const handleContinue = async () => {
    setIsSubmitting(true);
    setProvisionError(null);

    try {
      // Auto-provision if user selected a new number but hasn't provisioned yet
      if (setupType === "new" && number && !numberProvisioned) {
        setProvisioningNumber(true);
        const data = await post<{ success: boolean; phoneNumber: string }>(
          "/api/phone/provision",
          { phoneNumber: number },
        );
        setProvisioningNumber(false);
        if (!data.success) {
          setProvisionError("Failed to provision number. Please try again.");
          return;
        }
        setNumberProvisioned(true);
        dispatch({
          type: "SET_PHONE_DATA",
          payload: { number: data.phoneNumber, provisioned: true },
        });
      }

      const success = await saveStep("phone");
      if (success) {
        goToNextStep();
        router.push("/setup/hours");
      }
    } catch {
      setProvisionError("Failed to set up phone number. Please try again.");
    } finally {
      setIsSubmitting(false);
      setProvisioningNumber(false);
    }
  };

  const handleBack = () => {
    goToPreviousStep();
    router.push("/setup/assistant");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // ---- Render: New Number ----

  const renderNewNumberFlow = () => {
    // Once purchased, show locked state
    if (numberProvisioned) {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-500/30 bg-green-50/50 p-4 dark:bg-green-950/20">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800 dark:text-green-200">
                Phone number purchased
              </span>
            </div>
            <p className="font-mono text-lg font-semibold">{number}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This number is active and ready to receive calls. You can purchase
              additional numbers from your dashboard settings after setup.
            </p>
          </div>
        </div>
      );
    }

    return (
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
        {numberSearchError && (
          <p className="text-sm text-destructive">{numberSearchError}</p>
        )}
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

        {/* Purchase notice */}
        {number && availableNumbers.includes(number) && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 p-3 dark:bg-amber-950/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Clicking Continue will purchase{" "}
              <span className="font-mono font-semibold">{number}</span> for your
              account. This number will be billed to your subscription.
            </p>
          </div>
        )}
      </div>
    );
  };

  // ---- Render: Port Number ----

  const renderPortNumberFlow = () => (
    <div className="space-y-6">
      {portSubmitted ? (
        <div className="space-y-4">
          {/* Port status tracker */}
          {existingPortRequest && (
            <PortStatusTracker
              portRequest={existingPortRequest}
              tempNumber={portTempNumber}
            />
          )}
          {!existingPortRequest && (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-50 p-3 dark:bg-green-950/20">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Port request submitted
                </span>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p>
                  Your number will be transferred in approximately 5-15 business
                  days.
                </p>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
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
              <Input
                id="account-number"
                placeholder="Your carrier account #"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">
                PIN{" "}
                <span className="font-normal text-muted-foreground">
                  (if required)
                </span>
              </Label>
              <Input
                id="pin"
                placeholder="Account PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
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
                Your current number will remain active during the porting
                process.
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

          {/* Submit button */}
          {portError && <p className="text-sm text-destructive">{portError}</p>}
          <Button
            onClick={handleSubmitPort}
            disabled={
              portSubmitting ||
              !portRequest?.phone_number ||
              !portRequest?.current_carrier ||
              !portRequest?.authorized_name
            }
          >
            {portSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit port request"
            )}
          </Button>
        </>
      )}
    </div>
  );

  // ---- Render: Forward ----

  const renderForwardFlow = () => (
    <div className="space-y-6">
      {/* Business number input -- hidden once forwarding is provisioned */}
      {forwardStatus === "idle" || forwardStatus === "error" ? (
        <div className="space-y-2">
          <Label htmlFor="your-number">Your business phone number</Label>
          <Input
            id="your-number"
            type="tel"
            placeholder="(555) 123-4567"
            value={businessNumber}
            onChange={(e) => setBusinessNumber(e.target.value)}
          />
        </div>
      ) : null}

      {/* Provision button -- before provisioning */}
      {forwardStatus === "idle" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            We&apos;ll assign you a dedicated number that receives your
            forwarded calls. Your AI assistant answers when you&apos;re busy or
            don&apos;t pick up.
          </p>
          {forwardError && (
            <p className="text-sm text-destructive">{forwardError}</p>
          )}
          <Button onClick={handleSetupForward} disabled={!businessNumber}>
            Set up forwarding number
          </Button>
        </div>
      )}

      {/* Provisioning in progress */}
      {forwardStatus === "provisioning" && (
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm">
            Provisioning your forwarding number...
          </span>
        </div>
      )}

      {/* Error state */}
      {forwardStatus === "error" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {forwardError || "Failed to set up forwarding. Please try again."}
          </div>
          <Button variant="outline" onClick={handleSetupForward}>
            Retry
          </Button>
        </div>
      )}

      {/* Success: show the forwarding number and instructions */}
      {(forwardStatus === "provisioned" || forwardStatus === "verified") &&
        forwardNumber && (
          <div className="space-y-6">
            {/* Forwarding number display */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                Forward your calls to:
              </p>
              <div className="mt-1 flex items-center gap-2">
                <p className="font-mono text-lg font-semibold">
                  {forwardNumber}
                </p>
                <button
                  type="button"
                  onClick={() => copyToClipboard(forwardNumber)}
                  className="rounded p-1 hover:bg-muted"
                  title="Copy number"
                >
                  <Copy className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Your AI assistant answers calls forwarded to this number when
                you&apos;re busy or don&apos;t pick up
              </p>
            </div>

            {/* Carrier selection and instructions */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="forward-carrier" className="text-xs">
                  Select your carrier for setup instructions
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
                <p className="text-sm font-medium">Setup instructions:</p>
                <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                  {FORWARDING_INSTRUCTIONS[forwardCarrier]?.steps.map(
                    (step, i) => (
                      <li key={i}>
                        {step.replace("FORWARDING_NUMBER", forwardNumber)}
                      </li>
                    ),
                  )}
                </ol>
                {FORWARDING_INSTRUCTIONS[forwardCarrier]?.note && (
                  <p className="mt-2 text-xs text-muted-foreground/80">
                    {FORWARDING_INSTRUCTIONS[forwardCarrier].note}
                  </p>
                )}
              </div>
            </div>

            {/* Verify button */}
            {forwardStatus === "provisioned" && (
              <Button variant="outline" onClick={handleVerifyForward}>
                <CheckCircle className="mr-2 h-4 w-4" />
                I&apos;ve set up forwarding
              </Button>
            )}

            {forwardStatus === "verified" && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-50 p-3 dark:bg-green-950/20">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Forwarding verified
                </span>
              </div>
            )}
          </div>
        )}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          How would you like to receive calls?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Set up how your phone number connects to your assistant
        </p>
      </div>

      {/* Setup type selection */}
      <div className="grid gap-4 sm:grid-cols-2">
        {PHONE_OPTIONS.map((option) => (
          <SelectionCard
            key={option.type}
            selected={setupType === option.type}
            onClick={() => handleSetupTypeSelect(option.type)}
            icon={option.icon}
            title={option.title}
            description={option.description}
            badge={option.badge}
          />
        ))}
      </div>

      {/* Setup-specific flows */}
      <div>
        {setupType === "new" && renderNewNumberFlow()}
        {setupType === "port" && renderPortNumberFlow()}
        {setupType === "forward" && renderForwardFlow()}
      </div>

      {/* Provision error (shown near Continue for auto-provision failures) */}
      {provisionError && (
        <p className="text-sm text-destructive">{provisionError}</p>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!canContinue || isSubmitting || provisioningNumber}
          size="lg"
        >
          {provisioningNumber
            ? "Setting up number..."
            : isSubmitting
              ? "Saving..."
              : "Continue"}
        </Button>
      </div>
    </div>
  );
}
