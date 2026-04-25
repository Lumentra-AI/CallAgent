"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { get } from "@/lib/api/client";
import { useTenant } from "@/context/TenantContext";

// Feature keys matching the API
export type FeatureKey =
  | "dashboard"
  | "calls"
  | "chats"
  | "calendar"
  | "contacts";

interface FeaturesResponse {
  features: FeatureKey[];
  tier: string;
  restricted: boolean;
}

interface FeatureContextType {
  features: FeatureKey[];
  tier: string;
  restricted: boolean;
  isLoading: boolean;
  hasFeature: (key: FeatureKey) => boolean;
  refreshFeatures: () => Promise<void>;
}

const FeatureContext = createContext<FeatureContextType | null>(null);

// Default features shown while loading
const DEFAULT_FEATURES: FeatureKey[] = [
  "dashboard",
  "calls",
  "chats",
  "calendar",
  "contacts",
];

export function FeatureProvider({ children }: { children: ReactNode }) {
  const { currentTenant } = useTenant();
  const [features, setFeatures] = useState<FeatureKey[]>(DEFAULT_FEATURES);
  const [tier, setTier] = useState("starter");
  const [restricted, setRestricted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFeatures = useCallback(async () => {
    if (!currentTenant) return;

    try {
      const data = await get<FeaturesResponse>("/api/features");
      setFeatures(data.features);
      setTier(data.tier);
      setRestricted(data.restricted);
    } catch (err) {
      console.error("[FEATURES] Failed to fetch features:", err);
      // Keep defaults on error
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant]);

  useEffect(() => {
    if (currentTenant) {
      setIsLoading(true);
      fetchFeatures();
    }
  }, [currentTenant, fetchFeatures]);

  const hasFeature = useCallback(
    (key: FeatureKey) => features.includes(key),
    [features],
  );

  const value = useMemo<FeatureContextType>(
    () => ({
      features,
      tier,
      restricted,
      isLoading,
      hasFeature,
      refreshFeatures: fetchFeatures,
    }),
    [features, tier, restricted, isLoading, hasFeature, fetchFeatures],
  );

  return (
    <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>
  );
}

export function useFeatures() {
  const context = useContext(FeatureContext);
  if (!context) {
    throw new Error("useFeatures must be used within a FeatureProvider");
  }
  return context;
}
