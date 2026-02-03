"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Link,
  Check,
  MessageSquare,
  Calendar,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSetup } from "../SetupContext";
import type { IntegrationProvider } from "@/types";

// Aceternity & MagicUI components
import { WobbleCard } from "@/components/aceternity/wobble-card";
import { TextGenerateEffect } from "@/components/aceternity/text-generate-effect";
import { SpotlightNew } from "@/components/aceternity/spotlight";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { ShineBorder } from "@/components/magicui/shine-border";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface IntegrationOption {
  id: IntegrationProvider;
  name: string;
  description: string;
  logo?: string;
  type: "calendar" | "booking" | "pos";
  industries?: string[];
}

const INTEGRATION_OPTIONS: IntegrationOption[] = [
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Sync appointments with Google Calendar",
    type: "calendar",
  },
  {
    id: "outlook",
    name: "Microsoft Outlook",
    description: "Sync with Outlook Calendar",
    type: "calendar",
  },
  {
    id: "calendly",
    name: "Calendly",
    description: "Connect your Calendly scheduling",
    type: "booking",
  },
  {
    id: "acuity",
    name: "Acuity Scheduling",
    description: "Sync with Acuity appointments",
    type: "booking",
  },
  {
    id: "square",
    name: "Square Appointments",
    description: "Connect Square for scheduling",
    type: "booking",
  },
  {
    id: "vagaro",
    name: "Vagaro",
    description: "Salon & spa scheduling",
    type: "booking",
    industries: ["salon", "spa", "barbershop"],
  },
  {
    id: "mindbody",
    name: "Mindbody",
    description: "Fitness & wellness booking",
    type: "booking",
    industries: ["fitness", "spa"],
  },
  {
    id: "toast",
    name: "Toast",
    description: "Restaurant management",
    type: "pos",
    industries: ["restaurant", "pizza", "catering"],
  },
  {
    id: "opentable",
    name: "OpenTable",
    description: "Restaurant reservations",
    type: "booking",
    industries: ["restaurant"],
  },
];

type IntegrationMode = "external" | "builtin" | "assisted";

const MODE_OPTIONS: {
  id: IntegrationMode;
  title: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    id: "external",
    title: "Yes, I use something else",
    description: "Connect your existing booking or calendar system",
    icon: Link,
  },
  {
    id: "builtin",
    title: "No, I'll use Lumentra",
    description: "Use our built-in scheduling system",
    icon: Calendar,
  },
  {
    id: "assisted",
    title: "Just take messages for now",
    description: "Collect caller info and confirm bookings manually",
    icon: MessageSquare,
  },
];

