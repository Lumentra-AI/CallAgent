import { Hono } from "hono";
import { getDbStatus } from "../services/database/client.js";
import { getTenantCacheStats } from "../services/database/tenant-cache.js";
import { getProviderStatus } from "../services/llm/multi-provider.js";

export const healthRoutes = new Hono();

// Get LLM configuration status for all providers
function getLlmStatus() {
  const providers = getProviderStatus();
  const hasAnyProvider = Object.values(providers).some((p) => p.model !== null);
  const availableProviders = Object.entries(providers)
    .filter(([, p]) => p.model !== null)
    .map(([name]) => name);

  return {
    configured: hasAnyProvider,
    providers,
    availableProviders,
    fallbackOrder: ["gemini", "openai", "groq"],
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
        voiceStack: "signalwire+deepgram+multi-llm+cartesia",
        llmFallback: "gemini->openai->groq",
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
