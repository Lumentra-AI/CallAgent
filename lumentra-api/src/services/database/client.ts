import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

/**
 * Get or create Supabase client
 * Uses connection pooling for better performance
 */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    // Prefer service role key for backend operations (bypasses RLS)
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY",
      );
    }

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: "public",
      },
    });

    console.log("[DB] Supabase client initialized");
  }

  return supabase;
}

/**
 * Get database connection status
 */
export async function getDbStatus(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    const startTime = Date.now();
    const db = getSupabase();

    // Simple query to test connection
    const { error } = await db.from("tenants").select("id").limit(1);

    if (error) {
      return {
        connected: false,
        error: error.message,
      };
    }

    return {
      connected: true,
      latency: Date.now() - startTime,
    };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
