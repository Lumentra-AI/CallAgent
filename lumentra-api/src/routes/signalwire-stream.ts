// SignalWire WebSocket Stream Handler
// Handles real-time audio streaming for voice calls

import type { IncomingMessage } from "http";
import type WebSocket from "ws";
import { createTurnManager } from "../services/voice/turn-manager.js";
import { getTenantById } from "../services/database/tenant-cache.js";

// Feature flag
const VOICE_PROVIDER = process.env.VOICE_PROVIDER || "vapi";

interface StreamParams {
  callSid: string;
  tenantId: string;
  callerPhone?: string;
}

/**
 * Parse query parameters from WebSocket URL
 */
function parseParams(url: string): StreamParams | null {
  try {
    const searchParams = new URL(url, "http://localhost").searchParams;
    const callSid = searchParams.get("callSid");
    const tenantId = searchParams.get("tenantId");
    const callerPhone = searchParams.get("callerPhone") || undefined;

    if (!callSid || !tenantId) {
      return null;
    }

    return { callSid, tenantId, callerPhone };
  } catch {
    return null;
  }
}

/**
 * Handle WebSocket connection for media stream
 */
export async function handleSignalWireStream(
  ws: WebSocket,
  request: IncomingMessage,
): Promise<void> {
  // Check feature flag
  if (VOICE_PROVIDER !== "custom") {
    console.log("[STREAM] Custom voice disabled, closing connection");
    ws.close(1000, "Custom voice disabled");
    return;
  }

  const url = request.url || "";
  console.log(`[STREAM] New connection: ${url}`);

  // Parse parameters
  const params = parseParams(url);
  if (!params) {
    console.error("[STREAM] Missing required parameters");
    ws.close(1008, "Missing parameters");
    return;
  }

  const { callSid, tenantId, callerPhone } = params;
  console.log(`[STREAM] Call ${callSid} from ${callerPhone || "unknown"}`);

  // Get tenant
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    console.error(`[STREAM] Tenant not found: ${tenantId}`);
    ws.close(1008, "Tenant not found");
    return;
  }

  console.log(`[STREAM] Tenant: ${tenant.business_name}`);

  // Create turn manager
  const turnManager = createTurnManager(callSid, tenant, callerPhone, {
    onResponse: (text) => {
      console.log(`[STREAM] Response: "${text.substring(0, 50)}..."`);
    },
    onTransferRequested: (phoneNumber) => {
      console.log(`[STREAM] Transfer requested to: ${phoneNumber}`);
      // TODO: Implement call transfer via SignalWire API
    },
    onCallEnd: (reason) => {
      console.log(`[STREAM] Call ended: ${reason}`);
    },
  });

  try {
    // Initialize voice pipeline
    await turnManager.initialize(ws);
    console.log(`[STREAM] Voice pipeline initialized for ${callSid}`);
  } catch (error) {
    console.error(`[STREAM] Failed to initialize:`, error);
    ws.close(1011, "Initialization failed");
    return;
  }

  // Handle WebSocket close
  ws.on("close", async (code, reason) => {
    console.log(`[STREAM] Connection closed: ${code} ${reason}`);
    await turnManager.cleanup();
  });

  ws.on("error", async (error) => {
    console.error(`[STREAM] WebSocket error:`, error);
    await turnManager.cleanup();
  });
}

/**
 * Check if a request is for the SignalWire stream
 */
export function isSignalWireStreamRequest(url: string): boolean {
  return url.startsWith("/signalwire/stream");
}
