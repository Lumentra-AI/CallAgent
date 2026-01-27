// Build: 2026-01-27-v3 - Force fresh build
import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { timing } from "hono/timing";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";

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
import signalwireVoice from "./routes/signalwire-voice.js";
import trainingDataRoutes from "./routes/training-data.js";
import { chatRoutes } from "./routes/chat.js";
import {
  handleSignalWireStream,
  isSignalWireStreamRequest,
} from "./routes/signalwire-stream.js";
import { initTenantCache } from "./services/database/tenant-cache.js";
import { startScheduler } from "./jobs/scheduler.js";
import { authMiddleware, rateLimit } from "./middleware/index.js";

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
      // Allow localhost on any port for development
      if (origin && origin.startsWith("http://localhost:")) {
        return origin;
      }
      return allowedOrigins.includes(origin || "") ? origin : allowedOrigins[0];
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Tenant-ID",
      "X-User-ID",
      "X-User-Name",
    ],
  }),
);

// Global rate limiting
app.use("*", rateLimit({ windowMs: 60000, max: 100 }));

// WebSocket stream route - placeholder for upgrade handling
// The actual WebSocket logic is in the upgrade handler below
app.get("/signalwire/stream", (c) => {
  // This should never be reached - WebSocket upgrade happens before this
  // If we get here, the client didn't send proper WebSocket headers
  return c.json({ error: "WebSocket upgrade required" }, 426);
});

// Public routes (no auth required)
app.route("/health", healthRoutes);
app.route("/signalwire", signalwireVoice);
app.route("/api/chat", chatRoutes); // Chat widget is public

// Auth middleware for protected /api/* routes
app.use("/api/*", authMiddleware());

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
  return c.json(
    {
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    },
    500,
  );
});

// Startup
const port = parseInt(process.env.PORT || "3001", 10);

async function start() {
  console.log("[STARTUP] Initializing Lumentra API...");

  // Initialize tenant cache for low-latency webhook responses
  await initTenantCache();
  console.log("[STARTUP] Tenant cache initialized");

  // Start background job scheduler
  startScheduler();
  console.log("[STARTUP] Job scheduler started");

  // Start HTTP server
  const server = serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`[STARTUP] Server running on http://localhost:${info.port}`);
      console.log(
        "[STARTUP] Voice stack: SignalWire + Deepgram + Gemini + Cartesia",
      );
    },
  ) as Server;

  // Set up WebSocket server for SignalWire media streams
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    const url = request.url || "";

    if (isSignalWireStreamRequest(url)) {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        console.log("[WEBSOCKET] SignalWire stream connection");
        handleSignalWireStream(ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  console.log("[STARTUP] WebSocket server initialized for media streams");
}

start().catch((err) => {
  console.error("[FATAL] Failed to start server:", err);
  process.exit(1);
});

export default app;
