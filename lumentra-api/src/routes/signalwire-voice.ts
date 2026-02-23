// SignalWire Voice Routes
// Handles incoming calls and WebSocket streams for custom voice stack

import { createHmac, timingSafeEqual } from "crypto";
import { Hono } from "hono";
import {
  generateStreamXml,
  generateTransferXml,
} from "../services/signalwire/client.js";
import {
  getTenantByPhoneWithFallback,
  getTenantBySipUri,
} from "../services/database/tenant-cache.js";

const signalwireVoice = new Hono();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

/**
 * Generate a short-lived HMAC token for WebSocket stream authentication.
 * Token is valid for ~2 minutes (current + previous minute window).
 */
export function generateStreamToken(callSid: string, tenantId: string): string {
  const secret = process.env.STREAM_SIGNING_SECRET || process.env.SIGNALWIRE_API_TOKEN || "dev-stream-secret";
  const minuteWindow = Math.floor(Date.now() / 60000);
  const payload = `${callSid}:${tenantId}:${minuteWindow}`;
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
}

/**
 * Validate SignalWire webhook requests using a shared secret.
 * The secret should be appended to the webhook URL configured in SignalWire.
 */
function validateWebhookSecret(c: { req: { query: (key: string) => string | undefined } }): boolean {
  const secret = process.env.SIGNALWIRE_WEBHOOK_SECRET;
  if (!secret) return true; // Skip if not configured
  const provided = c.req.query("webhook_secret");
  if (!provided) return false;
  try {
    const expectedBuf = Buffer.from(secret, "utf8");
    const providedBuf = Buffer.from(provided, "utf8");
    if (expectedBuf.length !== providedBuf.length) return false;
    return timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

/**
 * Incoming call webhook from SignalWire
 * POST /signalwire/voice
 */
signalwireVoice.post("/voice", async (c) => {
  // Validate webhook secret
  if (!validateWebhookSecret(c)) {
    console.error("[SIGNALWIRE] Invalid webhook secret");
    return c.text(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`,
      403,
      { "Content-Type": "application/xml" },
    );
  }

  try {
    const contentType = c.req.header("content-type");
    console.log(`[SIGNALWIRE] Content-Type: ${contentType}`);

    // Get call parameters from SignalWire
    const formData = await c.req.parseBody();
    console.log(
      `[SIGNALWIRE] Form data keys: ${Object.keys(formData).join(", ")}`,
    );

    const callSid = formData.CallSid as string;
    const from = formData.From as string;
    const to = formData.To as string;

    console.log(`[SIGNALWIRE] Incoming call: ${callSid}`);
    console.log(`[SIGNALWIRE] From: ${from}, To: ${to}`);

    // Look up tenant by phone number, or by SIP URI for SIP-originated calls
    let tenant = await getTenantByPhoneWithFallback(to);

    if (!tenant && to.includes("@")) {
      tenant = await getTenantBySipUri(to);
    }

    if (!tenant) {
      console.warn(`[SIGNALWIRE] No tenant found for: ${to}`);
      return c.text(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, this number is not configured. Goodbye.</Say>
  <Hangup/>
</Response>`,
        200,
        { "Content-Type": "application/xml" },
      );
    }

    console.log(`[SIGNALWIRE] Tenant: ${tenant.business_name}`);

    // Generate signed WebSocket URL for media stream
    const streamToken = generateStreamToken(callSid, tenant.id);
    const wsProtocol = BACKEND_URL.startsWith("https") ? "wss" : "ws";
    const wsHost = BACKEND_URL.replace(/^https?:\/\//, "");
    const websocketUrl = `${wsProtocol}://${wsHost}/signalwire/stream?callSid=${callSid}&tenantId=${tenant.id}&callerPhone=${encodeURIComponent(from)}&token=${streamToken}`;

    console.log(`[SIGNALWIRE] WebSocket URL generated for call ${callSid}`);

    // Return TwiML to connect to media stream
    const xml = generateStreamXml(websocketUrl);
    return c.text(xml, 200, { "Content-Type": "application/xml" });
  } catch (error) {
    console.error("[SIGNALWIRE] Error handling call:", error);
    return c.text(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're experiencing technical difficulties. Please try again later.</Say>
  <Hangup/>
</Response>`,
      200,
      { "Content-Type": "application/xml" },
    );
  }
});

/**
 * Call status webhook
 * POST /signalwire/status
 */
signalwireVoice.post("/status", async (c) => {
  if (!validateWebhookSecret(c)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  try {
    const formData = await c.req.parseBody();
    const callSid = formData.CallSid as string;
    const callStatus = formData.CallStatus as string;

    console.log(`[SIGNALWIRE] Call ${callSid} status: ${callStatus}`);

    if (callStatus === "completed") {
      // Could save call record to database here
    }

    return c.json({ status: "received" });
  } catch (error) {
    console.error("[SIGNALWIRE] Error handling status:", error);
    return c.json({ error: "Internal error" }, 500);
  }
});

/**
 * Transfer endpoint - returns TwiML to dial the destination
 * GET/POST /signalwire/transfer?to=+1234567890
 * SignalWire redirects calls here when transfer is initiated
 */
signalwireVoice.all("/transfer", async (c) => {
  if (!validateWebhookSecret(c)) {
    return c.text(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`,
      403,
      { "Content-Type": "application/xml" },
    );
  }

  try {
    const to = c.req.query("to");

    if (!to) {
      console.error("[SIGNALWIRE] Transfer missing destination");
      return c.text(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Unable to complete transfer. Goodbye.</Say>
  <Hangup/>
</Response>`,
        200,
        { "Content-Type": "application/xml" },
      );
    }

    console.log(`[SIGNALWIRE] Transferring call to: ${to}`);
    const xml = generateTransferXml(to);
    return c.text(xml, 200, { "Content-Type": "application/xml" });
  } catch (error) {
    console.error("[SIGNALWIRE] Error handling transfer:", error);
    return c.text(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Transfer failed. Goodbye.</Say>
  <Hangup/>
</Response>`,
      200,
      { "Content-Type": "application/xml" },
    );
  }
});

/**
 * Health check for SignalWire integration
 * GET /signalwire/health
 */
signalwireVoice.get("/health", (c) => {
  return c.json({
    provider: "signalwire",
    enabled: true,
  });
});

export default signalwireVoice;
