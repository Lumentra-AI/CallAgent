// Contact Service - Core CRM operations
// Handles CRUD, search, lookup, metrics, and bulk operations

import { getSupabase } from "../database/client";
import { contactCache } from "./contact-cache";
import { normalizePhoneNumber } from "./phone-utils";
import {
  Contact,
  ContactNote,
  ContactActivity,
  CreateContactInput,
  UpdateContactInput,
  CreateNoteInput,
  ContactFilters,
  PaginationParams,
  PaginatedResult,
  ActivityType,
  ImportResult,
  ContactImportRecord,
} from "../../types/crm";

// ============================================================================
// CORE CRUD
// ============================================================================

/**
 * Create a new contact
 */
export async function createContact(
  tenantId: string,
  input: CreateContactInput,
): Promise<Contact> {
  const db = getSupabase();
  const phoneNormalized = normalizePhoneNumber(input.phone);

  const { data, error } = await db
    .from("contacts")
    .insert({
      tenant_id: tenantId,
      phone: input.phone,
      phone_normalized: phoneNormalized,
      email: input.email?.toLowerCase().trim(),
      name: input.name,
      first_name: input.first_name,
      last_name: input.last_name,
      company: input.company,
      source: input.source || "manual",
      source_details: input.source_details || {},
      tags: input.tags || [],
      notes: input.notes,
      custom_fields: input.custom_fields || {},
      status: "active",
      lead_status: "new",
    })
    .select()
    .single();

  if (error) {
    // Check for unique constraint violation
    if (error.code === "23505") {
      throw new Error(`Contact with phone ${input.phone} already exists`);
    }
    throw new Error(`Failed to create contact: ${error.message}`);
  }

  // Cache the new contact
  contactCache.set(tenantId, phoneNormalized, data);

  // Log activity
  await addActivity(tenantId, data.id, "imported", {
    description: `Contact created via ${input.source || "manual"}`,
  });

  return data;
}

/**
 * Get a contact by ID
 */
export async function getContact(
  tenantId: string,
  contactId: string,
): Promise<Contact | null> {
  const db = getSupabase();

  const { data, error } = await db
    .from("contacts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", contactId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    throw new Error(`Failed to get contact: ${error.message}`);
  }

  return data;
}

/**
 * Update a contact
 */
