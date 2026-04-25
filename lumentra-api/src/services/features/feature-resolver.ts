/**
 * Feature Resolution Service
 *
 * 3-layer merge: tier_defaults MERGE overrides INTERSECT capabilities
 *
 * 1. Start with tier defaults (what the subscription plan includes)
 * 2. Apply tenant_feature_overrides (platform admin can enable/disable)
 * 3. Intersect with tenant_capabilities (what the tenant has configured)
 *
 * Page visibility is then filtered by member's allowed_pages.
 */

import { queryAll } from "../database/client.js";

// Feature keys that map to dashboard pages/sections
export type FeatureKey =
  | "dashboard"
  | "calls"
  | "chats"
  | "calendar"
  | "contacts";

// All possible feature keys
export const ALL_FEATURES: FeatureKey[] = [
  "dashboard",
  "calls",
  "chats",
  "calendar",
  "contacts",
];

// Features included per subscription tier
// Scope: call monitoring + chat monitoring + bookings (call + chat)
// Settings/profile always shown; platform admins use /admin routes.
const TIER_DEFAULTS: Record<string, FeatureKey[]> = {
  starter: ["dashboard", "calls", "chats", "calendar", "contacts"],
  professional: ["dashboard", "calls", "chats", "calendar", "contacts"],
  enterprise: ["dashboard", "calls", "chats", "calendar", "contacts"],
};

interface OverrideRow {
  feature_key: string;
  enabled: boolean;
}

/**
 * Resolve which features are available for a tenant.
 *
 * @param tier - subscription tier (starter/professional/enterprise)
 * @param tenantId - tenant UUID for looking up overrides
 * @returns Set of enabled feature keys
 */
export async function resolveFeatures(
  tier: string,
  tenantId: string,
): Promise<Set<FeatureKey>> {
  // Layer 1: Tier defaults
  const tierFeatures = new Set<FeatureKey>(
    TIER_DEFAULTS[tier] || TIER_DEFAULTS.starter,
  );

  // Layer 2: Apply overrides from tenant_feature_overrides
  const overrides = await queryAll<OverrideRow>(
    `SELECT feature_key, enabled FROM tenant_feature_overrides WHERE tenant_id = $1`,
    [tenantId],
  );

  if (overrides) {
    for (const override of overrides) {
      const key = override.feature_key as FeatureKey;
      if (override.enabled) {
        tierFeatures.add(key);
      } else {
        tierFeatures.delete(key);
      }
    }
  }

  return tierFeatures;
}

/**
 * Filter available features by a member's allowed_pages restriction.
 *
 * @param features - tenant-level resolved features
 * @param allowedPages - member's allowed_pages (null = full access)
 * @returns Array of page keys this member can see
 */
export function filterByAllowedPages(
  features: Set<FeatureKey>,
  allowedPages: string[] | null | undefined,
): FeatureKey[] {
  const featureArray = Array.from(features);

  // NULL = full access
  if (!allowedPages || allowedPages.length === 0) {
    return featureArray;
  }

  return featureArray.filter((f) => allowedPages.includes(f));
}

/**
 * Full resolution: tenant features filtered by member access.
 */
export async function resolveMemberFeatures(
  tier: string,
  tenantId: string,
  allowedPages: string[] | null | undefined,
): Promise<FeatureKey[]> {
  const tenantFeatures = await resolveFeatures(tier, tenantId);
  return filterByAllowedPages(tenantFeatures, allowedPages);
}

export { TIER_DEFAULTS };
