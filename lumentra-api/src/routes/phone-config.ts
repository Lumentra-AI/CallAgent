import { Hono } from "hono";
import { getSupabase } from "../services/database/client.js";
import { getAuthUserId } from "../middleware/index.js";
import {
  searchAvailableNumbers,
  provisionNumber,
  configureNumberWebhooks,
} from "../services/signalwire/phone.js";

export const phoneConfigRoutes = new Hono();

/**
 * GET /api/phone/available
 * Search for available phone numbers
 */
phoneConfigRoutes.get("/available", async (c) => {
  const areaCode = c.req.query("areaCode");

  const { numbers, error } = await searchAvailableNumbers(areaCode);

  if (error) {
    return c.json({ error }, 500);
  }

  return c.json({ numbers });
});

/**
 * GET /api/phone/config
 * Get current phone configuration
 */
phoneConfigRoutes.get("/config", async (c) => {
  const userId = getAuthUserId(c);
  const db = getSupabase();

  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return c.json({ config: null });
  }

  const { data: config } = await db
    .from("phone_configurations")
    .select("*")
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  // Get port request if exists
  let portRequest = null;
  if (config?.port_request_id) {
    const { data } = await db
      .from("port_requests")
      .select("*")
      .eq("id", config.port_request_id)
      .single();
    portRequest = data;
  }

  return c.json({ config, portRequest });
});

/**
 * POST /api/phone/provision
 * Provision a new phone number
 */
