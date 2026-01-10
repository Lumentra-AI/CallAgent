import type { VapiWebhookPayload } from "../../../types/vapi.js";
import { getSupabase } from "../../database/client.js";
import { getTenantByPhoneWithFallback } from "../../database/tenant-cache.js";

/**
 * Handle status-update webhook
 *
 * Called when call state changes (ringing, connected, ended, etc.)
 * We track these for real-time dashboard updates and analytics.
 */
export async function handleStatusUpdate(
  payload: VapiWebhookPayload,
): Promise<Record<string, never>> {
  try {
    const call = payload.message?.call;

    if (!call) {
      console.warn("[STATUS-UPDATE] No call data in payload");
      return {};
    }

    const status = call.status;
    const vapiCallId = call.id;
    const vapiPhoneNumber = call.phoneNumber?.number;
    const callerNumber = call.customer?.number;

    console.log(
      `[STATUS-UPDATE] Call ${vapiCallId} status: ${status}, caller: ${callerNumber || "unknown"}`,
    );

    // Look up tenant
    const tenant = vapiPhoneNumber
      ? await getTenantByPhoneWithFallback(vapiPhoneNumber)
      : null;

    if (!tenant) {
      console.warn("[STATUS-UPDATE] No tenant found for call");
      return {};
    }

    const db = getSupabase();

    // Map Vapi status to our status
    const mappedStatus = mapStatus(status);

    // Check if call record exists
    const { data: existingCall } = await db
      .from("calls")
      .select("id")
      .eq("vapi_call_id", vapiCallId)
      .single();

    if (existingCall) {
      // Update existing call
      await db
        .from("calls")
        .update({
          status: mappedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("vapi_call_id", vapiCallId);
    } else {
      // Create new call record
      await db.from("calls").insert({
        tenant_id: tenant.id,
        vapi_call_id: vapiCallId,
        caller_phone: callerNumber,
        direction: call.type === "inboundPhoneCall" ? "inbound" : "outbound",
        status: mappedStatus,
        started_at: call.createdAt,
      });
    }
  } catch (error) {
    // Log but don't fail the webhook
    console.error("[STATUS-UPDATE] Error:", error);
  }

  // Always return empty object for status updates
  return {};
}

function mapStatus(
  vapiStatus: string,
): "ringing" | "connected" | "completed" | "failed" | "missed" {
  switch (vapiStatus) {
    case "queued":
    case "ringing":
      return "ringing";
    case "in-progress":
      return "connected";
    case "ended":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "connected";
  }
}
