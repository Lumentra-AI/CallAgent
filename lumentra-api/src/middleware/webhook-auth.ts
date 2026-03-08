import { timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";

let warnedMissingSecret = false;

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function validateWebhookSecret() {
  return async (c: Context, next: Next) => {
    const expectedSecret = process.env.SIGNALWIRE_WEBHOOK_SECRET;

    if (!expectedSecret) {
      if (!warnedMissingSecret) {
        console.warn(
          "[WEBHOOK] SIGNALWIRE_WEBHOOK_SECRET is not configured; allowing webhook request",
        );
        warnedMissingSecret = true;
      }

      await next();
      return;
    }

    const providedSecret = c.req.query("webhook_secret");

    if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
      return c.json({ error: "Invalid webhook signature" }, 403);
    }

    await next();
  };
}
