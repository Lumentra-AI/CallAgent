import { timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";

function keysMatch(providedToken: string, expectedKey: string): boolean {
  const providedBuffer = Buffer.from(providedToken);
  const expectedBuffer = Buffer.from(expectedKey);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function internalAuth() {
  return async (c: Context, next: Next) => {
    const apiKey = process.env.INTERNAL_API_KEY;
    if (!apiKey) {
      console.error("[INTERNAL] INTERNAL_API_KEY not configured");
      return c.json({ error: "Internal API not configured" }, 500);
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Missing Authorization header" }, 401);
    }

    const token = authHeader.slice(7);
    if (!keysMatch(token, apiKey)) {
      return c.json({ error: "Invalid API key" }, 403);
    }

    await next();
  };
}
