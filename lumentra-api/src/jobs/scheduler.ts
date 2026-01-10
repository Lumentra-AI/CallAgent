import cron from "node-cron";
import { processReminders } from "./reminders.js";
import { processCallbacks } from "./callbacks.js";

/**
 * Start the background job scheduler
 *
 * Jobs:
 * - Every minute: Process booking reminders (24h before)
 * - Every 5 minutes: Process callback queue for missed calls
 */
export function startScheduler(): void {
  console.log("[SCHEDULER] Starting background jobs");

  // Process booking reminders every minute
  cron.schedule("* * * * *", async () => {
    try {
      await processReminders();
    } catch (error) {
      console.error("[SCHEDULER] Reminder job failed:", error);
    }
  });

  // Process callback queue every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      await processCallbacks();
    } catch (error) {
      console.error("[SCHEDULER] Callback job failed:", error);
    }
  });

  console.log("[SCHEDULER] Jobs scheduled:");
  console.log("  - Reminders: every minute");
  console.log("  - Callbacks: every 5 minutes");
}