export async function updateContact(
  tenantId: string,
  contactId: string,
  input: UpdateContactInput,
): Promise<Contact> {
  const db = getSupabase();

  // Get current contact for activity logging
  const current = await getContact(tenantId, contactId);
  if (!current) {
    throw new Error("Contact not found");
  }

  const updateData: Record<string, unknown> = {};

  // Only include fields that are provided
  if (input.email !== undefined)
    updateData.email = input.email?.toLowerCase().trim();
  if (input.name !== undefined) updateData.name = input.name;
  if (input.first_name !== undefined) updateData.first_name = input.first_name;
  if (input.last_name !== undefined) updateData.last_name = input.last_name;
  if (input.company !== undefined) updateData.company = input.company;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.lead_status !== undefined)
    updateData.lead_status = input.lead_status;
  if (input.preferred_contact_method !== undefined)
    updateData.preferred_contact_method = input.preferred_contact_method;
  if (input.preferred_contact_time !== undefined)
    updateData.preferred_contact_time = input.preferred_contact_time;
  if (input.preferred_language !== undefined)
    updateData.preferred_language = input.preferred_language;
  if (input.timezone !== undefined) updateData.timezone = input.timezone;
  if (input.do_not_call !== undefined)
    updateData.do_not_call = input.do_not_call;
  if (input.do_not_sms !== undefined) updateData.do_not_sms = input.do_not_sms;
  if (input.do_not_email !== undefined)
    updateData.do_not_email = input.do_not_email;
  if (input.marketing_opt_in !== undefined) {
    updateData.marketing_opt_in = input.marketing_opt_in;
    if (input.marketing_opt_in) {
      updateData.marketing_opt_in_at = new Date().toISOString();
    }
  }
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.custom_fields !== undefined)
    updateData.custom_fields = input.custom_fields;

  const { data, error } = await db
    .from("contacts")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .eq("id", contactId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update contact: ${error.message}`);
  }

  // Invalidate cache
  contactCache.invalidate(tenantId, current.phone_normalized);

  // Log status change if applicable
  if (input.status && input.status !== current.status) {
    await addActivity(tenantId, contactId, "status_changed", {
      description: `Status changed from ${current.status} to ${input.status}`,
      metadata: { old_status: current.status, new_status: input.status },
    });
  }

  return data;
}

/**
 * Soft delete a contact (set status to inactive)
 */
export async function deleteContact(
  tenantId: string,
  contactId: string,
): Promise<void> {
  const db = getSupabase();

  const current = await getContact(tenantId, contactId);
  if (!current) {
    throw new Error("Contact not found");
  }

  const { error } = await db
    .from("contacts")
    .update({ status: "inactive" })
    .eq("tenant_id", tenantId)
    .eq("id", contactId);

  if (error) {
    throw new Error(`Failed to delete contact: ${error.message}`);
  }

  // Invalidate cache
  contactCache.invalidate(tenantId, current.phone_normalized);

  // Log activity
  await addActivity(tenantId, contactId, "status_changed", {
    description: "Contact archived",
    metadata: { old_status: current.status, new_status: "inactive" },
  });
}

// ============================================================================
// LOOKUP
// ============================================================================

/**
 * Find or create a contact by phone number
 * Critical for voice agent performance - uses cache
 */
export async function findOrCreateByPhone(
  tenantId: string,
  phone: string,
  data?: Partial<CreateContactInput>,
): Promise<Contact> {
  const phoneNormalized = normalizePhoneNumber(phone);

  // Check cache first
  const cached = contactCache.get(tenantId, phoneNormalized);
  if (cached) {
    return cached;
  }

  // Lookup in database
  const existing = await lookupByPhone(tenantId, phone);
  if (existing) {
    contactCache.set(tenantId, phoneNormalized, existing);
    return existing;
  }

  // Create new contact
  const contact = await createContact(tenantId, {
    phone,
    source: data?.source || "call",
    name: data?.name,
    email: data?.email,
    first_name: data?.first_name,
    last_name: data?.last_name,
    company: data?.company,
    source_details: data?.source_details,
    tags: data?.tags,
    notes: data?.notes,
    custom_fields: data?.custom_fields,
  });

  return contact;
}

/**
 * Lookup contact by phone number
 * Uses cache for voice agent performance (<50ms target)
 */
export async function lookupByPhone(
  tenantId: string,
  phone: string,
): Promise<Contact | null> {
  const phoneNormalized = normalizePhoneNumber(phone);

  // Check cache first
  const cached = contactCache.get(tenantId, phoneNormalized);
  if (cached) {
    return cached;
  }

  const db = getSupabase();

  const { data, error } = await db
    .from("contacts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("phone_normalized", phoneNormalized)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    throw new Error(`Failed to lookup contact: ${error.message}`);
  }

  // Cache the result
  if (data) {
    contactCache.set(tenantId, phoneNormalized, data);
  }

  return data;
}

/**
 * Lookup contact by email
 */
export async function lookupByEmail(
  tenantId: string,
  email: string,
): Promise<Contact | null> {
  const db = getSupabase();

  const { data, error } = await db
    .from("contacts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("email", email.toLowerCase().trim())
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to lookup contact: ${error.message}`);
  }

  return data;
}

// ============================================================================
// SEARCH
// ============================================================================

/**
 * Search contacts with filters and pagination
 */
