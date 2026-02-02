import { Hono } from "hono";
import { getSupabase } from "../services/database/client.js";
import { getAuthUserId } from "../middleware/index.js";
import { invalidateTenant } from "../services/database/tenant-cache.js";
import type { SetupStep } from "../types/database.js";

export const setupRoutes = new Hono();

const SETUP_STEPS: SetupStep[] = [
  "business",
  "capabilities",
  "details",
  "integrations",
  "assistant",
  "phone",
  "hours",
  "escalation",
  "review",
];

function getNextStep(currentStep: SetupStep): SetupStep | null {
  const idx = SETUP_STEPS.indexOf(currentStep);
  if (idx === -1 || idx >= SETUP_STEPS.length - 1) return null;
  return SETUP_STEPS[idx + 1];
}

/**
 * GET /api/setup/progress
 * Returns current setup step and saved data for resuming
 */
setupRoutes.get("/progress", async (c) => {
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Get tenant the user owns (for setup, we need owner role)
  const { data: membership } = await db
    .from("tenant_members")
    .select(
      `
      tenant_id,
      role,
      tenants (
        id,
        business_name,
        industry,
        location_city,
        location_address,
        agent_name,
        agent_personality,
        voice_config,
        greeting_standard,
        greeting_after_hours,
        greeting_returning,
        timezone,
        operating_hours,
        escalation_enabled,
        escalation_phone,
        escalation_triggers,
        features,
        setup_step,
        setup_completed_at,
        status,
        assisted_mode,
        after_hours_behavior,
        transfer_behavior
      )
    `,
    )
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("is_active", true)
    .maybeSingle();

  // No tenant yet - start fresh
  if (!membership || !membership.tenants) {
    return c.json({
      step: "business",
      completed: false,
      data: {},
    });
  }

  const tenant = Array.isArray(membership.tenants)
    ? membership.tenants[0]
    : membership.tenants;

  // Get capabilities
  const { data: capabilities } = await db
    .from("tenant_capabilities")
    .select("capability, config, is_enabled")
    .eq("tenant_id", tenant.id);

  // Get phone configuration
  const { data: phoneConfig } = await db
    .from("phone_configurations")
    .select("*")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  // Get escalation contacts
  const { data: escalationContacts } = await db
    .from("escalation_contacts")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("sort_order", { ascending: true });

  // Get integrations
  const { data: integrations } = await db
    .from("tenant_integrations")
    .select("provider, status, external_account_id")
    .eq("tenant_id", tenant.id);

  return c.json({
    step: tenant.setup_step || "business",
    completed: !!tenant.setup_completed_at,
    tenantId: tenant.id,
    data: {
      // Business step
      business_name: tenant.business_name,
      industry: tenant.industry,
      location_city: tenant.location_city,
      location_address: tenant.location_address,
      // Capabilities step
      capabilities: capabilities || [],
      // Integrations step
      integrations: integrations || [],
      assisted_mode: tenant.assisted_mode,
      // Assistant step
      agent_name: tenant.agent_name,
      agent_personality: tenant.agent_personality,
      voice_config: tenant.voice_config,
      greeting_standard: tenant.greeting_standard,
      greeting_after_hours: tenant.greeting_after_hours,
      greeting_returning: tenant.greeting_returning,
      // Phone step
      phone_config: phoneConfig,
      // Hours step
      timezone: tenant.timezone,
      operating_hours: tenant.operating_hours,
      after_hours_behavior: tenant.after_hours_behavior,
      // Escalation step
      escalation_enabled: tenant.escalation_enabled,
      escalation_phone: tenant.escalation_phone,
      escalation_triggers: tenant.escalation_triggers,
      escalation_contacts: escalationContacts || [],
      transfer_behavior: tenant.transfer_behavior,
      // Features
      features: tenant.features,
    },
  });
});

/**
 * PUT /api/setup/step/:step
 * Saves data for a specific step
 */
