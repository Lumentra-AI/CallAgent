import * as Sentry from "@sentry/node";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { timing } from "hono/timing";

import { healthRoutes } from "./routes/health.js";
import { callsRoutes } from "./routes/calls.js";
import { bookingsRoutes } from "./routes/bookings.js";
import { tenantsRoutes } from "./routes/tenants.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { contactsRoutes } from "./routes/contacts.js";
import { availabilityRoutes } from "./routes/availability.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { resourcesRoutes } from "./routes/resources.js";
import { voicemailRoutes } from "./routes/voicemails.js";
import trainingDataRoutes from "./routes/training-data.js";
import { chatRoutes } from "./routes/chat.js";
import { chatSessionsRoutes } from "./routes/chat-sessions.js";
import { setupRoutes } from "./routes/setup.js";
import { capabilitiesRoutes } from "./routes/capabilities.js";
import { integrationsRoutes } from "./routes/integrations.js";
import { phoneConfigRoutes } from "./routes/phone-config.js";
import { escalationRoutes } from "./routes/escalation.js";
import { escalationEventsRoutes } from "./routes/escalation-events.js";
import { knowledgeBaseRoutes } from "./routes/knowledge-base.js";
import { promotionsRoutes } from "./routes/promotions.js";
import { pendingBookingsRoutes } from "./routes/pending-bookings.js";
import { dealsRoutes } from "./routes/deals.js";
import { tasksRoutes } from "./routes/tasks.js";
import { featuresRoutes } from "./routes/features.js";
import { teamRoutes } from "./routes/team.js";
import { activityRoutes } from "./routes/activity.js";
import { internalRoutes } from "./routes/internal.js";
import { adminRoutes } from "./routes/admin.js";
import { adminAnalyticsRoutes } from "./routes/admin-analytics.js";
import { adminMonitoringRoutes } from "./routes/admin-monitoring.js";
import vapiWebhook from "./routes/vapi-webhook.js";
import {
  authMiddleware,
  userAuthMiddleware,
  platformAdminAuth,
  rateLimit,
  tenantRateLimit,
  validateWebhookSecret,
  securityHeaders,
} from "./middleware/index.js";

function isSipForwardRequest(c: Context): boolean {
  return c.req.path === "/sip/forward";
}