export async function searchContacts(
  tenantId: string,
  filters: ContactFilters = {},
  pagination: PaginationParams = {},
): Promise<PaginatedResult<Contact>> {
  const db = getSupabase();

  const limit = pagination.limit || 20;
  const offset = pagination.offset || 0;
  const sortBy = pagination.sort_by || "last_contact_at";
  const sortOrder = pagination.sort_order || "desc";

  let query = db
    .from("contacts")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId);

  // Apply filters
  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`,
    );
  }

  if (filters.status) {
    const statuses = Array.isArray(filters.status)
      ? filters.status
      : [filters.status];
    query = query.in("status", statuses);
  }

  if (filters.lead_status) {
    const leadStatuses = Array.isArray(filters.lead_status)
      ? filters.lead_status
      : [filters.lead_status];
    query = query.in("lead_status", leadStatuses);
  }

  if (filters.tags && filters.tags.length > 0) {
    query = query.overlaps("tags", filters.tags);
  }

  if (filters.source) {
    const sources = Array.isArray(filters.source)
      ? filters.source
      : [filters.source];
    query = query.in("source", sources);
  }

  if (filters.has_bookings !== undefined) {
    if (filters.has_bookings) {
      query = query.gt("total_bookings", 0);
    } else {
      query = query.eq("total_bookings", 0);
    }
  }

  if (filters.has_calls !== undefined) {
    if (filters.has_calls) {
      query = query.gt("total_calls", 0);
    } else {
      query = query.eq("total_calls", 0);
    }
  }

  if (filters.created_after) {
    query = query.gte("created_at", filters.created_after);
  }

  if (filters.created_before) {
    query = query.lte("created_at", filters.created_before);
  }

  if (filters.last_contact_after) {
    query = query.gte("last_contact_at", filters.last_contact_after);
  }

  if (filters.last_contact_before) {
    query = query.lte("last_contact_at", filters.last_contact_before);
  }

  // Apply sorting and pagination
  query = query
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to search contacts: ${error.message}`);
  }

  return {
    data: data || [],
    total: count || 0,
    limit,
    offset,
    has_more: (count || 0) > offset + limit,
  };
}

// ============================================================================
// HISTORY & ACTIVITY
// ============================================================================

/**
 * Get contact activity history
 */
export async function getContactHistory(
  tenantId: string,
  contactId: string,
  pagination: PaginationParams = {},
): Promise<PaginatedResult<ContactActivity>> {
  const db = getSupabase();

  const limit = pagination.limit || 50;
  const offset = pagination.offset || 0;

  const { data, error, count } = await db
    .from("contact_activity")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to get contact history: ${error.message}`);
  }

  return {
    data: data || [],
    total: count || 0,
    limit,
    offset,
    has_more: (count || 0) > offset + limit,
  };
}

/**
 * Add activity to contact timeline
 */
export async function addActivity(
  tenantId: string,
  contactId: string,
  activityType: ActivityType,
  details: {
    description?: string;
    metadata?: Record<string, unknown>;
    relatedId?: string;
    relatedType?: string;
    performedBy?: string;
  } = {},
): Promise<ContactActivity> {
  const db = getSupabase();

  const { data, error } = await db
    .from("contact_activity")
    .insert({
      tenant_id: tenantId,
      contact_id: contactId,
      activity_type: activityType,
      description: details.description,
      metadata: details.metadata || {},
      related_id: details.relatedId,
      related_type: details.relatedType,
      performed_by: details.performedBy,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add activity: ${error.message}`);
  }

  return data;
}

// ============================================================================
// METRICS
// ============================================================================

/**
 * Update contact metrics after an event
 */
