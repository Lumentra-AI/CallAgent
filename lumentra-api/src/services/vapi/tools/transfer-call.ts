import { getSupabase } from "../../database/client.js";

interface TransferParams {
  tenantId?: string;
  callId?: string;
  reason: string;
  escalationPhone?: string;
}

interface TransferResult {
  success: boolean;
  message: string;
  action?: {
    type: "transfer";
    destination: string;
  };
}

/**
 * Transfer the call to a human staff member
 *
 * This logs the escalation and returns transfer instructions to Vapi.
 */
export async function transferToHuman(
  params: TransferParams,
): Promise<TransferResult> {
  const { tenantId, callId, reason, escalationPhone } = params;

  console.log(`[TRANSFER] Initiating transfer, reason: ${reason}`);

  // Check if we have a destination
  if (!escalationPhone) {
    return {
      success: false,
      message:
        "I'm sorry, I'm not able to transfer you right now. Is there anything else I can help you with?",
    };
  }

  try {
    const db = getSupabase();

    // Log the escalation
    if (tenantId && callId) {
      await db
        .from("calls")
        .update({
          outcome_type: "escalation",
          updated_at: new Date().toISOString(),
        })
        .eq("vapi_call_id", callId);
    }

    // Return transfer action
    // Vapi will handle the actual transfer based on this response
    return {
      success: true,
      message: "I'll transfer you now. Please hold.",
      action: {
        type: "transfer",
        destination: escalationPhone,
      },
    };
  } catch (error) {
    console.error("[TRANSFER] Error:", error);
    return {
      success: false,
      message:
        "I'm having trouble completing that transfer. Would you like to leave a message instead?",
    };
  }
}
