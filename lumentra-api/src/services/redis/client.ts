/**
 * Redis Client Singleton
 * Used for rate limiting persistence across restarts.
 * Falls back gracefully if REDIS_URL is not configured.
 */

import { createClient } from "redis";

let redisClient: ReturnType<typeof createClient> | null = null;
let connectionFailed = false;

export async function getRedisClient() {
  if (connectionFailed) return null;

  if (!redisClient) {
    const url = process.env.REDIS_URL;
    if (!url) return null;

    redisClient = createClient({ url });
    redisClient.on("error", (err) => {
      console.error("[REDIS] Connection error:", err.message);
    });

    try {
      await redisClient.connect();
      console.info("[REDIS] Connected to", url.replace(/\/\/.*@/, "//***@"));
    } catch (err) {
      console.error(
        "[REDIS] Failed to connect, falling back to in-memory:",
        err instanceof Error ? err.message : err,
      );
      connectionFailed = true;
      redisClient = null;
      return null;
    }
  }

  return redisClient;
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
