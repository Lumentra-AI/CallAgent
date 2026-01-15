// Resource Service - Staff, Rooms, Equipment management
import { getSupabase } from "../database/client.js";
import {
  Resource,
  CreateResourceInput,
  PaginationParams,
  PaginatedResult,
} from "../../types/crm.js";

// ============================================================================
// CRUD
// ============================================================================

export async function createResource(
  tenantId: string,
  input: CreateResourceInput,
): Promise<Resource> {
  const db = getSupabase();

  const { data, error } = await db
    .from("resources")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      type: input.type,
      description: input.description,
      capacity: input.capacity ?? 1,
      default_duration_minutes: input.default_duration_minutes ?? 60,
      accepts_bookings: input.accepts_bookings ?? true,
      buffer_before_minutes: input.buffer_before_minutes ?? 0,
      buffer_after_minutes: input.buffer_after_minutes ?? 0,
      color: input.color,
      metadata: input.metadata ?? {},
      is_active: true,
      sort_order: 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create resource: ${error.message}`);
  return data;
}

export async function getResource(
  tenantId: string,
  id: string,
): Promise<Resource | null> {
  const db = getSupabase();

  const { data, error } = await db
    .from("resources")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw new Error(`Failed to get resource: ${error.message}`);
  return data;
}

export async function updateResource(
  tenantId: string,
  id: string,
  updates: Partial<
    CreateResourceInput & { is_active?: boolean; sort_order?: number }
  >,
): Promise<Resource> {
  const db = getSupabase();

  // Don't allow updating id or tenant_id
  const cleanUpdates: Record<string, unknown> = { ...updates };
  delete cleanUpdates.id;
  delete cleanUpdates.tenant_id;

  const { data, error } = await db
    .from("resources")
    .update(cleanUpdates)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update resource: ${error.message}`);
  return data;
}

export async function deleteResource(
  tenantId: string,
  id: string,
): Promise<void> {
  const db = getSupabase();

  // Soft delete - just set is_active to false
  const { error } = await db
    .from("resources")
    .update({ is_active: false })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) throw new Error(`Failed to delete resource: ${error.message}`);
}

export async function hardDeleteResource(
  tenantId: string,
  id: string,
): Promise<void> {
  const db = getSupabase();

  const { error } = await db
    .from("resources")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) throw new Error(`Failed to delete resource: ${error.message}`);
}

// ============================================================================
// LIST & SEARCH
// ============================================================================

export interface ResourceFilters {
  type?: string | string[];
  is_active?: boolean;
  accepts_bookings?: boolean;
  search?: string;
}

export async function listResources(
  tenantId: string,
  filters: ResourceFilters = {},
  pagination: PaginationParams = {},
): Promise<PaginatedResult<Resource>> {
  const db = getSupabase();
  const limit = pagination.limit || 50;
  const offset = pagination.offset || 0;

  let query = db
    .from("resources")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId);

  // Apply filters
  if (filters.type) {
    const types = Array.isArray(filters.type) ? filters.type : [filters.type];
    query = query.in("type", types);
  }

  if (filters.is_active !== undefined) {
    query = query.eq("is_active", filters.is_active);
  }

  if (filters.accepts_bookings !== undefined) {
    query = query.eq("accepts_bookings", filters.accepts_bookings);
  }

  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
    );
  }

  // Sorting
  const sortBy = pagination.sort_by || "sort_order";
  const sortOrder = pagination.sort_order || "asc";
  query = query
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`Failed to list resources: ${error.message}`);

  return {
    data: data || [],
    total: count || 0,
    limit,
    offset,
    has_more: (count || 0) > offset + limit,
  };
}

export async function getActiveResources(
  tenantId: string,
): Promise<Resource[]> {
  const result = await listResources(
    tenantId,
    { is_active: true },
    { limit: 1000 },
  );
  return result.data;
}

export async function getBookableResources(
  tenantId: string,
): Promise<Resource[]> {
  const result = await listResources(
    tenantId,
    { is_active: true, accepts_bookings: true },
    { limit: 1000 },
  );
  return result.data;
}

export async function getResourcesByType(
  tenantId: string,
  type: string,
): Promise<Resource[]> {
  const result = await listResources(
    tenantId,
    { type, is_active: true },
    { limit: 1000 },
  );
  return result.data;
}

// ============================================================================
// AVAILABILITY INTEGRATION
// ============================================================================

export async function getResourceAvailability(
  tenantId: string,
  resourceId: string,
  startDate: string,
  endDate: string,
): Promise<{ date: string; available_slots: number; total_slots: number }[]> {
  const db = getSupabase();

  const { data, error } = await db
    .from("availability_slots")
    .select("slot_date, total_capacity, booked_count, status")
    .eq("tenant_id", tenantId)
    .eq("resource_id", resourceId)
    .gte("slot_date", startDate)
    .lte("slot_date", endDate)
    .eq("status", "available");

  if (error)
    throw new Error(`Failed to get resource availability: ${error.message}`);

  // Group by date
  const byDate: Record<string, { available: number; total: number }> = {};
  for (const slot of data || []) {
    if (!byDate[slot.slot_date]) {
      byDate[slot.slot_date] = { available: 0, total: 0 };
    }
    byDate[slot.slot_date].total += slot.total_capacity;
    byDate[slot.slot_date].available += Math.max(
      0,
      slot.total_capacity - slot.booked_count,
    );
  }

  return Object.entries(byDate)
    .map(([date, { available, total }]) => ({
      date,
      available_slots: available,
      total_slots: total,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================================
// SORTING
// ============================================================================

export async function reorderResources(
  tenantId: string,
  resourceIds: string[],
): Promise<void> {
  const db = getSupabase();

  // Update sort_order for each resource
  const updates = resourceIds.map((id, index) => ({
    id,
    tenant_id: tenantId,
    sort_order: index,
  }));

  for (const update of updates) {
    const { error } = await db
      .from("resources")
      .update({ sort_order: update.sort_order })
      .eq("tenant_id", tenantId)
      .eq("id", update.id);

    if (error) throw new Error(`Failed to reorder resources: ${error.message}`);
  }
}
