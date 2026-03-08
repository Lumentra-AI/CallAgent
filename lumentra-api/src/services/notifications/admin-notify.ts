/**
 * Admin Notification Helper
 *
 * Sends email alerts to the Lumentra admin team via Resend.
 * Used for port requests, stuck jobs, and other platform-level alerts.
 */

const EMAIL_SUBJECTS: Record<string, string> = {
  port_request_submitted: "New port request submitted",
  port_request_completed: "Port request completed",
  port_requests_stale_drafts: "Port requests need attention - stale drafts",
  port_requests_stuck: "Port requests stuck - carrier may have stalled",
};

function formatEmailBody(type: string, data: Record<string, unknown>): string {
  switch (type) {
    case "port_request_submitted":
      return [
        `A new number port request has been submitted.`,
        ``,
        `Phone number: ${data.phoneNumber}`,
        `Carrier: ${data.carrier}`,
        `Authorized name: ${data.authorizedName}`,
        `Temporary number: ${data.temporaryNumber || "None"}`,
        `Tenant ID: ${data.tenantId}`,
        `Port Request ID: ${data.portRequestId}`,
        ``,
        `Action required: Review and submit the port to SignalWire.`,
      ].join("\n");

    case "port_request_completed":
      return [
        `A number port has been completed.`,
        ``,
        `Ported number: ${data.portedNumber}`,
        `Released temp number: ${data.releasedTempNumber || "None"}`,
        `Tenant ID: ${data.tenantId}`,
      ].join("\n");

    case "port_requests_stale_drafts": {
      const requests = data.requests as Array<Record<string, unknown>>;
      const lines = requests.map(
        (r) =>
          `  - ${r.phoneNumber} (${r.carrier}) for ${r.business} — ${r.daysSinceCreated} days old`,
      );
      return [
        `${data.count} port request(s) have been sitting in draft for over 7 days.`,
        `These need admin action:`,
        ``,
        ...lines,
      ].join("\n");
    }

    case "port_requests_stuck": {
      const requests = data.requests as Array<Record<string, unknown>>;
      const lines = requests.map(
        (r) =>
          `  - ${r.phoneNumber} (${r.carrier}) for ${r.business} — status: ${r.status}, ${r.daysSinceSubmitted} days since submitted`,
      );
      return [
        `${data.count} port request(s) appear stuck (over 28 days since submission).`,
        `Follow up with the carrier:`,
        ``,
        ...lines,
      ].join("\n");
    }

    default:
      return `Admin notification: ${type}\n\n${JSON.stringify(data, null, 2)}`;
  }
}

export async function notifyAdmin(
  type: string,
  data: Record<string, unknown>,
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!adminEmail || !resendApiKey) {
    console.warn(
      `[ADMIN] Email not configured (ADMIN_EMAIL or RESEND_API_KEY missing), logging: ${type}`,
      data,
    );
    return;
  }

  const subject = EMAIL_SUBJECTS[type] || `Admin alert: ${type}`;
  const body = formatEmailBody(type, data);
  const from = process.env.EMAIL_FROM || "noreply@lumentra.ai";

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendApiKey);

    const { error } = await resend.emails.send({
      from,
      to: adminEmail,
      subject: `[Lumentra] ${subject}`,
      text: body,
    });

    if (error) {
      console.error("[ADMIN] Resend error:", error);
    } else {
      console.log(`[ADMIN] Sent email to ${adminEmail}: ${subject}`);
    }
  } catch (error) {
    console.error("[ADMIN] Failed to send admin email:", error);
  }
}
