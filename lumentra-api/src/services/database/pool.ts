import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

let pool: Pool | null = null;

// Configuration
const POOL_CONFIG = {
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail if can't connect in 5s
};

const SLOW_QUERY_THRESHOLD_MS = 100;

/**
 * Initialize the connection pool
 * Call this once at application startup
 */
export function initPool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

  pool = new Pool({
    connectionString,
    ...POOL_CONFIG,
  });

  // Log pool events
  pool.on("connect", () => {
    console.log("[DB] New client connected to pool");
  });

  pool.on("error", (err) => {
    console.error("[DB] Unexpected pool error:", err.message);
  });

  console.log("[DB] PostgreSQL pool initialized");
  return pool;
}

/**
 * Get the connection pool (initializes if needed)
 */
export function getPool(): Pool {
  if (!pool) {
    return initPool();
  }
  return pool;
}

/**
 * Execute a query with automatic slow query logging
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const start = Date.now();
  const p = getPool();

  try {
    const result = await p.query<T>(text, params);
    const duration = Date.now() - start;

    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 100));
    }

    return result;
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[DB] Query failed (${duration}ms):`, text.substring(0, 100));
    throw err;
  }
}

/**
 * Execute a query and return the first row (or null)
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
}

/**
 * Execute a query and return all rows
 */
export async function queryAll<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

/**
 * Execute a query and return row count
 */
export async function queryCount(
  text: string,
  params?: unknown[],
): Promise<number> {
  const result = await query(text, params);
  return result.rowCount ?? 0;
}

/**
 * Transaction helper
 * Automatically handles BEGIN, COMMIT, and ROLLBACK
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const p = getPool();
  const client = await p.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Check database health
 */
export async function checkHealth(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
  poolStats?: {
    total: number;
    idle: number;
    waiting: number;
  };
}> {
  const start = Date.now();

  try {
    const p = getPool();
    await p.query("SELECT 1");
    const latency = Date.now() - start;

    return {
      connected: true,
      latency,
      poolStats: {
        total: p.totalCount,
        idle: p.idleCount,
        waiting: p.waitingCount,
      },
    };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Gracefully close the pool
 * Call this on application shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    console.log("[DB] Closing connection pool...");
    await pool.end();
    pool = null;
    console.log("[DB] Connection pool closed");
  }
}