export async function updateMetrics(
  tenantId: string,
  contactId: string,
  event:
    | "call"
    | "booking"
    | "booking_completed"
    | "booking_cancelled"
    | "no_show"
    | "sms"
    | "email",
  amount?: number,
): Promise<void> {
  const db = getSupabase();
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {
    last_contact_at: now,
  };

  switch (event) {
    case "call":
      // Handled by database trigger, but update last_call_at
      updates.last_call_at = now;
      break;
    case "booking":
      updates.last_booking_at = now;
      break;
    case "booking_completed":
      // Use raw SQL for incrementing
      await db.rpc("increment_contact_metric", {
        p_contact_id: contactId,
        p_field: "total_completed_bookings",
        p_amount: 1,
      });
      if (amount) {
        await db.rpc("increment_contact_metric", {
          p_contact_id: contactId,
          p_field: "lifetime_value_cents",
          p_amount: amount,
        });
      }
      return;
    case "booking_cancelled":
      await db.rpc("increment_contact_metric", {
        p_contact_id: contactId,
        p_field: "total_cancelled_bookings",
        p_amount: 1,
      });
      return;
    case "no_show":
      await db.rpc("increment_contact_metric", {
        p_contact_id: contactId,
        p_field: "total_no_shows",
        p_amount: 1,
      });
      return;
    case "sms":
      await db.rpc("increment_contact_metric", {
        p_contact_id: contactId,
        p_field: "total_sms_sent",
        p_amount: 1,
      });
      return;
    case "email":
      await db.rpc("increment_contact_metric", {
        p_contact_id: contactId,
        p_field: "total_emails_sent",
        p_amount: 1,
      });
      return;
  }

  const { error } = await db
    .from("contacts")
    .update(updates)
    .eq("tenant_id", tenantId)
    .eq("id", contactId);

  if (error) {
    console.error(`Failed to update contact metrics: ${error.message}`);
  }
}

/**
 * Recalculate engagement score
 */
export async function recalculateEngagementScore(
  tenantId: string,
  contactId: string,
): Promise<number> {
  const contact = await getContact(tenantId, contactId);
  if (!contact) {
    throw new Error("Contact not found");
  }

  // Engagement score factors (0-100)
  let score = 0;

  // Recent activity (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (
    contact.last_contact_at &&
    new Date(contact.last_contact_at) > thirtyDaysAgo
  ) {
    score += 20; // Recent contact
  }

  // Call frequency
  if (contact.total_calls >= 5) score += 15;
  else if (contact.total_calls >= 3) score += 10;
  else if (contact.total_calls >= 1) score += 5;

  // Booking history
  if (contact.total_bookings >= 5) score += 15;
  else if (contact.total_bookings >= 3) score += 10;
  else if (contact.total_bookings >= 1) score += 5;

  // Completion rate
  if (contact.total_bookings > 0) {
    const completionRate =
      contact.total_completed_bookings / contact.total_bookings;
    score += Math.round(completionRate * 20);
  }

  // Lifetime value
  if (contact.lifetime_value_cents >= 50000)
    score += 15; // $500+
  else if (contact.lifetime_value_cents >= 10000)
    score += 10; // $100+
  else if (contact.lifetime_value_cents >= 1000) score += 5; // $10+

  // VIP status bonus
  if (contact.status === "vip") score += 10;

  // Negative factors
  if (contact.total_no_shows > 0) {
    score -= Math.min(contact.total_no_shows * 5, 15);
  }
  if (contact.total_cancelled_bookings > contact.total_completed_bookings) {
    score -= 10;
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Update in database
  const db = getSupabase();
  await db
    .from("contacts")
    .update({ engagement_score: score })
    .eq("id", contactId);

  return score;
}

// ============================================================================
// NOTES
// ============================================================================

/**
 * Get notes for a contact
 */
export async function getContactNotes(
  tenantId: string,
  contactId: string,
  pagination: PaginationParams = {},
): Promise<PaginatedResult<ContactNote>> {
  const db = getSupabase();

  const limit = pagination.limit || 20;
  const offset = pagination.offset || 0;

  const { data, error, count } = await db
    .from("contact_notes")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to get contact notes: ${error.message}`);
  }

  return {
    data: data || [],
    total: count || 0,
    limit,
    offset,
    has_more: (count || 0) > offset + limit,
  };
}

/**
 * Add note to contact
 */
export async function addNote(
  tenantId: string,
  input: CreateNoteInput,
  createdBy?: string,
  createdByName?: string,
): Promise<ContactNote> {
  const db = getSupabase();

  const { data, error } = await db
    .from("contact_notes")
    .insert({
      tenant_id: tenantId,
      contact_id: input.contact_id,
      note_type: input.note_type || "general",
      content: input.content,
      call_id: input.call_id,
      booking_id: input.booking_id,
      is_pinned: input.is_pinned || false,
      is_private: input.is_private || false,
      created_by: createdBy,
      created_by_name: createdByName,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add note: ${error.message}`);
  }

  // Log activity
  await addActivity(tenantId, input.contact_id, "note_added", {
    description: `Note added: ${input.note_type || "general"}`,
    relatedId: data.id,
    relatedType: "note",
    performedBy: createdBy,
  });

  return data;
}

