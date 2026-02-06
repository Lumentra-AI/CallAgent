"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { INDUSTRY_PRESETS } from "@/lib/industryPresets";
import type { IndustryPreset, IndustryType } from "@/types";

// Fallback preset for unknown industries
const DEFAULT_INDUSTRY: IndustryType = "restaurant";

interface TenantInfo {
  id: string;
  industry: IndustryType;
  business_name: string;
  agent_name: string;
}

interface IndustryContextValue {
  // Core data
  industry: IndustryType;
  preset: IndustryPreset;
  tenant: TenantInfo | null;

  // Terminology shortcuts
  transactionLabel: string;
  transactionPluralLabel: string;
  customerLabel: string;
  customerPluralLabel: string;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Check if industry is fully supported
  isSupported: boolean;
}

const IndustryContext = createContext<IndustryContextValue | undefined>(
  undefined,
);

// Supported (priority) industries
const SUPPORTED_INDUSTRIES = new Set<IndustryType>([
  "medical",
  "dental",
  "hotel",
  "motel",
  "restaurant",
  "salon",
  "auto_service",
]);

interface IndustryProviderProps {
  children: ReactNode;
}

export function IndustryProvider({ children }: IndustryProviderProps) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTenant() {
      try {
        const tenantId = process.env.NEXT_PUBLIC_TENANT_ID;
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

        if (!tenantId) {
          // No tenant configured - use default
          setTenant({
            id: "default",
            industry: DEFAULT_INDUSTRY,
            business_name: "Demo Business",
            agent_name: "Assistant",
          });
          setIsLoading(false);
          return;
        }

        const response = await fetch(`${apiUrl}/api/tenants/${tenantId}`, {
          headers: {
            "X-Tenant-ID": tenantId,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch tenant");
        }

        const data = await response.json();
        setTenant({
          id: data.id,
          industry: data.industry as IndustryType,
          business_name: data.business_name,
          agent_name: data.agent_name || "Assistant",
        });
      } catch (err) {
        console.error("Failed to load tenant:", err);
        setError(err instanceof Error ? err.message : "Failed to load tenant");
        // Set fallback tenant on error
        setTenant({
          id: "fallback",
          industry: DEFAULT_INDUSTRY,
          business_name: "Business",
          agent_name: "Assistant",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchTenant();
  }, []);

  // Get preset for current industry (with fallback)
  const industry = tenant?.industry || DEFAULT_INDUSTRY;
  const preset =
    INDUSTRY_PRESETS[industry] || INDUSTRY_PRESETS[DEFAULT_INDUSTRY];
  const terminology = preset.terminology;

  const value: IndustryContextValue = {
    industry,
    preset,
    tenant,
    transactionLabel: terminology.transaction,
    transactionPluralLabel: terminology.transactionPlural,
    customerLabel: terminology.customer,
    customerPluralLabel: terminology.customerPlural,
    isLoading,
    error,
    isSupported: SUPPORTED_INDUSTRIES.has(industry),
  };

  return (
    <IndustryContext.Provider value={value}>
      {children}
    </IndustryContext.Provider>
  );
}

export function useIndustry() {
  const context = useContext(IndustryContext);
  if (context === undefined) {
    throw new Error("useIndustry must be used within an IndustryProvider");
  }
  return context;
}

// Helper hook for just terminology (simpler API)
export function useTerminology() {
  const { preset } = useIndustry();
  return preset.terminology;
}
