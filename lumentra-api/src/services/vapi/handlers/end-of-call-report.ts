import type { VapiWebhookPayload } from "../../../types/vapi.js";
import { getSupabase } from "../../database/client.js";
import { getTenantByPhoneWithFallback } from "../../database/tenant-cache.js";

/**
 * Handle end-of-call-report webhook
 *
 * Called when a call ends. Contains final transcript, summary, cost, etc.
 * We store this for analytics and check if callback is needed.
 */
export async function handleEndOfCallReport(
  payload: VapiWebhookPayload,
): Promise<Record<string, never>> {
  try {
    const message = payload.message;
    const call = message?.call;

    if (!call) {
      console.warn("[END-OF-CALL] No call data in payload");
      return {};
    }

    const vapiCallId = call.id;
    const endedReason = message.endedReason || call.endedReason;
    const transcript = message.transcript;
    const summary = message.summary;
    const recordingUrl = message.recordingUrl;
    const cost = message.cost;
    const vapiPhoneNumber = call.phoneNumber?.number;
    const callerNumber = call.customer?.number;

    console.log(
      `[END-OF-CALL] Call ${vapiCallId} ended: ${endedReason}, cost: $${cost?.toFixed(4) || "unknown"}`,
    );

    // Look up tenant
    const tenant = vapiPhoneNumber
      ? await getTenantByPhoneWithFallback(vapiPhoneNumber)
      : null;

    if (!tenant) {
      console.warn("[END-OF-CALL] No tenant found for call");
      return {};
    }

    const db = getSupabase();

    // Determine call outcome
    const outcome = determineOutcome(endedReason, transcript);

    // Calculate duration
    const startTime = new Date(call.createdAt);
    const endTime = new Date();
    const durationSeconds = Math.round(
      (endTime.getTime() - startTime.getTime()) / 1000,
    );

    // Update call record
    const { error: updateError } = await db
      .from("calls")
      .update({
        status: outcome.isMissed ? "missed" : "completed",
        ended_at: endTime.toISOString(),
        duration_seconds: durationSeconds,
        ended_reason: endedReason,
        outcome_type: outcome.type,
        outcome_success: outcome.success,
        transcript,
        summary,
        recording_url: recordingUrl,
        cost_cents: cost ? Math.round(cost * 100) : null,
        updated_at: endTime.toISOString(),
      })
      .eq("vapi_call_id", vapiCallId);

    if (updateError) {
      console.error("[END-OF-CALL] Failed to update call:", updateError);
    }

    // Check if this was a missed call that needs callback
    if (outcome.isMissed && callerNumber) {
      await queueCallback(db, tenant.id, vapiCallId, callerNumber, endedReason);
    }
  } catch (error) {
    console.error("[END-OF-CALL] Error:", error);
  }

  return {};
}

interface CallOutcome {
  type: "booking" | "inquiry" | "support" | "escalation" | "hangup";
  success: boolean;
  isMissed: boolean;
}

function determineOutcome(
  endedReason: string | undefined,
  transcript: string | undefined,
): CallOutcome {
  // Check if call was abandoned/missed
  const missedReasons = [
    "customer-did-not-give-microphone-permission",
    "customer-ended-call",
    "silence-timed-out",
    "no-answer",
    "busy",
    "canceled",
  ];

  const isMissed =
    endedReason !== undefined &&
    (missedReasons.includes(endedReason) ||
      (endedReason === "customer-ended-call" &&
        (!transcript || transcript.length < 100)));

  // Try to determine outcome from transcript
  // This is a simple heuristic - could be improved with AI analysis
  if (!transcript) {
    return { type: "hangup", success: false, isMissed };
  }

  const lowerTranscript = transcript.toLowerCase();

  // Check for booking
  if (
    lowerTranscript.includes("booking confirmed") ||
    lowerTranscript.includes("reservation confirmed") ||
    lowerTranscript.includes("appointment confirmed")
  ) {
    return { type: "booking", success: true, isMissed: false };
  }

  // Check for transfer/escalation
  if (
    lowerTranscript.includes("transfer") ||
    lowerTranscript.includes("speak to a") ||
    lowerTranscript.includes("human")
  ) {
    return { type: "escalation", success: true, isMissed: false };
  }

  // Default to inquiry
  return { type: "inquiry", success: true, isMissed };
}

async function queueCallback(
  db: ReturnType<typeof getSupabase>,
  tenantId: string,
  callId: string,
  phoneNumber: string,
  reason: string | undefined,
): Promise<void> {
  console.log(`[END-OF-CALL] Queueing callback for ${phoneNumber}`);

  try {
    await db.from("callback_queue").insert({
      tenant_id: tenantId,
      original_call_id: callId,
      phone_number: phoneNumber,
      reason: reason || "Missed call",
      priority: "medium",
      status: "pending",
      attempts: 0,
    });
  } catch (error) {
    console.error("[END-OF-CALL] Failed to queue callback:", error);
  }
}
