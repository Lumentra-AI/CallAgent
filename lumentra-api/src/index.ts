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
import { vapiRoutes } from "./routes/vapi.js";
import { callsRoutes } from "./routes/calls.js";
import { bookingsRoutes } from "./routes/bookings.js";
import { tenantsRoutes } from "./routes/tenants.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import signalwireVoice from "./routes/signalwire-voice.js";
import {
  handleSignalWireStream,
  isSignalWireStreamRequest,
} from "./routes/signalwire-stream.js";
import { initTenantCache } from "./services/database/tenant-cache.js";
import { startScheduler } from "./jobs/scheduler.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", timing());
app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// Routes
app.route("/health", healthRoutes);
app.route("/webhooks/vapi", vapiRoutes);
app.route("/signalwire", signalwireVoice);
app.route("/api/calls", callsRoutes);
app.route("/api/bookings", bookingsRoutes);
app.route("/api/tenants", tenantsRoutes);
app.route("/api/dashboard", dashboardRoutes);

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
const VOICE_PROVIDER = process.env.VOICE_PROVIDER || "vapi";

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
      console.log(`[STARTUP] Voice provider: ${VOICE_PROVIDER}`);
      if (VOICE_PROVIDER === "custom") {
        console.log(
          "[STARTUP] Custom voice stack enabled (SignalWire + Deepgram + Groq + Cartesia)",
        );
      } else {
        console.log("[STARTUP] Vapi voice stack enabled");
      }
    },
  ) as Server;

  // Set up WebSocket server for SignalWire media streams
  if (VOICE_PROVIDER === "custom") {
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
}

start().catch((err) => {
  console.error("[FATAL] Failed to start server:", err);
  process.exit(1);
});

export default app;
