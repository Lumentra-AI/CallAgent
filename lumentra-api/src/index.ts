import "./instrument.js";
import "dotenv/config";
import { serve } from "@hono/node-server";
import { initTenantCache } from "./services/database/tenant-cache.js";
import { initDatabase, closePool } from "./services/database/client.js";
import { closeRedis } from "./services/redis/client.js";
import { startScheduler } from "./jobs/scheduler.js";
import app from "./app.js";

// Startup
const port = parseInt(process.env.PORT || "3001", 10);

async function start() {
  console.log("[STARTUP] Initializing Lumentra API...");

  const isProduction = process.env.NODE_ENV === "production";

  // Validate critical environment variables at startup
  const requiredEnv = ["DATABASE_URL"];
  if (isProduction) {
    requiredEnv.push(
      "FRONTEND_URL",
      "BACKEND_URL",
      "ENCRYPTION_KEY",
      "SIGNALWIRE_WEBHOOK_SECRET",
    );
  }
  const recommendedEnv = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "INTERNAL_API_KEY",
    "RESEND_API_KEY",
    "PLATFORM_ADMIN_EMAILS",
  ];

  const missingRequired = requiredEnv.filter((key) => !process.env[key]);
  if (missingRequired.length > 0) {
    console.error(
      `[STARTUP] FATAL: Missing required env vars: ${missingRequired.join(", ")}`,
    );
    process.exit(1);
  }

  const missingRecommended = recommendedEnv.filter((key) => !process.env[key]);
  if (missingRecommended.length > 0) {
    console.warn(
      `[STARTUP] WARNING: Missing recommended env vars: ${missingRecommended.join(", ")}`,
    );
  }

  if (!isProduction) {
    console.warn(
      `[STARTUP] WARNING: NODE_ENV is "${process.env.NODE_ENV || "undefined"}" - set to "production" for production deploys`,
    );
  }

  // Initialize database connection pool
  initDatabase();
  console.log("[STARTUP] Database pool initialized");

  // Initialize tenant cache for low-latency webhook responses
  await initTenantCache();
  console.log("[STARTUP] Tenant cache initialized");

  // Start background job scheduler
  startScheduler();
  console.log("[STARTUP] Job scheduler started");

  // Start HTTP server
  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`[STARTUP] Server running on http://localhost:${info.port}`);
      console.log(
        "[STARTUP] Voice stack: LiveKit Agents (Deepgram + OpenAI + Cartesia)",
      );
    },
  );

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    console.log(`[SHUTDOWN] Received ${signal}, closing connections...`);
    await closePool();
    await closeRedis();
    console.log("[SHUTDOWN] Database pool and Redis closed");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("[FATAL] Failed to start server:", err);
  process.exit(1);
});

export default app;
