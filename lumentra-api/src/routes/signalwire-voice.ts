// SignalWire Voice Routes
// Handles incoming calls and WebSocket streams for custom voice stack

import { Hono } from "hono";
import {
  generateStreamXml,
  generateTransferXml,
} from "../services/signalwire/client.js";
import { getTenantByPhoneWithFallback } from "../services/database/tenant-cache.js";

const signalwireVoice = new Hono();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

/**
 * Incoming call webhook from SignalWire
 * POST /signalwire/voice
 */
signalwireVoice.post("/voice", async (c) => {
  try {
    // Get call parameters from SignalWire
    const formData = await c.req.parseBody();
    const callSid = formData.CallSid as string;
    const from = formData.From as string;
    const to = formData.To as string;

    console.log(`[SIGNALWIRE] Incoming call: ${callSid}`);
    console.log(`[SIGNALWIRE] From: ${from}, To: ${to}`);

    // Look up tenant by phone number
    const tenant = await getTenantByPhoneWithFallback(to);

    if (!tenant) {
      console.warn(`[SIGNALWIRE] No tenant found for: ${to}`);
      // Return basic response
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

    // Generate WebSocket URL for media stream
    const wsProtocol = BACKEND_URL.startsWith("https") ? "wss" : "ws";
    const wsHost = BACKEND_URL.replace(/^https?:\/\//, "");
    const websocketUrl = `${wsProtocol}://${wsHost}/signalwire/stream?callSid=${callSid}&tenantId=${tenant.id}&callerPhone=${encodeURIComponent(from)}`;

    console.log(`[SIGNALWIRE] WebSocket URL: ${websocketUrl}`);

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
  try {
    const formData = await c.req.parseBody();
    const callSid = formData.CallSid as string;
    const callStatus = formData.CallStatus as string;

    console.log(`[SIGNALWIRE] Call ${callSid} status: ${callStatus}`);

    // Handle call completion, recording, etc.
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
  try {
    // Get destination from query params (from redirect URL)
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
