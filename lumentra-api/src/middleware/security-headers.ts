import type { Context, Next } from "hono";

export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next();

    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    c.header(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'",
    );

    if (process.env.NODE_ENV === "production") {
      c.header(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    }

    if (!c.res.headers.has("Cache-Control")) {
      c.header("Cache-Control", "no-store, no-cache, must-revalidate");
    }
  };
}
