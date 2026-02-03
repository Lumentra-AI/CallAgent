/**
 * Run migration 014 via Supabase client
 */
import "dotenv/config";
import { getSupabase } from "./services/database/client.js";

const migration = `
CREATE TABLE IF NOT EXISTS pending_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  requested_date DATE,
  requested_time TIME,
  service TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_bookings_tenant ON pending_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pending_bookings_status ON pending_bookings(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_bookings_created ON pending_bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_bookings_call ON pending_bookings(call_id);
`;

async function runMigration() {
  console.log("Running migration 014_pending_bookings...");

  const db = getSupabase();

  // Use rpc to execute raw SQL (requires db_execute function or similar)
  // Alternatively, we just test if the table exists by querying it

  const { error } = await db.from("pending_bookings").select("id").limit(1);

  if (error && error.code === "PGRST205") {
    console.log("Table does not exist. Please run the migration manually:");
    console.log("\n--- Run this SQL in your Supabase dashboard ---\n");
    console.log(migration);
    console.log("\n--- End of SQL ---\n");
    process.exit(1);
  } else if (error) {
    console.log("Error checking table:", error);
    process.exit(1);
  } else {
    console.log("Table pending_bookings already exists!");
  }
}

runMigration().catch(console.error);