async function sipForwardHandler(c: Context) {
  const livekitSipHost = process.env.LIVEKIT_SIP_HOST || "178.156.205.145";
  const livekitSipPort = process.env.LIVEKIT_SIP_PORT || "5060";

  // Extract dialed number from SignalWire webhook body (form-encoded)
  let dialedNumber = "";
  try {
    const body = await c.req.parseBody();
    dialedNumber = (body["To"] as string) || (body["Called"] as string) || "";
    // Strip non-digit/+ chars for safety, keep E.164 format
    dialedNumber = dialedNumber.replace(/[^\d+]/g, "");
  } catch {
    console.warn("[SIP] Could not parse webhook body for dialed number");
  }

  // Include dialed number as SIP URI user part so LiveKit can identify the tenant
  const sipUser = dialedNumber ? `${dialedNumber}@` : "";
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>sip:${sipUser}${livekitSipHost}:${livekitSipPort};transport=udp</Sip>
  </Dial>
</Response>`;

  return c.text(twiml, 200, { "Content-Type": "application/xml" });
}

export function createApp() {
  const app = new Hono();

  // Middleware
  app.use("*", logger());
  app.use("*", timing());
  app.use(
    "*",
    cors({
      origin: (origin) => {
        const allowed = process.env.FRONTEND_URL || "http://localhost:3000";
        const allowedOrigins = allowed.split(",").map((o) => o.trim());
        const isProduction = process.env.NODE_ENV === "production";

        // In production, only allow configured origins
        if (isProduction) {
          return allowedOrigins.includes(origin || "") ? origin : null;
        }

        // In development, allow localhost on any port
        if (origin && origin.startsWith("http://localhost:")) {
          return origin;
        }
        return allowedOrigins.includes(origin || "")
          ? origin
          : allowedOrigins[0];
      },
      allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-Tenant-ID",
        "X-User-ID",
        "X-User-Name",
      ],
      credentials: true,
    }),
  );
  app.use("*", securityHeaders());

  // Global rate limiting
  app.use(
    "*",
    rateLimit({
      prefix: "global",
      windowMs: 60000,
      max: 300,
      skip: isSipForwardRequest,
    }),
  );

  // SIP forwarding endpoint - SignalWire calls this to route calls to LiveKit SIP bridge
  // Must remain public, but requests are now authenticated with a shared webhook secret.
  app.use(
    "/sip/forward",
    rateLimit({
      prefix: "sip-forward",
      windowMs: 60000,
      max: 30,
      message: "Too many SIP forwarding requests, please try again later.",
    }),
  );
  app.post("/sip/forward", validateWebhookSecret(), sipForwardHandler);

  // Public routes (no auth required)
  app.route("/health", healthRoutes);
  app.route("/api/chat", chatRoutes); // Chat widget is public
  app.route("/internal", internalRoutes); // LiveKit agent API (own auth via INTERNAL_API_KEY)
  // SSE endpoint with query-param auth (EventSource cannot send headers)
  app.route("/api/escalation/events", escalationEventsRoutes);
  app.route("/webhooks/vapi", vapiWebhook); // Vapi voice AI webhook (own auth via VAPI_WEBHOOK_SECRET)
  app.use("/admin/*", platformAdminAuth());
  app.route("/admin", adminRoutes);
  app.route("/admin", adminAnalyticsRoutes);
  app.route("/admin", adminMonitoringRoutes);

  // User-only auth (no tenant required) for setup and tenant listing
  app.use("/api/setup/*", userAuthMiddleware());
  app.use(
    "/api/setup/*",
    rateLimit({
      prefix: "setup",
      windowMs: 60000,
      max: 20,
    }),
  );
  app.use("/api/tenants", userAuthMiddleware());
  app.use("/api/tenants/*", userAuthMiddleware());

  // Full auth (requires X-Tenant-ID) for all other API routes
  app.use("/api/*", authMiddleware());
  app.use("/api/*", tenantRateLimit(300, "tenant-api"));

  // Protected API routes
  app.route("/api/calls", callsRoutes);
  app.route("/api/bookings", bookingsRoutes);
  app.route("/api/tenants", tenantsRoutes);
  app.route("/api/dashboard", dashboardRoutes);
  app.route("/api/contacts", contactsRoutes);
  app.route("/api/availability", availabilityRoutes);
  app.route("/api/notifications", notificationsRoutes);
  app.route("/api/resources", resourcesRoutes);
  app.route("/api/voicemails", voicemailRoutes);
  app.route("/api/training", trainingDataRoutes);
  // Setup wizard routes
  app.route("/api/setup", setupRoutes);
  app.route("/api/capabilities", capabilitiesRoutes);
  app.route("/api/integrations", integrationsRoutes);
  app.route("/api/phone", phoneConfigRoutes);
  app.route("/api/escalation", escalationRoutes);
  app.route("/api/promotions", promotionsRoutes);
  app.route("/api/pending-bookings", pendingBookingsRoutes);
  app.route("/api/deals", dealsRoutes);
  app.route("/api/tasks", tasksRoutes);
  app.route("/api/chat-sessions", chatSessionsRoutes);
  app.route("/api/features", featuresRoutes);
  app.route("/api/knowledge-base", knowledgeBaseRoutes);
  app.route("/api/team", teamRoutes);
  app.route("/api/activity", activityRoutes);

  // Root
  app.get("/", (c) => {
    return c.json({
      name: "Lumentra API",
      version: "0.1.0",
      status: "operational",
    });
  });

  // 404 handler
  app.notFound((c) => {
    return c.json({ error: "Not found" }, 404);
  });

  // Error handler
  app.onError((err, c) => {
    console.error("[ERROR]", err);
    Sentry.captureException(err, {
      extra: { path: c.req.path, method: c.req.method },
    });
    return c.json(
      {
        error: "Internal server error",
        message:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      500,
    );
  });

  return app;
}

export const app = createApp();

export default app;