export function IntegrationsStep() {
  const router = useRouter();
  const { state, dispatch, saveStep, goToNextStep, goToPreviousStep } =
    useSetup();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(
    state.integrationMode === "external",
  );

  const industry = state.businessData.industry;

  // Filter integrations relevant to this industry
  const availableIntegrations = INTEGRATION_OPTIONS.filter((integration) => {
    if (!integration.industries) return true;
    return industry && integration.industries.includes(industry);
  });

  // Group by type
  const calendarIntegrations = availableIntegrations.filter(
    (i) => i.type === "calendar",
  );
  const bookingIntegrations = availableIntegrations.filter(
    (i) => i.type === "booking",
  );
  const posIntegrations = availableIntegrations.filter((i) => i.type === "pos");

  const canContinue = state.integrationMode !== null;

  const handleModeSelect = (mode: IntegrationMode) => {
    dispatch({ type: "SET_INTEGRATION_MODE", payload: mode });
    if (mode === "external") {
      setShowIntegrations(true);
    } else {
      setShowIntegrations(false);
    }
  };

  const handleConnect = (provider: IntegrationProvider) => {
    // Open OAuth in new window
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      `${API_URL}/api/integrations/${provider}/authorize`,
      "oauth",
      `width=${width},height=${height},left=${left},top=${top}`,
    );

    // Listen for message from callback
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== API_URL) return;

      if (event.data.type === "oauth_success") {
        // Refresh integrations list
        dispatch({
          type: "SET_INTEGRATIONS",
          payload: [
            ...state.integrations,
            {
              id: `int_${Date.now()}`,
              tenant_id: state.tenantId || "",
              provider,
              status: "active",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        });
        popup?.close();
      } else if (event.data.type === "oauth_error") {
        console.error("OAuth error:", event.data.error);
        popup?.close();
      }

      window.removeEventListener("message", handleMessage);
    };

    window.addEventListener("message", handleMessage);
  };

  const handleDisconnect = (provider: IntegrationProvider) => {
    dispatch({
      type: "SET_INTEGRATIONS",
      payload: state.integrations.filter((i) => i.provider !== provider),
    });
  };

  const isConnected = (provider: IntegrationProvider) => {
    return state.integrations.some(
      (i) => i.provider === provider && i.status === "active",
    );
  };

  const handleContinue = async () => {
    if (!canContinue) return;

    setIsSubmitting(true);
    const success = await saveStep("integrations");
    if (success) {
      goToNextStep();
      router.push("/setup/assistant");
    }
    setIsSubmitting(false);
  };

  const handleBack = () => {
    goToPreviousStep();
    router.push("/setup/details");
  };

  const renderIntegrationCard = (integration: IntegrationOption) => {
    const connected = isConnected(integration.id);

    return (
      <div
        key={integration.id}
        className={cn(
          "flex items-center justify-between rounded-lg border p-4",
          connected && "border-green-500/50 bg-green-50 dark:bg-green-950/20",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{integration.name}</p>
            <p className="text-sm text-muted-foreground">
              {integration.description}
            </p>
          </div>
        </div>
        {connected ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Connected
            </span>
            <button
              type="button"
              onClick={() => handleDisconnect(integration.id)}
              className="text-sm text-muted-foreground hover:text-destructive"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleConnect(integration.id)}
          >
            Connect
            <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  const modeColors: Record<IntegrationMode, string> = {
    external: "bg-blue-800",
    builtin: "bg-emerald-800",
    assisted: "bg-purple-800",
  };

  return (
    <div className="relative space-y-8">
      <SpotlightNew className="opacity-20" />

      {/* Header */}
      <div className="relative z-10">
        <TextGenerateEffect
          words={
            showIntegrations
              ? "Connect your systems"
              : "Do you use a booking or calendar system?"
          }
          className="text-2xl md:text-3xl text-foreground"
          duration={0.3}
        />
        <p className="mt-2 text-muted-foreground">
          {showIntegrations
            ? "Link your existing tools so your assistant can manage real bookings"
            : "This helps us set up how your assistant handles appointments"}
        </p>
      </div>

      {!showIntegrations ? (
        /* Mode selection with wobble cards */
        <div className="relative z-10 grid gap-4 md:grid-cols-3">
          {MODE_OPTIONS.map((mode) => {
            const isSelected = state.integrationMode === mode.id;
            const Icon = mode.icon;

            return (
              <div key={mode.id} className="relative">
                {isSelected && (
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary via-primary/50 to-primary opacity-75 blur-sm" />
                )}
                <WobbleCard
                  containerClassName={cn(
                    "min-h-[160px] cursor-pointer relative",
                    isSelected ? "bg-primary" : modeColors[mode.id],
                  )}
                  className="p-4"
                >
                  <button
                    type="button"
                    onClick={() => handleModeSelect(mode.id)}
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
                      {mode.title}
                    </h3>
                    <p className="mt-1 text-sm text-white/70">
                      {mode.description}
                    </p>
                  </button>
                </WobbleCard>
              </div>
            );
          })}
        </div>
      ) : (
        /* Integration selection */
        <div className="space-y-6">
          {/* Back to mode selection */}
          <button
            type="button"
            onClick={() => setShowIntegrations(false)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Change selection
          </button>

          {/* Calendar integrations */}
          {calendarIntegrations.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Calendars
              </h2>
              <div className="space-y-2">
                {calendarIntegrations.map(renderIntegrationCard)}
              </div>
            </div>
          )}

          {/* Booking integrations */}
          {bookingIntegrations.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Booking Systems
              </h2>
              <div className="space-y-2">
                {bookingIntegrations.map(renderIntegrationCard)}
              </div>
            </div>
          )}

          {/* POS integrations */}
          {posIntegrations.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Point of Sale
              </h2>
              <div className="space-y-2">
                {posIntegrations.map(renderIntegrationCard)}
              </div>
            </div>
          )}

          {/* Don't see your system */}
          <div className="rounded-lg border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t see your system? Your assistant will collect caller
              information and you&apos;ll confirm bookings manually.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              We add new integrations regularly.
            </p>
          </div>
        </div>
      )}

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
