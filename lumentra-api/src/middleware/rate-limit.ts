/**
 * Rate Limiting Middleware
 * Uses Redis when REDIS_URL is set, falls back to in-memory.
 * Redis keys: ratelimit:{prefix}:{clientKey} with auto-expiry.
 */

import { Context, Next } from "hono";
import { getRedisClient } from "../services/redis/client.js";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory fallback store
const memoryStore = new Map<string, RateLimitEntry>();

// Clean up expired in-memory entries periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}, 60000);

cleanupInterval.unref?.();

/**
 * Try Redis increment, return null if unavailable.
 */
async function redisIncrement(
  key: string,
  windowMs: number,
): Promise<{ count: number; resetAt: number } | null> {
  try {
    const redis = await getRedisClient();
    if (!redis) return null;

    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);

    if (count === 1) {
      await redis.pExpire(redisKey, windowMs);
    }

    const ttl = await redis.pTTL(redisKey);
    const resetAt = Date.now() + Math.max(ttl, 0);

    return { count, resetAt };
  } catch {
    return null;
  }
}

/**
 * In-memory increment (fallback).
 */
function memoryIncrement(
  key: string,
  windowMs: number,
): { count: number; resetAt: number } {
  const now = Date.now();
  let entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
  }

  entry.count++;
  memoryStore.set(key, entry);

  return { count: entry.count, resetAt: entry.resetAt };
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  prefix?: string;
  keyGenerator?: (c: Context) => string;
  skip?: (c: Context) => boolean;
  message?: string;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60000,
  max: 60,
  message: "Too many requests, please try again later",
};

let rateLimitPrefixCounter = 0;

/**
 * Create rate limiting middleware
 */
export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const options = { ...defaultConfig, ...config };
  const prefix = options.prefix || `rl_${++rateLimitPrefixCounter}`;

  return async (c: Context, next: Next) => {
    if (options.skip?.(c)) {
      return next();
    }

    const clientKey = options.keyGenerator
      ? options.keyGenerator(c)
      : getClientKey(c);
    const key = `${prefix}:${clientKey}`;

    // Try Redis first, fall back to in-memory
    const result =
      (await redisIncrement(key, options.windowMs)) ||
      memoryIncrement(key, options.windowMs);

    const now = Date.now();
    const remaining = Math.max(0, options.max - result.count);
    const resetInSeconds = Math.ceil((result.resetAt - now) / 1000);

    c.header("X-RateLimit-Limit", options.max.toString());
    c.header("X-RateLimit-Remaining", remaining.toString());
    c.header("X-RateLimit-Reset", resetInSeconds.toString());

    if (result.count > options.max) {
      c.header("Retry-After", resetInSeconds.toString());
      return c.json(
        {
          error: "Too Many Requests",
          message: options.message,
          retryAfter: resetInSeconds,
        },
        429,
      );
    }

    await next();
  };
}

/**
 * Get client key for rate limiting
 * Uses authenticated user ID if available, otherwise IP
 */
function getClientKey(c: Context): string {
  const auth = c.get("auth");
  if (auth?.userId) {
    return `user:${auth.userId}`;
  }

  const forwardedFor = c.req.header("X-Forwarded-For");
  const realIp = c.req.header("X-Real-IP");

  if (forwardedFor) {
    return `ip:${forwardedFor.split(",")[0].trim()}`;
  }
  if (realIp) {
    return `ip:${realIp}`;
  }
  return `ip:unknown`;
}

/**
 * Stricter rate limit for sensitive endpoints
 */
export function strictRateLimit(prefix?: string) {
  return rateLimit({
    prefix,
    windowMs: 60000,
    max: 10,
    message: "Too many attempts, please try again later",
  });
}

/**
 * Very strict rate limit for critical operations
 */
export function criticalRateLimit(prefix?: string) {
  return rateLimit({
    prefix,
    windowMs: 3600000,
    max: 5,
    message: "Rate limit exceeded. Please try again in an hour.",
  });
}

/**
 * Generous rate limit for read-heavy endpoints
 */
export function readRateLimit(prefix?: string) {
  return rateLimit({
    prefix,
    windowMs: 60000,
    max: 120,
  });
}

/**
 * Rate limit by tenant (for multi-tenant fair usage)
 */
export function tenantRateLimit(maxPerMinute: number = 300, prefix?: string) {
  return rateLimit({
    prefix,
    windowMs: 60000,
    max: maxPerMinute,
    keyGenerator: (c) => {
      const auth = c.get("auth");
      if (auth?.tenantId) {
        return `tenant:${auth.tenantId}`;
      }
      const tenantId = c.req.header("X-Tenant-ID");
      return tenantId ? `tenant:${tenantId}` : getClientKey(c);
    },
  });
}
