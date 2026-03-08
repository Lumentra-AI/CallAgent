"use client";

import React from "react";
import { useConfig } from "@/context/ConfigContext";
import { Calendar, Database, MessageSquare, Cloud, Plug } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// INTEGRATIONS DATA
// ============================================================================

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: "calendar" | "pms" | "messaging" | "crm";
}

const INTEGRATIONS: Integration[] = [
  // Calendar
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Sync appointments",
    icon: Calendar,
    category: "calendar",
  },
  {
    id: "calendly",
    name: "Calendly",
    description: "Booking integration",
    icon: Calendar,
    category: "calendar",
  },
  {
    id: "acuity",
    name: "Acuity Scheduling",
    description: "Appointment management",
    icon: Calendar,
    category: "calendar",
  },

  // PMS (Hotel)
  {
    id: "cloudbeds",
    name: "Cloudbeds",
    description: "Property management",
    icon: Database,
    category: "pms",
  },
  {
    id: "opera",
    name: "Oracle Opera",
    description: "Enterprise PMS",
    icon: Database,
    category: "pms",
  },
  {
    id: "guesty",
    name: "Guesty",
    description: "Vacation rentals",
    icon: Database,
    category: "pms",
  },

  // Messaging
  {
    id: "twilio",
    name: "Twilio",
    description: "SMS notifications",
    icon: MessageSquare,
    category: "messaging",
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description: "Email delivery",
    icon: MessageSquare,
    category: "messaging",
  },

  // CRM
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Customer data sync",
    icon: Cloud,
    category: "crm",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Marketing CRM",
    icon: Cloud,
    category: "crm",
  },
];

const CATEGORIES = [
  { id: "calendar", label: "Calendar & Scheduling" },
  { id: "pms", label: "Property Management" },
  { id: "messaging", label: "Messaging" },
  { id: "crm", label: "CRM" },
];

// ============================================================================
// INTEGRATIONS TAB COMPONENT
// ============================================================================

export default function IntegrationsTab() {
  const { config } = useConfig();

  if (!config) return null;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white">Integrations</h3>
        <p className="text-sm text-zinc-500">
          Connect third-party services to extend your AI agent capabilities
        </p>
      </div>

      {/* Coming Soon Notice */}
      <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700/30">
          <Plug className="h-5 w-5 text-zinc-400" />
        </div>
        <div>
          <div className="text-sm font-medium text-white">
            Integrations are coming soon
          </div>
          <div className="text-xs text-zinc-500">
            Connect third-party services to extend your AI agent.
          </div>
        </div>
      </div>

      {/* Categories */}
      {CATEGORIES.map((category) => {
        const categoryIntegrations = INTEGRATIONS.filter(
          (i) => i.category === category.id,
        );

        // Only show relevant categories based on industry
        if (category.id === "pms" && config.industry !== "hotel") return null;

        return (
          <section key={category.id} className="space-y-4">
            <div className="border-b border-zinc-800 pb-2">
              <h4 className="text-sm font-medium text-white">
                {category.label}
              </h4>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {categoryIntegrations.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ============================================================================
// INTEGRATION CARD COMPONENT
// ============================================================================

function IntegrationCard({ integration }: { integration: Integration }) {
  const Icon = integration.icon;

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-4",
        "border-zinc-800 bg-zinc-900",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg border",
            "border-zinc-700 bg-zinc-800",
          )}
        >
          <Icon className="h-5 w-5 text-zinc-400" />
        </div>
        <div>
          <div className="text-sm font-medium text-white">
            {integration.name}
          </div>
          <div className="text-xs text-zinc-500">{integration.description}</div>
        </div>
      </div>

      <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
        Coming Soon
      </span>
    </div>
  );
}
