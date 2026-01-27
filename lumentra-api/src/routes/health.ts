import { Hono } from "hono";
import { getDbStatus } from "../services/database/client.js";
import { getTenantCacheStats } from "../services/database/tenant-cache.js";
import { genAI, modelName } from "../services/gemini/client.js";

export const healthRoutes = new Hono();

// Get LLM configuration status
function getLlmStatus() {
  return {
    provider: "gemini",
    configured: !!genAI,
    model: modelName,
  };
}

healthRoutes.get("/", async (c) => {
  const startTime = Date.now();
  const dbStatus = await getDbStatus();
  const cacheStats = getTenantCacheStats();
  const llmStatus = getLlmStatus();
  const latency = Date.now() - startTime;

  const healthy = dbStatus.connected && llmStatus.configured;

  return c.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      latency: `${latency}ms`,
      services: {
        database: dbStatus,
        tenantCache: cacheStats,
        llm: llmStatus,
      },
      config: {
        voiceStack: "signalwire+deepgram+gemini+cartesia",
        nodeEnv: process.env.NODE_ENV || "development",
      },
    },
    healthy ? 200 : 503,
  );
});

// Quick health check for load balancers (no DB check)
healthRoutes.get("/ping", (c) => {
  return c.text("pong");
});