phoneConfigRoutes.post("/provision", async (c) => {
  const body = await c.req.json();
  const userId = getAuthUserId(c);
  const db = getSupabase();

  if (!body.phoneNumber) {
    return c.json({ error: "phoneNumber is required" }, 400);
  }

  // Get tenant
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const tenantId = membership.tenant_id;

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

  // Configure webhooks
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3100";
  const webhookUrl = `${backendUrl}/signalwire/voice`;
  await configureNumberWebhooks(sid, webhookUrl);

  // Create or update phone configuration
  const { data: config, error: dbError } = await db
    .from("phone_configurations")
    .upsert(
      {
        tenant_id: tenantId,
        phone_number: body.phoneNumber,
        setup_type: "new",
        provider: "signalwire",
        provider_sid: sid,
        status: "active",
        verified_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    )
    .select()
    .single();

  if (dbError) {
    return c.json({ error: dbError.message }, 500);
  }

  // Update tenant's phone number
  await db
    .from("tenants")
    .update({
      phone_number: body.phoneNumber,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  return c.json({
    success: true,
    phoneNumber: body.phoneNumber,
    configId: config.id,
  });
});

/**
 * POST /api/phone/port
 * Submit a number port request
 */
phoneConfigRoutes.post("/port", async (c) => {
  const body = await c.req.json();
  const userId = getAuthUserId(c);
  const db = getSupabase();

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

  // Get tenant
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const tenantId = membership.tenant_id;

  // Create port request
  const { data: portRequest, error: portError } = await db
    .from("port_requests")
    .insert({
      tenant_id: tenantId,
      phone_number: body.phone_number,
      current_carrier: body.current_carrier,
      account_number: body.account_number || null, // TODO: Encrypt
      pin: body.pin || null, // TODO: Encrypt
      authorized_name: body.authorized_name,
      status: "draft",
    })
    .select()
    .single();

  if (portError) {
    return c.json({ error: portError.message }, 500);
  }

  // If user wants a temporary number while porting
  let temporaryNumber = null;
  let tempSid = null;
  if (body.use_temp_number) {
    // Search for a number in the same area code
    const areaCode = body.phone_number.substring(2, 5);
    const { numbers } = await searchAvailableNumbers(areaCode);
    if (numbers.length > 0) {
      const { sid } = await provisionNumber(numbers[0]);
      if (sid) {
        temporaryNumber = numbers[0];
        tempSid = sid;

        // Configure webhooks for temp number
        const backendUrl = process.env.BACKEND_URL || "http://localhost:3100";
        const webhookUrl = `${backendUrl}/signalwire/voice`;
        await configureNumberWebhooks(sid, webhookUrl);
      }
    }
  }

  // Create phone configuration
  const status = temporaryNumber ? "porting_with_temp" : "porting";
  const { data: config, error: configError } = await db
    .from("phone_configurations")
    .upsert(
      {
        tenant_id: tenantId,
        phone_number: temporaryNumber || null,
        setup_type: "port",
        provider: "signalwire",
        provider_sid: tempSid,
        status,
        port_request_id: portRequest.id,
      },
      { onConflict: "tenant_id" },
    )
    .select()
    .single();

  if (configError) {
    return c.json({ error: configError.message }, 500);
  }

  // Update tenant phone number if we have a temp number
  if (temporaryNumber) {
    await db
      .from("tenants")
      .update({
        phone_number: temporaryNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);
  }

  return c.json({
    success: true,
    portRequestId: portRequest.id,
    estimatedCompletion: null, // Would come from carrier
    temporaryNumber,
    configId: config.id,
  });
});

/**
 * GET /api/phone/port/:id/status
 * Get port request status
 */
phoneConfigRoutes.get("/port/:id/status", async (c) => {
  const id = c.req.param("id");
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Get tenant
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { data: portRequest, error } = await db
    .from("port_requests")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", membership.tenant_id)
    .single();

  if (error || !portRequest) {
    return c.json({ error: "Port request not found" }, 404);
  }

  return c.json({
    status: portRequest.status,
    estimatedCompletion: portRequest.estimated_completion,
    rejectionReason: portRequest.rejection_reason,
    submittedAt: portRequest.submitted_at,
    completedAt: portRequest.completed_at,
  });
});

/**
 * POST /api/phone/forward
 * Set up call forwarding
 */
phoneConfigRoutes.post("/forward", async (c) => {
  const body = await c.req.json();
  const userId = getAuthUserId(c);
  const db = getSupabase();

  if (!body.business_number) {
    return c.json({ error: "business_number is required" }, 400);
  }

  // Get tenant
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const tenantId = membership.tenant_id;

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

  // Configure webhooks
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3100";
  const webhookUrl = `${backendUrl}/signalwire/voice`;
  await configureNumberWebhooks(sid, webhookUrl);

  // Create phone configuration
  const { data: config, error: configError } = await db
    .from("phone_configurations")
    .upsert(
      {
        tenant_id: tenantId,
        phone_number: numbers[0],
        setup_type: "forward",
        provider: "signalwire",
        provider_sid: sid,
        status: "pending", // Pending until user confirms forwarding is active
      },
      { onConflict: "tenant_id" },
    )
    .select()
    .single();

  if (configError) {
    return c.json({ error: configError.message }, 500);
  }

  // Update tenant phone number
  await db
    .from("tenants")
    .update({
      phone_number: numbers[0],
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  // Generate forwarding instructions
  const instructions = `To forward calls from ${body.business_number} to your AI assistant:

1. From your business phone, dial *72
2. When prompted, dial ${numbers[0]}
3. Wait for confirmation tone or message
4. Hang up

To cancel forwarding later:
- Dial *73 from your business phone

Note: Forwarding codes may vary by carrier. If *72 doesn't work, contact your phone provider for their specific forwarding instructions.`;

  return c.json({
    success: true,
    forwardTo: numbers[0],
    instructions,
    configId: config.id,
  });
});

/**
 * POST /api/phone/verify-forward
 * Mark forwarding as verified/active
 */
phoneConfigRoutes.post("/verify-forward", async (c) => {
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Get tenant
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { error } = await db
    .from("phone_configurations")
    .update({
      status: "active",
      verified_at: new Date().toISOString(),
    })
    .eq("tenant_id", membership.tenant_id)
    .eq("setup_type", "forward");

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});