setupRoutes.put("/step/:step", async (c) => {
  const step = c.req.param("step") as SetupStep;
  const body = await c.req.json();
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Validate step parameter
  if (!SETUP_STEPS.includes(step)) {
    return c.json({ error: "Invalid step" }, 400);
  }

  // Get or create tenant
  let tenantId: string;

  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("is_active", true)
    .maybeSingle();

  if (step === "business") {
    // Validate required business fields
    if (!body.business_name || !body.industry) {
      return c.json({ error: "business_name and industry are required" }, 400);
    }

    if (membership) {
      // Update existing tenant
      tenantId = membership.tenant_id;
      const { error } = await db
        .from("tenants")
        .update({
          business_name: body.business_name,
          industry: body.industry,
          location_city: body.location_city || null,
          location_address: body.location_address || null,
          setup_step: getNextStep(step) || step,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId);

      if (error) {
        return c.json({ error: error.message }, 500);
      }
    } else {
      // Create new tenant with minimal data
      const { data: newTenant, error: tenantError } = await db
        .from("tenants")
        .insert({
          business_name: body.business_name,
          industry: body.industry,
          location_city: body.location_city || null,
          location_address: body.location_address || null,
          phone_number: `pending_${Date.now()}`, // Temporary placeholder
          setup_step: getNextStep(step) || step,
          status: "draft",
        })
        .select()
        .single();

      if (tenantError) {
        return c.json({ error: tenantError.message }, 500);
      }

      tenantId = newTenant.id;

      // Create membership for the user as owner
      const { error: membershipError } = await db
        .from("tenant_members")
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          role: "owner",
          accepted_at: new Date().toISOString(),
        });

      if (membershipError) {
        // Rollback
        await db.from("tenants").delete().eq("id", tenantId);
        return c.json({ error: "Failed to create tenant membership" }, 500);
      }
    }
  } else {
    // All other steps require existing tenant
    if (!membership) {
      return c.json(
        { error: "No tenant found. Complete business step first." },
        400,
      );
    }
    tenantId = membership.tenant_id;
  }

  // Handle step-specific data
  switch (step) {
    case "capabilities": {
      if (!body.capabilities || !Array.isArray(body.capabilities)) {
        return c.json({ error: "capabilities array is required" }, 400);
      }

      // Delete existing capabilities
      await db.from("tenant_capabilities").delete().eq("tenant_id", tenantId);

      // Insert new capabilities
      if (body.capabilities.length > 0) {
        const capabilities = body.capabilities.map(
          (
            cap:
              | string
              | { capability: string; config?: Record<string, unknown> },
          ) => ({
            tenant_id: tenantId,
            capability: typeof cap === "string" ? cap : cap.capability,
            config: typeof cap === "object" ? cap.config || {} : {},
            is_enabled: true,
          }),
        );

        const { error } = await db
          .from("tenant_capabilities")
          .insert(capabilities);

        if (error) {
          return c.json({ error: error.message }, 500);
        }
      }

      await db
        .from("tenants")
        .update({
          setup_step: getNextStep(step) || step,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId);
      break;
    }

    case "details": {
      // Update capability configs
      if (body.capability_details) {
        for (const [capability, config] of Object.entries(
          body.capability_details as Record<string, Record<string, unknown>>,
        )) {
          await db
            .from("tenant_capabilities")
            .update({ config })
            .eq("tenant_id", tenantId)
            .eq("capability", capability);
        }
      }

      await db
        .from("tenants")
        .update({
          setup_step: getNextStep(step) || step,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId);
      break;
    }

    case "integrations": {
      await db
        .from("tenants")
        .update({
          assisted_mode: body.integration_mode === "assisted",
          setup_step: getNextStep(step) || step,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId);
      break;
    }

    case "assistant": {
      const updateData: Record<string, unknown> = {
        setup_step: getNextStep(step) || step,
        updated_at: new Date().toISOString(),
      };

      if (body.agent_name) updateData.agent_name = body.agent_name;
      if (body.agent_personality)
        updateData.agent_personality = body.agent_personality;
      if (body.voice_config) updateData.voice_config = body.voice_config;
      if (body.greeting_standard)
        updateData.greeting_standard = body.greeting_standard;
      if (body.greeting_after_hours !== undefined)
        updateData.greeting_after_hours = body.greeting_after_hours;
      if (body.greeting_returning !== undefined)
        updateData.greeting_returning = body.greeting_returning;

      await db.from("tenants").update(updateData).eq("id", tenantId);
      break;
    }

    case "phone": {
      // Phone setup is handled by separate phone config API
      // Just advance the step
      await db
        .from("tenants")
        .update({
          setup_step: getNextStep(step) || step,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId);
      break;
    }

    case "hours": {
      const updateData: Record<string, unknown> = {
        setup_step: getNextStep(step) || step,
        updated_at: new Date().toISOString(),
      };

      if (body.timezone) updateData.timezone = body.timezone;
      if (body.operating_hours)
        updateData.operating_hours = body.operating_hours;
      if (body.after_hours_behavior)
        updateData.after_hours_behavior = body.after_hours_behavior;

      await db.from("tenants").update(updateData).eq("id", tenantId);
      break;
    }

    case "escalation": {
      const updateData: Record<string, unknown> = {
        setup_step: getNextStep(step) || step,
        updated_at: new Date().toISOString(),
      };

      if (body.escalation_enabled !== undefined)
        updateData.escalation_enabled = body.escalation_enabled;
      if (body.escalation_phone !== undefined)
        updateData.escalation_phone = body.escalation_phone;
      if (body.escalation_triggers)
        updateData.escalation_triggers = body.escalation_triggers;
      if (body.transfer_behavior)
        updateData.transfer_behavior = body.transfer_behavior;

      await db.from("tenants").update(updateData).eq("id", tenantId);

      // Handle contacts if provided
      if (body.contacts && Array.isArray(body.contacts)) {
        // Delete existing contacts
        await db.from("escalation_contacts").delete().eq("tenant_id", tenantId);

        // Insert new contacts
        if (body.contacts.length > 0) {
          const contacts = body.contacts.map(
            (
              contact: {
                name: string;
                phone: string;
                role?: string;
                is_primary?: boolean;
                availability?: string;
                availability_hours?: Record<string, unknown>;
              },
              idx: number,
            ) => ({
              tenant_id: tenantId,
              name: contact.name,
              phone: contact.phone,
              role: contact.role || null,
              is_primary: contact.is_primary || idx === 0,
              availability: contact.availability || "business_hours",
              availability_hours: contact.availability_hours || null,
              sort_order: idx,
            }),
          );

          const { error } = await db
            .from("escalation_contacts")
            .insert(contacts);

          if (error) {
            return c.json({ error: error.message }, 500);
          }
        }
      }
      break;
    }

    case "review": {
      // Just save the step - completion is via separate endpoint
      await db
        .from("tenants")
        .update({
          setup_step: step,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId);
      break;
    }
  }

  // Invalidate cache
  await invalidateTenant(tenantId);

  return c.json({
    success: true,
    nextStep: getNextStep(step),
  });
});

/**
 * POST /api/setup/complete
 * Finalizes setup and launches agent
 */
setupRoutes.post("/complete", async (c) => {
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Get tenant
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "No tenant found" }, 400);
  }

  const tenantId = membership.tenant_id;

  // Get tenant to verify setup state
  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant) {
    return c.json({ error: "Tenant not found" }, 404);
  }

  // Verify required data is present
  if (!tenant.business_name || !tenant.industry) {
    return c.json({ error: "Business information incomplete" }, 400);
  }

  // Check phone configuration
  const { data: phoneConfig } = await db
    .from("phone_configurations")
    .select("phone_number, status")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  // Update tenant to active
  const { error: updateError } = await db
    .from("tenants")
    .update({
      status: "active",
      setup_completed_at: new Date().toISOString(),
      is_active: true,
      // Update phone number from phone_configurations if available
      ...(phoneConfig?.phone_number && {
        phone_number: phoneConfig.phone_number,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (updateError) {
    return c.json({ error: updateError.message }, 500);
  }

  // Invalidate cache
  await invalidateTenant(tenantId);

  return c.json({
    success: true,
    tenantId,
  });
});

/**
 * POST /api/setup/go-back
 * Navigate to a previous step
 */
setupRoutes.post("/go-back", async (c) => {
  const body = await c.req.json();
  const userId = getAuthUserId(c);
  const db = getSupabase();

  const targetStep = body.step as SetupStep;

  if (!SETUP_STEPS.includes(targetStep)) {
    return c.json({ error: "Invalid step" }, 400);
  }

  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "No tenant found" }, 400);
  }

  await db
    .from("tenants")
    .update({
      setup_step: targetStep,
      updated_at: new Date().toISOString(),
    })
    .eq("id", membership.tenant_id);

  await invalidateTenant(membership.tenant_id);

  return c.json({ success: true, step: targetStep });
});
