// Availability Slot Generator Job
import { getSupabase } from "../services/database/client.js";
import { generateSlotsFromOperatingHours } from "../services/availability/availability-service.js";

/**
 * Generate availability slots for all tenants for the next 30 days
 * Runs daily at midnight
 */
export async function generateDailySlots(): Promise<void> {
  const db = getSupabase();

  // Get all active tenants
  const { data: tenants, error } = await db
    .from("tenants")
    .select("id")
    .eq("is_active", true);

  if (error || !tenants) {
    console.error("[SLOTS] Failed to get tenants:", error);
    return;
  }

  // Generate slots for the next 30 days
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); // Start from tomorrow
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 30);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  let totalGenerated = 0;

  for (const tenant of tenants) {
    try {
      const count = await generateSlotsFromOperatingHours(
        tenant.id,
        startDateStr,
        endDateStr,
      );
      totalGenerated += count;
    } catch (err) {
      console.error(`[SLOTS] Failed for tenant ${tenant.id}:`, err);
    }
  }

  console.log(
    `[SLOTS] Generated ${totalGenerated} slots for ${tenants.length} tenants`,
  );
}

/**
 * Cleanup old availability slots (older than 90 days)
 * Removes slots that are past and no longer needed
 */
export async function cleanupOldSlots(): Promise<void> {
  const db = getSupabase();

  // Delete slots older than 90 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

  const { error, count } = await db
    .from("availability_slots")
    .delete()
    .lt("slot_date", cutoffDateStr);

  if (error) {
    console.error("[SLOTS] Cleanup failed:", error);
    return;
  }

  if (count && count > 0) {
    console.log(`[SLOTS] Cleaned up ${count} old slots`);
  }
}

/**
 * Generate slots for a specific tenant
 */
export async function generateSlotsForTenant(
  tenantId: string,
  daysAhead: number = 30,
): Promise<number> {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + daysAhead);

  return generateSlotsFromOperatingHours(
    tenantId,
    startDate.toISOString().split("T")[0],
    endDate.toISOString().split("T")[0],
  );
}
