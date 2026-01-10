import { getSupabase } from "../services/database/client.js";

/**
 * Process callback queue
 *
 * Finds missed calls that need callbacks and initiates outbound calls.
 * For now, this just logs - actual outbound calls require Vapi API integration.
 */
export async function processCallbacks(): Promise<void> {
  const db = getSupabase();

  // Find pending callbacks
  const { data: callbacks, error } = await db
    .from("callback_queue")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", 3) // Max 3 attempts
    .order("priority", { ascending: false }) // High priority first
    .order("created_at", { ascending: true }) // Oldest first
    .limit(10);

  if (error) {
    console.error("[CALLBACKS] Query error:", error);
    return;
  }

  if (!callbacks || callbacks.length === 0) {
    return; // No callbacks to process
  }

  console.log(`[CALLBACKS] Processing ${callbacks.length} callbacks`);

  for (const callback of callbacks) {
    try {
      // Mark as in progress
      await db
        .from("callback_queue")
        .update({
          status: "in_progress",
          attempts: callback.attempts + 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", callback.id);

      // TODO: Initiate outbound call via Vapi API
      // For now, just log
      console.log(
        `[CALLBACKS] Would call ${callback.phone_number} for tenant ${callback.tenant_id}`,
      );

      // Mark as completed (in production, this would be after successful call)
      // For now, mark as completed after logging
      await db
        .from("callback_queue")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          notes: "Auto-processed (outbound calls not yet implemented)",
        })
        .eq("id", callback.id);
    } catch (err) {
      console.error(`[CALLBACKS] Failed for ${callback.id}:`, err);

      // Mark as failed if max attempts reached
      if (callback.attempts >= 2) {
        await db
          .from("callback_queue")
          .update({
            status: "failed",
            notes: "Max attempts reached",
          })
          .eq("id", callback.id);
      } else {
        // Reset to pending for retry
        await db
          .from("callback_queue")
          .update({
            status: "pending",
          })
          .eq("id", callback.id);
      }
    }
  }
}