// ============================================================================
// TAGS
// ============================================================================

/**
 * Add tag to contact
 */
export async function addTag(
  tenantId: string,
  contactId: string,
  tag: string,
): Promise<void> {
  const db = getSupabase();

  // Get current tags
  const contact = await getContact(tenantId, contactId);
  if (!contact) {
    throw new Error("Contact not found");
  }

  // Check if tag already exists
  if (contact.tags.includes(tag)) {
    return;
  }

  const newTags = [...contact.tags, tag];

  const { error } = await db
    .from("contacts")
    .update({ tags: newTags })
    .eq("id", contactId);

  if (error) {
    throw new Error(`Failed to add tag: ${error.message}`);
  }

  // Invalidate cache
  contactCache.invalidate(tenantId, contact.phone_normalized);

  // Log activity
  await addActivity(tenantId, contactId, "tag_added", {
    description: `Tag added: ${tag}`,
    metadata: { tag },
  });
}

/**
 * Remove tag from contact
 */
export async function removeTag(
  tenantId: string,
  contactId: string,
  tag: string,
): Promise<void> {
  const db = getSupabase();

  const contact = await getContact(tenantId, contactId);
  if (!contact) {
    throw new Error("Contact not found");
  }

  const newTags = contact.tags.filter((t) => t !== tag);

  const { error } = await db
    .from("contacts")
    .update({ tags: newTags })
    .eq("id", contactId);

  if (error) {
    throw new Error(`Failed to remove tag: ${error.message}`);
  }

  // Invalidate cache
  contactCache.invalidate(tenantId, contact.phone_normalized);

  // Log activity
  await addActivity(tenantId, contactId, "tag_removed", {
    description: `Tag removed: ${tag}`,
    metadata: { tag },
  });
}

/**
 * Bulk add tag to multiple contacts
 */
export async function bulkAddTag(
  tenantId: string,
  contactIds: string[],
  tag: string,
): Promise<number> {
  const db = getSupabase();

  // Use raw SQL for efficient bulk update
  const { data, error } = await db.rpc("bulk_add_tag", {
    p_tenant_id: tenantId,
    p_contact_ids: contactIds,
    p_tag: tag,
  });

  if (error) {
    throw new Error(`Failed to bulk add tag: ${error.message}`);
  }

  return data || 0;
}

// ============================================================================
// IMPORT
// ============================================================================

/**
 * Import contacts from records
 */
export async function importContacts(
  tenantId: string,
  records: ContactImportRecord[],
  options: {
    skipDuplicates?: boolean;
    updateExisting?: boolean;
    source?: string;
  } = {},
): Promise<ImportResult> {
  const result: ImportResult = {
    total: records.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    try {
      // Validate phone
      if (!record.phone) {
        result.errors.push({
          row: i + 1,
          field: "phone",
          message: "Phone number is required",
          data: record as unknown as Record<string, unknown>,
        });
        continue;
      }

      // Validate and normalize phone
      normalizePhoneNumber(record.phone);

      // Check for existing
      const existing = await lookupByPhone(tenantId, record.phone);

      if (existing) {
        if (options.skipDuplicates) {
          result.skipped++;
          continue;
        }

        if (options.updateExisting) {
          // Update existing contact
          await updateContact(tenantId, existing.id, {
            email: record.email,
            name: record.name,
            first_name: record.first_name,
            last_name: record.last_name,
            company: record.company,
            notes: record.notes,
            tags: Array.isArray(record.tags)
              ? record.tags
              : record.tags?.split(",").map((t) => t.trim()),
            custom_fields: record.custom_fields,
          });
          result.updated++;
          continue;
        }

        result.skipped++;
        continue;
      }

      // Create new contact
      await createContact(tenantId, {
        phone: record.phone,
        email: record.email,
        name: record.name,
        first_name: record.first_name,
        last_name: record.last_name,
        company: record.company,
        source: (options.source as "import") || "import",
        tags: Array.isArray(record.tags)
          ? record.tags
          : record.tags?.split(",").map((t) => t.trim()),
        notes: record.notes,
        custom_fields: record.custom_fields,
      });
      result.created++;
    } catch (err) {
      result.errors.push({
        row: i + 1,
        message: err instanceof Error ? err.message : "Unknown error",
        data: record as unknown as Record<string, unknown>,
      });
    }
  }

  return result;
}

