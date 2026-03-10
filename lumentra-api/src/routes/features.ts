/**
 * Feature Resolution Routes
 *
 * GET /api/features - Returns resolved features for the current user+tenant
 */

import { Hono } from "hono";
import { getAuthContext } from "../middleware/index.js";
import { queryOne } from "../services/database/client.js";
import {
  resolveMemberFeatures,
  TIER_DEFAULTS,
} from "../services/features/feature-resolver.js";

export const featuresRoutes = new Hono();

interface TenantTierRow {
  subscription_tier: string;
}

interface MemberRow {
  allowed_pages: string[] | null;
}

/**
 * GET /api/features
 * Returns the resolved feature set for the authenticated user in their current tenant.
 * Combines tier defaults + admin overrides, filtered by member's allowed_pages.
 */
featuresRoutes.get("/", async (c) => {
  const auth = getAuthContext(c);

  try {
    // Get tenant tier
    const tenant = await queryOne<TenantTierRow>(
      `SELECT subscription_tier FROM tenants WHERE id = $1`,
      [auth.tenantId],
    );

    if (!tenant) {
      return c.json({ error: "Tenant not found" }, 404);
    }

    // Get member's allowed_pages
    const member = await queryOne<MemberRow>(
      `SELECT allowed_pages FROM tenant_members
       WHERE user_id = $1 AND tenant_id = $2 AND is_active = true`,
      [auth.userId, auth.tenantId],
    );

    const features = await resolveMemberFeatures(
      tenant.subscription_tier,
      auth.tenantId,
      member?.allowed_pages,
    );

    return c.json({
      features,
      tier: tenant.subscription_tier,
      restricted: member?.allowed_pages != null,
    });
  } catch (error) {
    console.error("[FEATURES] Error resolving features:", error);
    return c.json({ error: "Failed to resolve features" }, 500);
  }
});

/**
 * GET /api/features/tier-defaults
 * Returns the default features for each subscription tier.
 * Useful for the team management UI to show what's available.
 */
featuresRoutes.get("/tier-defaults", async (c) => {
  return c.json({ tiers: TIER_DEFAULTS });
});
