// Engagement Score Calculation Job
import { getSupabase } from "../services/database/client.js";

/**
 * Update engagement scores for all contacts across all tenants
 *
 * Engagement score (0-100) is based on:
 * - Recency: Last contact within 30 days (+30 points)
 * - Frequency: Number of bookings (+up to 30 points)
 * - Completion: Completion rate (+up to 20 points)
 * - Value: Lifetime value (+up to 20 points)
 */
export async function updateAllEngagementScores(): Promise<void> {
  const db = getSupabase();

  // Get all active tenants
  const { data: tenants, error } = await db
    .from("tenants")
    .select("id")
    .eq("is_active", true);

  if (error || !tenants) {
    console.error("[ENGAGEMENT] Failed to get tenants:", error);
    return;
  }

  for (const tenant of tenants) {
    try {
      await updateTenantEngagementScores(tenant.id);
    } catch (err) {
      console.error(`[ENGAGEMENT] Failed for tenant ${tenant.id}:`, err);
    }
  }
}

async function updateTenantEngagementScores(tenantId: string): Promise<void> {
  const db = getSupabase();

  // Get all contacts for this tenant
  const { data: contacts, error } = await db
    .from("contacts")
    .select(
      "id, last_contact_at, total_bookings, total_completed_bookings, total_no_shows, lifetime_value_cents",
    )
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  if (error || !contacts) return;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  for (const contact of contacts) {
    let score = 0;

    // Recency score (30 points max)
    if (contact.last_contact_at) {
      const lastContact = new Date(contact.last_contact_at);
      if (lastContact > thirtyDaysAgo) {
        const daysAgo =
          (Date.now() - lastContact.getTime()) / (24 * 60 * 60 * 1000);
        score += Math.max(0, 30 - daysAgo); // More recent = higher score
      }
    }

    // Frequency score (30 points max)
    const bookings = contact.total_bookings || 0;
    score += Math.min(30, bookings * 5); // 5 points per booking, max 30

    // Completion rate score (20 points max)
    if (bookings > 0) {
      const completed = contact.total_completed_bookings || 0;
      const noShows = contact.total_no_shows || 0;
      const completionRate = completed / bookings;
      const noShowPenalty = noShows * 5;
      score += Math.max(0, completionRate * 20 - noShowPenalty);
    }

    // Value score (20 points max)
    const value = contact.lifetime_value_cents || 0;
    if (value > 0) {
      // $500+ = full 20 points, scales down linearly
      score += Math.min(20, value / 2500);
    }

    // Round and clamp
    const finalScore = Math.round(Math.min(100, Math.max(0, score)));

    // Update contact
    await db
      .from("contacts")
      .update({ engagement_score: finalScore })
      .eq("id", contact.id);
  }
}

/**
 * Recalculate engagement score for a single contact
 */
export async function recalculateEngagementScore(
  contactId: string,
): Promise<number> {
  const db = getSupabase();

  const { data: contact, error } = await db
    .from("contacts")
    .select(
      "id, tenant_id, last_contact_at, total_bookings, total_completed_bookings, total_no_shows, lifetime_value_cents",
    )
    .eq("id", contactId)
    .single();

  if (error || !contact) return 0;

  let score = 0;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Recency
  if (contact.last_contact_at) {
    const lastContact = new Date(contact.last_contact_at);
    if (lastContact > thirtyDaysAgo) {
      const daysAgo =
        (Date.now() - lastContact.getTime()) / (24 * 60 * 60 * 1000);
      score += Math.max(0, 30 - daysAgo);
    }
  }

  // Frequency
  const bookings = contact.total_bookings || 0;
  score += Math.min(30, bookings * 5);

  // Completion rate
  if (bookings > 0) {
    const completed = contact.total_completed_bookings || 0;
    const noShows = contact.total_no_shows || 0;
    const completionRate = completed / bookings;
    score += Math.max(0, completionRate * 20 - noShows * 5);
  }

  // Value
  const value = contact.lifetime_value_cents || 0;
  if (value > 0) {
    score += Math.min(20, value / 2500);
  }

  const finalScore = Math.round(Math.min(100, Math.max(0, score)));

  await db
    .from("contacts")
    .update({ engagement_score: finalScore })
    .eq("id", contactId);

  return finalScore;
}