// ============================================================================
// MERGE
// ============================================================================

/**
 * Merge duplicate contacts
 */
export async function mergeContacts(
  tenantId: string,
  primaryId: string,
  secondaryIds: string[],
): Promise<Contact> {
  const db = getSupabase();

  // Get all contacts
  const primary = await getContact(tenantId, primaryId);
  if (!primary) {
    throw new Error("Primary contact not found");
  }

  // Update references in other tables
  for (const secondaryId of secondaryIds) {
    const secondary = await getContact(tenantId, secondaryId);
    if (!secondary) continue;

    // Move calls to primary
    await db
      .from("calls")
      .update({ contact_id: primaryId })
      .eq("contact_id", secondaryId);

    // Move bookings to primary
    await db
      .from("bookings")
      .update({ contact_id: primaryId })
      .eq("contact_id", secondaryId);

    // Move notes to primary
    await db
      .from("contact_notes")
      .update({ contact_id: primaryId })
      .eq("contact_id", secondaryId);

    // Move activity to primary
    await db
      .from("contact_activity")
      .update({ contact_id: primaryId })
      .eq("contact_id", secondaryId);

    // Merge metrics
    const updates: Record<string, unknown> = {
      total_calls: primary.total_calls + secondary.total_calls,
      total_bookings: primary.total_bookings + secondary.total_bookings,
      total_completed_bookings:
        primary.total_completed_bookings + secondary.total_completed_bookings,
      total_cancelled_bookings:
        primary.total_cancelled_bookings + secondary.total_cancelled_bookings,
      total_no_shows: primary.total_no_shows + secondary.total_no_shows,
      total_sms_sent: primary.total_sms_sent + secondary.total_sms_sent,
      total_emails_sent:
        primary.total_emails_sent + secondary.total_emails_sent,
      lifetime_value_cents:
        primary.lifetime_value_cents + secondary.lifetime_value_cents,
    };

    // Merge tags
    const mergedTags = [...new Set([...primary.tags, ...secondary.tags])];
    updates.tags = mergedTags;

    // Use earliest first_contact_at
    if (
      secondary.first_contact_at &&
      (!primary.first_contact_at ||
        secondary.first_contact_at < primary.first_contact_at)
    ) {
      updates.first_contact_at = secondary.first_contact_at;
    }

    // Use latest last_contact_at
    if (
      secondary.last_contact_at &&
      (!primary.last_contact_at ||
        secondary.last_contact_at > primary.last_contact_at)
    ) {
      updates.last_contact_at = secondary.last_contact_at;
    }

    await db.from("contacts").update(updates).eq("id", primaryId);

    // Soft delete secondary
    await db
      .from("contacts")
      .update({ status: "inactive" })
      .eq("id", secondaryId);

    // Log merge activity
    await addActivity(tenantId, primaryId, "merged", {
      description: `Merged with contact ${secondary.phone}`,
      metadata: { merged_contact_id: secondaryId },
    });

    // Invalidate cache
    contactCache.invalidate(tenantId, secondary.phone_normalized);
  }

  // Invalidate primary cache
  contactCache.invalidate(tenantId, primary.phone_normalized);

  // Return updated primary
  return (await getContact(tenantId, primaryId))!;
}
