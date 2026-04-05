/**
 * Team Invite Email
 *
 * Sends invite notification emails to existing Supabase users
 * who are added to a tenant. Uses Resend for delivery.
 */

interface InviteEmailParams {
  to: string;
  businessName: string;
  inviterEmail: string | null;
  acceptUrl: string;
}

export async function sendTeamInviteEmail(
  params: InviteEmailParams,
): Promise<{ sent: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "noreply@lumentra.ai";

  if (!resendApiKey) {
    console.warn("[TEAM-EMAIL] RESEND_API_KEY not configured, skipping email");
    return { sent: false, error: "Email not configured" };
  }

  const subject = `You've been invited to ${params.businessName} on Lumentra`;
  const inviterLine = params.inviterEmail
    ? `${params.inviterEmail} has invited you`
    : `You've been invited`;

  const text = [
    `${inviterLine} to join ${params.businessName} on Lumentra.`,
    ``,
    `Sign in to accept your invitation:`,
    params.acceptUrl,
    ``,
    `If you didn't expect this invitation, you can safely ignore this email.`,
  ].join("\n");

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendApiKey);

    const { error } = await resend.emails.send({
      from,
      to: params.to,
      subject,
      text,
    });

    if (error) {
      console.error("[TEAM-EMAIL] Resend error:", error);
      return { sent: false, error: String(error) };
    }

    console.log(`[TEAM-EMAIL] Sent invite email to ${params.to}`);
    return { sent: true };
  } catch (error) {
    console.error("[TEAM-EMAIL] Failed to send:", error);
    return { sent: false, error: String(error) };
  }
}
