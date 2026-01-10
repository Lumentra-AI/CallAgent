import type {
  VapiWebhookPayload,
  VapiToolCallResult,
} from "../../../types/vapi.js";
import { checkAvailability } from "../tools/check-availability.js";
import { createBooking } from "../tools/create-booking.js";
import { transferToHuman } from "../tools/transfer-call.js";
import { getTenantByPhoneWithFallback } from "../../database/tenant-cache.js";

/**
 * Handle tool-calls webhook
 *
 * When the AI decides to call a tool (check availability, book, transfer),
 * Vapi sends a webhook to execute it. We process and return the result.
 */
export async function handleToolCalls(
  payload: VapiWebhookPayload,
): Promise<VapiToolCallResult> {
  const results: VapiToolCallResult["results"] = [];
  const toolCalls =
    payload.message?.toolCallList || payload.message?.toolCalls || [];

  // Get tenant context
  const vapiPhoneNumber = payload.message?.call?.phoneNumber?.number;
  const tenant = vapiPhoneNumber
    ? await getTenantByPhoneWithFallback(vapiPhoneNumber)
    : null;
  const callId = payload.message?.call?.id;

  console.log(
    `[TOOL-CALLS] Processing ${toolCalls.length} tool calls for tenant: ${tenant?.business_name || "unknown"}`,
  );

  for (const toolCall of toolCalls) {
    const { id: toolCallId, function: func } = toolCall;
    const functionName = func.name;
    let args: Record<string, unknown> = {};

    try {
      args = JSON.parse(func.arguments);
    } catch {
      console.error(
        `[TOOL-CALLS] Failed to parse arguments for ${functionName}`,
      );
      results.push({
        toolCallId,
        result: JSON.stringify({ error: "Invalid arguments" }),
      });
      continue;
    }

    console.log(`[TOOL-CALLS] Executing: ${functionName}`, args);

    try {
      let result: unknown;

      switch (functionName) {
        case "check_availability":
          result = await checkAvailability({
            tenantId: tenant?.id,
            date: args.date as string,
            serviceType: args.service_type as string | undefined,
          });
          break;

        case "create_booking":
          result = await createBooking({
            tenantId: tenant?.id,
            callId,
            customerName: args.customer_name as string,
            customerPhone: args.customer_phone as string,
            date: args.date as string,
            time: args.time as string,
            serviceType: args.service_type as string | undefined,
            notes: args.notes as string | undefined,
          });
          break;

        case "transfer_to_human":
          result = await transferToHuman({
            tenantId: tenant?.id,
            callId,
            reason: args.reason as string,
            escalationPhone: tenant?.escalation_phone,
          });
          break;

        default:
          console.warn(`[TOOL-CALLS] Unknown function: ${functionName}`);
          result = { error: `Unknown function: ${functionName}` };
      }

      results.push({
        toolCallId,
        result: JSON.stringify(result),
      });

      console.log(`[TOOL-CALLS] ${functionName} completed:`, result);
    } catch (error) {
      console.error(`[TOOL-CALLS] Error executing ${functionName}:`, error);
      results.push({
        toolCallId,
        result: JSON.stringify({
          error: "Failed to execute tool",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      });
    }
  }

  return { results };
}
