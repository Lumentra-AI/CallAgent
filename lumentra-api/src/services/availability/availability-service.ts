// Availability Service - Slot management
import { getSupabase } from "../database/client.js";
import { AvailabilitySlot } from "../../types/crm.js";

export async function getAvailableSlots(
  tenantId: string,
  date: string,
  options: { resourceId?: string; slotType?: string } = {},
): Promise<AvailabilitySlot[]> {
  const db = getSupabase();

  let query = db
    .from("availability_slots")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("slot_date", date)
    .eq("status", "available")
    .lt("booked_count", db.rpc("get_slot_capacity")); // Custom RPC or raw filter

  if (options.resourceId) query = query.eq("resource_id", options.resourceId);
  if (options.slotType) query = query.eq("slot_type", options.slotType);

  const { data, error } = await query.order("start_time");
  if (error) throw new Error(`Failed to get slots: ${error.message}`);
  return data || [];
}

export async function getAvailableSlotsForRange(
  tenantId: string,
  startDate: string,
  endDate: string,
  options: { resourceId?: string } = {},
): Promise<AvailabilitySlot[]> {
  const db = getSupabase();

  let query = db
    .from("availability_slots")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("slot_date", startDate)
    .lte("slot_date", endDate)
    .eq("status", "available");

  if (options.resourceId) query = query.eq("resource_id", options.resourceId);

  const { data, error } = await query.order("slot_date").order("start_time");
  if (error) throw new Error(`Failed to get slots: ${error.message}`);

  // Filter slots with availability
  return (data || []).filter((s) => s.booked_count < s.total_capacity);
}

export async function createSlot(
  tenantId: string,
  data: {
    slot_date: string;
    start_time: string;
    end_time: string;
    slot_type?: string;
    resource_id?: string;
    total_capacity?: number;
    price_override_cents?: number;
    notes?: string;
  },
): Promise<AvailabilitySlot> {
  const db = getSupabase();

  const { data: slot, error } = await db
    .from("availability_slots")
    .insert({
      tenant_id: tenantId,
      ...data,
      slot_type: data.slot_type || "general",
      total_capacity: data.total_capacity || 1,
      booked_count: 0,
      status: "available",
      is_generated: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create slot: ${error.message}`);
  return slot;
}

export async function updateSlot(
  tenantId: string,
  id: string,
  updates: Partial<AvailabilitySlot>,
): Promise<AvailabilitySlot> {
  const db = getSupabase();
  delete (updates as any).id;
  delete (updates as any).tenant_id;

  const { data, error } = await db
    .from("availability_slots")
    .update(updates)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update slot: ${error.message}`);
  return data;
}

export async function blockSlot(
  tenantId: string,
  id: string,
  reason?: string,
): Promise<AvailabilitySlot> {
  return updateSlot(tenantId, id, { status: "blocked", notes: reason });
}

export async function unblockSlot(
  tenantId: string,
  id: string,
): Promise<AvailabilitySlot> {
  return updateSlot(tenantId, id, { status: "available", notes: undefined });
}

export async function deleteSlot(tenantId: string, id: string): Promise<void> {
  const db = getSupabase();
  const { error } = await db
    .from("availability_slots")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw new Error(`Failed to delete slot: ${error.message}`);
}

export async function checkAvailability(
  tenantId: string,
  date: string,
  time: string,
  _durationMinutes: number = 60,
  resourceId?: string,
): Promise<boolean> {
  const db = getSupabase();

  let query = db
    .from("availability_slots")
    .select("id, total_capacity, booked_count")
    .eq("tenant_id", tenantId)
    .eq("slot_date", date)
    .eq("start_time", time)
    .eq("status", "available");

  if (resourceId) query = query.eq("resource_id", resourceId);

  const { data, error } = await query.single();
  if (error?.code === "PGRST116") return false;
  if (error) throw new Error(`Failed to check availability: ${error.message}`);

  return data && data.booked_count < data.total_capacity;
}

export async function generateSlotsFromOperatingHours(
  tenantId: string,
  startDate: string,
  endDate: string,
  slotDurationMinutes: number = 60,
): Promise<number> {
  const db = getSupabase();

  // Get tenant operating hours
  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .select("operating_hours")
    .eq("id", tenantId)
    .single();

  if (tenantError)
    throw new Error(`Failed to get tenant: ${tenantError.message}`);

  const schedule = tenant.operating_hours?.schedule || [];
  const slots: any[] = [];

  // Generate slots for each day in range
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const daySchedule = schedule.find((s: any) => s.day === dayOfWeek);

    if (!daySchedule?.enabled) continue;

    const dateStr = d.toISOString().split("T")[0];
    const openMinutes = timeToMinutes(daySchedule.open_time);
    const closeMinutes = timeToMinutes(daySchedule.close_time);

    for (let t = openMinutes; t < closeMinutes; t += slotDurationMinutes) {
      slots.push({
        tenant_id: tenantId,
        slot_date: dateStr,
        start_time: minutesToTime(t),
        end_time: minutesToTime(t + slotDurationMinutes),
        slot_type: "general",
        total_capacity: 1,
        booked_count: 0,
        status: "available",
        is_generated: true,
      });
    }
  }

  if (slots.length === 0) return 0;

  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < slots.length; i += batchSize) {
    const batch = slots.slice(i, i + batchSize);
    const { error } = await db.from("availability_slots").upsert(batch, {
      onConflict: "tenant_id,resource_id,slot_date,start_time",
      ignoreDuplicates: true,
    });
    if (error) console.error(`Failed to insert slots batch: ${error.message}`);
  }

  return slots.length;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
