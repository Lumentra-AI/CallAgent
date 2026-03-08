/**
 * Admin Notification Helper
 *
 * Posts notifications to the Lumentra admin team via webhook (Slack, email, etc.).
 * Used for port requests, stuck jobs, and other platform-level alerts.
 */

interface AdminNotificationPayload {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export async function notifyAdmin(
  type: string,
  data: Record<string, unknown>,
): Promise<void> {
  const webhookUrl = process.env.ADMIN_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn(
      `[ADMIN] No ADMIN_WEBHOOK_URL configured, logging notification: ${type}`,
      data,
    );
    return;
  }

  const payload: AdminNotificationPayload = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(
        `[ADMIN] Webhook returned ${response.status}: ${await response.text()}`,
      );
    }
  } catch (error) {
    console.error("[ADMIN] Failed to send notification:", error);
  }
}
