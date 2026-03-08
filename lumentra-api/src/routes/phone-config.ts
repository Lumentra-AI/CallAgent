import { Hono } from "hono";
import { queryOne, queryCount } from "../services/database/client.js";
import {
  insertOne,
  updateOne,
  upsert,
} from "../services/database/query-helpers.js";
import {
  getAuthUserId,
  getAuthTenantId,
  criticalRateLimit,
  strictRateLimit,
  requireRole,
} from "../middleware/index.js";
import { encryptIfNeeded } from "../services/crypto/encryption.js";
import { notifyAdmin } from "../services/notifications/admin-notify.js";
import {
  searchAvailableNumbers,
  provisionNumber,
  configureNumberWebhooks,
  releaseNumber,
} from "../services/signalwire/phone.js";
import {
  createSipEndpoint,
  configureSipRouting,
  deleteSipEndpoint,
  getSipEndpointStatus,
} from "../services/signalwire/sip.js";

export const phoneConfigRoutes = new Hono();

function withWebhookSecret(url: string): string {
  const secret = process.env.SIGNALWIRE_WEBHOOK_SECRET;
  if (!secret) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("webhook_secret", secret);
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Type definitions for database rows */
interface PhoneConfigRow {
  id: string;
  tenant_id: string;
  phone_number: string | null;
  setup_type: string;
  provider: string | null;
  provider_sid: string | null;
  status: string;
  verified_at: string | null;
  port_request_id: string | null;
}

interface PortRequestRow {
  id: string;
  tenant_id: string;
  phone_number: string;
  current_carrier: string;
  account_number: string | null;
  pin: string | null;
  authorized_name: string;
  status: string;
  estimated_completion: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  completed_at: string | null;
}

/**
 * Release the existing phone config for a tenant before re-provisioning.
 * Prevents orphaned numbers on SignalWire that keep billing.
 */
async function releaseExistingPhoneConfig(tenantId: string): Promise<void> {
  const existing = await queryOne<PhoneConfigRow>(
    "SELECT * FROM phone_configurations WHERE tenant_id = $1 LIMIT 1",
    [tenantId],
  );

  if (!existing || !existing.provider_sid) return;

  if (existing.setup_type === "sip") {
    const { error } = await deleteSipEndpoint(existing.provider_sid);
    if (error) {
      console.error("[PHONE] Failed to delete old SIP endpoint:", error);
    } else {
      console.info(
        `[PHONE] Released old SIP endpoint ${existing.provider_sid} for tenant ${tenantId}`,
      );
    }
  } else {
    const { error } = await releaseNumber(existing.provider_sid);
    if (error) {
      console.error("[PHONE] Failed to release old number:", error);
    } else {
      console.info(
        `[PHONE] Released old number ${existing.phone_number} (SID: ${existing.provider_sid}) for tenant ${tenantId}`,
      );
    }
  }
}

const DAILY_PROVISION_LIMIT = 3;

/**
 * Check if a tenant has hit their daily provisioning limit (3/day).
 */
async function checkDailyProvisionLimit(tenantId: string): Promise<boolean> {
  const count = await queryCount(
    `SELECT COUNT(*) FROM phone_provision_log
     WHERE tenant_id = $1
       AND action IN ('provision', 'forward', 'sip')
       AND created_at > NOW() - INTERVAL '24 hours'`,
    [tenantId],
  );
  return count >= DAILY_PROVISION_LIMIT;
}

/**
 * Log a provisioning action for audit and daily limit enforcement.
 */
async function logProvisionAction(
  tenantId: string,
  phoneNumber: string,
  providerSid: string | null,
  action: string,
): Promise<void> {
  try {
    await insertOne("phone_provision_log", {
      tenant_id: tenantId,
      phone_number: phoneNumber,
      provider_sid: providerSid,
      action,
    });
  } catch (err) {
    console.error("[PHONE] Failed to log provision action:", err);
  }
}

/**
 * GET /api/phone/available
 * Search for available phone numbers
 */
phoneConfigRoutes.get(
  "/available",
  strictRateLimit("phone-search"),
  async (c) => {
    const areaCode = c.req.query("areaCode");

    const { numbers, error } = await searchAvailableNumbers(areaCode);

    if (error) {
      return c.json({ error }, 500);
    }

    return c.json({ numbers });
  },
);

/**
 * GET /api/phone/config
 * Get current phone configuration
 */
phoneConfigRoutes.get("/config", async (c) => {
  const userId = getAuthUserId(c);

  try {
    const membershipSql = `
      SELECT tenant_id
      FROM tenant_members
      WHERE user_id = $1
        AND is_active = true
      LIMIT 1
    `;
    const membership = await queryOne<{ tenant_id: string }>(membershipSql, [
      userId,
    ]);

    if (!membership) {
      return c.json({ config: null });
    }

    const configSql = `
      SELECT *
      FROM phone_configurations
      WHERE tenant_id = $1
      LIMIT 1
    `;
    const config = await queryOne<PhoneConfigRow>(configSql, [
      membership.tenant_id,
    ]);

    // Get port request if exists
    let portRequest = null;
    if (config?.port_request_id) {
      const portRequestSql = `
        SELECT *
        FROM port_requests
        WHERE id = $1
      `;
      portRequest = await queryOne<PortRequestRow>(portRequestSql, [
        config.port_request_id,
      ]);
    }

    return c.json({ config, portRequest });
  } catch (error) {
    console.error("[PHONE] Error fetching config:", error);
    return c.json({ error: "Failed to fetch phone configuration" }, 500);
  }
});

/**
 * POST /api/phone/provision
 * Provision a new phone number
 */
phoneConfigRoutes.post(
  "/provision",
  requireRole("owner", "admin"),
  criticalRateLimit("phone-provision"),
  async (c) => {
    const body = await c.req.json();

    if (!body.phoneNumber) {
      return c.json({ error: "phoneNumber is required" }, 400);
    }

    try {
      const tenantId = getAuthTenantId(c);

      // Daily provisioning limit
      if (await checkDailyProvisionLimit(tenantId)) {
        return c.json(
          {
            error:
              "Daily provisioning limit reached. Please try again tomorrow.",
          },
          429,
        );
      }

      // Confirmation required if tenant already has an active number
      const existing = await queryOne<PhoneConfigRow>(
        "SELECT * FROM phone_configurations WHERE tenant_id = $1 AND status = 'active' LIMIT 1",
        [tenantId],
      );
      if (existing && body.confirm !== true) {
        return c.json(
          {
            error: `You already have an active number (${existing.phone_number}). Send confirm: true to replace it.`,
            existing_number: existing.phone_number,
          },
          409,
        );
      }

      // Release any existing number before provisioning a new one
      if (existing) {
        await releaseExistingPhoneConfig(tenantId);
        await logProvisionAction(
          tenantId,
          existing.phone_number || "unknown",
          existing.provider_sid,
          "release",
        );
      }

      // Provision number with SignalWire
      const { sid, error: provisionError } = await provisionNumber(
        body.phoneNumber,
      );

      if (provisionError || !sid) {
        return c.json(
          { error: provisionError || "Failed to provision number" },
          500,
        );
      }

      // Configure webhooks - rollback on failure
      const backendUrl = process.env.BACKEND_URL || "http://localhost:3100";
      const webhookUrl = `${backendUrl}/sip/forward`;
      const { success: webhookConfigured, error: webhookError } =
        await configureNumberWebhooks(sid, webhookUrl);

      if (!webhookConfigured) {
        console.error(
          "[PHONE] Webhook config failed, releasing number:",
          webhookError,
        );
        await releaseNumber(sid);
        return c.json(
          { error: "Failed to configure phone number. Please try again." },
          500,
        );
      }

      // Save to DB - rollback on failure
      try {
        const config = await upsert<PhoneConfigRow>(
          "phone_configurations",
          {
            tenant_id: tenantId,
            phone_number: body.phoneNumber,
            setup_type: "new",
            provider: "signalwire",
            provider_sid: sid,
            status: "active",
            verified_at: new Date().toISOString(),
          },
          ["tenant_id"],
        );

        await updateOne(
          "tenants",
          {
            phone_number: body.phoneNumber,
            updated_at: new Date().toISOString(),
          },
          { id: tenantId },
        );

        await logProvisionAction(tenantId, body.phoneNumber, sid, "provision");

        return c.json({
          success: true,
          phoneNumber: body.phoneNumber,
          configId: config.id,
        });
      } catch (dbError) {
        console.error("[PHONE] DB save failed, releasing number:", dbError);
        await releaseNumber(sid);
        return c.json(
          { error: "Failed to save phone configuration. Please try again." },
          500,
        );
      }
    } catch (error) {
      console.error("[PHONE] Error provisioning number:", error);
      return c.json({ error: "Failed to provision phone number" }, 500);
    }
  },
);

/**
 * POST /api/phone/port
 * Submit a number port request
 */
phoneConfigRoutes.post(
  "/port",
  requireRole("owner", "admin"),
  criticalRateLimit("phone-port"),
  async (c) => {
    const body = await c.req.json();

    // Validate required fields
    if (!body.phone_number || !body.current_carrier || !body.authorized_name) {
      return c.json(
        {
          error:
            "phone_number, current_carrier, and authorized_name are required",
        },
        400,
      );
    }

    try {
      const tenantId = getAuthTenantId(c);

      // Daily provisioning limit (only applies when requesting a temp number)
      if (body.use_temp_number && (await checkDailyProvisionLimit(tenantId))) {
        return c.json(
          {
            error:
              "Daily provisioning limit reached. Please try again tomorrow.",
          },
          429,
        );
      }

      // Release any existing number before provisioning a temp number
      if (body.use_temp_number) {
        const existingPort = await queryOne<PhoneConfigRow>(
          "SELECT * FROM phone_configurations WHERE tenant_id = $1 LIMIT 1",
          [tenantId],
        );
        if (existingPort?.provider_sid) {
          await releaseExistingPhoneConfig(tenantId);
          await logProvisionAction(
            tenantId,
            existingPort.phone_number || "unknown",
            existingPort.provider_sid,
            "release",
          );
        }
      }

      // Create port request
      const portRequest = await insertOne<PortRequestRow>("port_requests", {
        tenant_id: tenantId,
        phone_number: body.phone_number,
        current_carrier: body.current_carrier,
        account_number: encryptIfNeeded(body.account_number),
        pin: encryptIfNeeded(body.pin),
        authorized_name: body.authorized_name,
        status: "draft",
      });

      // If user wants a temporary number while porting
      let temporaryNumber = null;
      let tempSid = null;
      if (body.use_temp_number) {
        const areaCode = body.phone_number.substring(2, 5);
        const { numbers } = await searchAvailableNumbers(areaCode);
        if (numbers.length > 0) {
          const { sid } = await provisionNumber(numbers[0]);
          if (sid) {
            // Configure webhooks - rollback on failure
            const backendUrl =
              process.env.BACKEND_URL || "http://localhost:3100";
            const webhookUrl = `${backendUrl}/sip/forward`;
            const { success: webhookConfigured, error: webhookError } =
              await configureNumberWebhooks(sid, webhookUrl);

            if (!webhookConfigured) {
              console.error(
                "[PHONE] Port temp webhook config failed, releasing number:",
                webhookError,
              );
              await releaseNumber(sid);
              // Continue without temp number - port request is still valid
            } else {
              temporaryNumber = numbers[0];
              tempSid = sid;
              await logProvisionAction(tenantId, numbers[0], sid, "port");
            }
          }
        }
      }

      // Create phone configuration
      const status = temporaryNumber ? "porting_with_temp" : "porting";
      const config = await upsert<PhoneConfigRow>(
        "phone_configurations",
        {
          tenant_id: tenantId,
          phone_number: temporaryNumber || null,
          setup_type: "port",
          provider: "signalwire",
          provider_sid: tempSid,
          status,
          port_request_id: portRequest.id,
        },
        ["tenant_id"],
      );

      // Update tenant phone number if we have a temp number
      if (temporaryNumber) {
        await updateOne(
          "tenants",
          {
            phone_number: temporaryNumber,
            updated_at: new Date().toISOString(),
          },
          { id: tenantId },
        );
      }

      // Notify admin team about the new port request
      notifyAdmin("port_request_submitted", {
        portRequestId: portRequest.id,
        tenantId,
        phoneNumber: body.phone_number,
        carrier: body.current_carrier,
        authorizedName: body.authorized_name,
        hasTempNumber: !!temporaryNumber,
        temporaryNumber,
      }).catch((err) =>
        console.error("[PHONE] Admin notification failed:", err),
      );

      return c.json({
        success: true,
        portRequestId: portRequest.id,
        estimatedCompletion: null, // Would come from carrier
        temporaryNumber,
        configId: config.id,
      });
    } catch (error) {
      console.error("[PHONE] Error submitting port request:", error);
      return c.json({ error: "Failed to submit port request" }, 500);
    }
  },
);

/**
 * GET /api/phone/port/:id/status
 * Get port request status
 */
phoneConfigRoutes.get("/port/:id/status", async (c) => {
  const id = c.req.param("id");
  const userId = getAuthUserId(c);

  try {
    // Get tenant
    const membershipSql = `
      SELECT tenant_id
      FROM tenant_members
      WHERE user_id = $1
        AND is_active = true
      LIMIT 1
    `;
    const membership = await queryOne<{ tenant_id: string }>(membershipSql, [
      userId,
    ]);

    if (!membership) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const portRequestSql = `
      SELECT *
      FROM port_requests
      WHERE id = $1
        AND tenant_id = $2
    `;
    const portRequest = await queryOne<PortRequestRow>(portRequestSql, [
      id,
      membership.tenant_id,
    ]);

    if (!portRequest) {
      return c.json({ error: "Port request not found" }, 404);
    }

    return c.json({
      status: portRequest.status,
      estimatedCompletion: portRequest.estimated_completion,
      rejectionReason: portRequest.rejection_reason,
      submittedAt: portRequest.submitted_at,
      completedAt: portRequest.completed_at,
    });
  } catch (error) {
    console.error("[PHONE] Error fetching port status:", error);
    return c.json({ error: "Failed to fetch port request status" }, 500);
  }
});

/**
 * POST /api/phone/forward
 * Set up call forwarding
 */
phoneConfigRoutes.post(
  "/forward",
  requireRole("owner", "admin"),
  criticalRateLimit("phone-forward"),
  async (c) => {
    const body = await c.req.json();

    if (!body.business_number) {
      return c.json({ error: "business_number is required" }, 400);
    }

    try {
      const tenantId = getAuthTenantId(c);

      // Daily provisioning limit
      if (await checkDailyProvisionLimit(tenantId)) {
        return c.json(
          {
            error:
              "Daily provisioning limit reached. Please try again tomorrow.",
          },
          429,
        );
      }

      // Confirmation required if tenant already has an active number
      const existingFwd = await queryOne<PhoneConfigRow>(
        "SELECT * FROM phone_configurations WHERE tenant_id = $1 AND status = 'active' LIMIT 1",
        [tenantId],
      );
      if (existingFwd && body.confirm !== true) {
        return c.json(
          {
            error: `You already have an active number (${existingFwd.phone_number}). Send confirm: true to replace it.`,
            existing_number: existingFwd.phone_number,
          },
          409,
        );
      }

      // Release any existing number before provisioning a forwarding number
      if (existingFwd) {
        await releaseExistingPhoneConfig(tenantId);
        await logProvisionAction(
          tenantId,
          existingFwd.phone_number || "unknown",
          existingFwd.provider_sid,
          "release",
        );
      }

      // Provision a Lumentra number for receiving forwarded calls
      const areaCode = body.business_number.replace(/\D/g, "").substring(0, 3);
      const { numbers } = await searchAvailableNumbers(areaCode);

      if (numbers.length === 0) {
        return c.json({ error: "No numbers available in that area code" }, 400);
      }

      const { sid, error: provisionError } = await provisionNumber(numbers[0]);

      if (provisionError || !sid) {
        return c.json(
          { error: provisionError || "Failed to provision number" },
          500,
        );
      }

      // Configure webhooks - rollback on failure
      const backendUrl = process.env.BACKEND_URL || "http://localhost:3100";
      const webhookUrl = `${backendUrl}/sip/forward`;
      const { success: webhookConfigured, error: webhookError } =
        await configureNumberWebhooks(sid, webhookUrl);

      if (!webhookConfigured) {
        console.error(
          "[PHONE] Forward webhook config failed, releasing number:",
          webhookError,
        );
        await releaseNumber(sid);
        return c.json(
          { error: "Failed to configure forwarding number. Please try again." },
          500,
        );
      }

      // Save to DB - rollback on failure
      try {
        const config = await upsert<PhoneConfigRow>(
          "phone_configurations",
          {
            tenant_id: tenantId,
            phone_number: numbers[0],
            setup_type: "forward",
            provider: "signalwire",
            provider_sid: sid,
            status: "pending", // Pending until user confirms forwarding is active
          },
          ["tenant_id"],
        );

        await updateOne(
          "tenants",
          {
            phone_number: numbers[0],
            updated_at: new Date().toISOString(),
          },
          { id: tenantId },
        );

        // Generate conditional forwarding instructions (busy/no-answer, not unconditional)
        const instructions = `To forward unanswered calls from ${body.business_number} to your AI assistant:

1. Contact your carrier or use the codes below to set up conditional forwarding
2. Forward to: ${numbers[0]}

Common carrier codes (for no-answer forwarding):
- AT&T: Dial *92, then enter ${numbers[0]}
- Verizon: Dial *71, then enter ${numbers[0]} (or use My Verizon app)
- T-Mobile: Dial **61*${numbers[0]}# and press Call
- Other: Contact your carrier and ask for "conditional call forwarding" (busy + no answer)

To cancel forwarding later:
- AT&T: Dial *93
- Verizon: Dial *73
- T-Mobile: Dial ##61#

Note: This only forwards calls you miss -- your phone still rings first.`;

        await logProvisionAction(tenantId, numbers[0], sid, "forward");

        return c.json({
          success: true,
          forwardTo: numbers[0],
          instructions,
          configId: config.id,
        });
      } catch (dbError) {
        console.error(
          "[PHONE] Forward DB save failed, releasing number:",
          dbError,
        );
        await releaseNumber(sid);
        return c.json(
          {
            error: "Failed to save forwarding configuration. Please try again.",
          },
          500,
        );
      }
    } catch (error) {
      console.error("[PHONE] Error setting up forwarding:", error);
      return c.json({ error: "Failed to set up call forwarding" }, 500);
    }
  },
);

/**
 * POST /api/phone/verify-forward
 * Mark forwarding as verified/active
 */
phoneConfigRoutes.post(
  "/verify-forward",
  requireRole("owner", "admin"),
  async (c) => {
    try {
      const tenantId = getAuthTenantId(c);

      const updateSql = `
      UPDATE phone_configurations
      SET status = $1, verified_at = $2
      WHERE tenant_id = $3 AND setup_type = 'forward'
      RETURNING id
    `;
      const result = await queryOne<{ id: string }>(updateSql, [
        "active",
        new Date().toISOString(),
        tenantId,
      ]);

      if (!result) {
        return c.json({ error: "No forwarding configuration found" }, 404);
      }

      return c.json({ success: true });
    } catch (error) {
      console.error("[PHONE] Error verifying forward:", error);
      return c.json({ error: "Failed to verify forwarding" }, 500);
    }
  },
);

/**
 * POST /api/phone/sip
 * Create a SIP trunk endpoint
 */
phoneConfigRoutes.post(
  "/sip",
  requireRole("owner", "admin"),
  criticalRateLimit("phone-sip"),
  async (c) => {
    try {
      const tenantId = getAuthTenantId(c);

      // Daily provisioning limit
      if (await checkDailyProvisionLimit(tenantId)) {
        return c.json(
          {
            error:
              "Daily provisioning limit reached. Please try again tomorrow.",
          },
          429,
        );
      }

      // Confirmation required if tenant already has an active config
      const existingSip = await queryOne<PhoneConfigRow>(
        "SELECT * FROM phone_configurations WHERE tenant_id = $1 AND status = 'active' LIMIT 1",
        [tenantId],
      );
      if (existingSip) {
        const sipBody = await c.req
          .json()
          .catch(() => ({}) as Record<string, unknown>);
        if (sipBody.confirm !== true) {
          return c.json(
            {
              error: `You already have an active configuration (${existingSip.setup_type}: ${existingSip.phone_number || existingSip.provider_sid}). Send confirm: true to replace it.`,
            },
            409,
          );
        }
      }

      // Release any existing phone config before creating new SIP endpoint
      if (existingSip) {
        await releaseExistingPhoneConfig(tenantId);
        await logProvisionAction(
          tenantId,
          existingSip.phone_number || "sip-endpoint",
          existingSip.provider_sid,
          "release",
        );
      }

      const backendUrl = process.env.BACKEND_URL || "http://localhost:3100";
      const webhookUrl = withWebhookSecret(`${backendUrl}/sip/forward`);

      // Create SIP endpoint on SignalWire
      const { endpoint, error: sipError } = await createSipEndpoint(tenantId);

      if (sipError || !endpoint) {
        return c.json(
          { error: sipError || "Failed to create SIP endpoint" },
          500,
        );
      }

      // Configure routing - rollback on failure
      const { error: routingError } = await configureSipRouting(
        endpoint.endpointId,
        webhookUrl,
      );

      if (routingError) {
        console.error(
          "[PHONE] SIP routing config failed, deleting endpoint:",
          routingError,
        );
        await deleteSipEndpoint(endpoint.endpointId);
        return c.json(
          { error: "Failed to configure SIP routing. Please try again." },
          500,
        );
      }

      // Save to DB - rollback on failure
      try {
        const config = await upsert<PhoneConfigRow>(
          "phone_configurations",
          {
            tenant_id: tenantId,
            setup_type: "sip",
            provider: "signalwire",
            provider_sid: endpoint.endpointId,
            sip_uri: endpoint.sipUri,
            sip_username: endpoint.username,
            status: "pending",
          },
          ["tenant_id"],
        );

        await logProvisionAction(
          tenantId,
          endpoint.sipUri,
          endpoint.endpointId,
          "sip",
        );

        return c.json({
          success: true,
          sipUri: endpoint.sipUri,
          username: endpoint.username,
          password: endpoint.password,
          configId: config.id,
        });
      } catch (dbError) {
        console.error(
          "[PHONE] SIP DB save failed, deleting endpoint:",
          dbError,
        );
        await deleteSipEndpoint(endpoint.endpointId);
        return c.json(
          { error: "Failed to save SIP configuration. Please try again." },
          500,
        );
      }
    } catch (error) {
      console.error("[PHONE] Error creating SIP endpoint:", error);
      return c.json({ error: "Failed to create SIP endpoint" }, 500);
    }
  },
);

/**
 * GET /api/phone/sip/status
 * Check SIP endpoint registration status
 */
phoneConfigRoutes.get("/sip/status", async (c) => {
  const userId = getAuthUserId(c);

  try {
    // Get tenant
    const membershipSql = `
      SELECT tenant_id
      FROM tenant_members
      WHERE user_id = $1
        AND is_active = true
      LIMIT 1
    `;
    const membership = await queryOne<{ tenant_id: string }>(membershipSql, [
      userId,
    ]);

    if (!membership) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Get SIP config
    const configSql = `
      SELECT provider_sid, sip_uri, status
      FROM phone_configurations
      WHERE tenant_id = $1 AND setup_type = 'sip'
      LIMIT 1
    `;
    const config = await queryOne<{
      provider_sid: string;
      sip_uri: string;
      status: string;
    }>(configSql, [membership.tenant_id]);

    if (!config || !config.provider_sid) {
      return c.json({ error: "No SIP configuration found" }, 404);
    }

    // Check registration status with SignalWire
    const { registered, error: statusError } = await getSipEndpointStatus(
      config.provider_sid,
    );

    if (statusError) {
      return c.json({
        registered: false,
        sipUri: config.sip_uri,
        status: config.status,
        error: statusError,
      });
    }

    // Update status if PBX has connected
    if (registered && config.status === "pending") {
      const updateSql = `
        UPDATE phone_configurations
        SET status = 'active', verified_at = $1
        WHERE tenant_id = $2 AND setup_type = 'sip'
      `;
      await queryOne(updateSql, [
        new Date().toISOString(),
        membership.tenant_id,
      ]);
    }

    return c.json({
      registered,
      sipUri: config.sip_uri,
      status: registered ? "active" : config.status,
    });
  } catch (error) {
    console.error("[PHONE] Error checking SIP status:", error);
    return c.json({ error: "Failed to check SIP status" }, 500);
  }
});
