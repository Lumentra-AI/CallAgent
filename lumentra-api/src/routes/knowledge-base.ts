import { Hono } from "hono";
import { getAuthTenantId } from "../middleware/auth.js";
import { queryAll, queryOne } from "../services/database/client.js";
import { insertOne, updateOne } from "../services/database/query-helpers.js";
import { z } from "zod";
import { getTenantById } from "../services/database/tenant-cache.js";

export const knowledgeBaseRoutes = new Hono();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createSchema = z.object({
  question: z.string().min(1, "Question is required").max(1000),
  answer: z.string().min(1, "Answer is required").max(5000),
  category: z.string().max(100).optional(),
  sort_order: z.number().int().nonnegative().default(0),
});

const updateSchema = z.object({
  question: z.string().min(1).max(1000).optional(),
  answer: z.string().min(1).max(5000).optional(),
  category: z.string().max(100).nullish(),
  sort_order: z.number().int().nonnegative().optional(),
  is_active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Industry seed data
// ---------------------------------------------------------------------------

const INDUSTRY_SEEDS: Record<
  string,
  { question: string; answer: string; category: string }[]
> = {
  restaurant: [
    {
      question: "What are your hours of operation?",
      answer: "Update this with your restaurant's hours of operation.",
      category: "Hours",
    },
    {
      question: "Where are you located?",
      answer:
        "Update this with your restaurant's address and any landmark directions.",
      category: "Location",
    },
    {
      question: "Do you offer delivery?",
      answer:
        "Update this with your delivery options, radius, and any third-party delivery partners.",
      category: "Delivery",
    },
    {
      question: "Do you take reservations?",
      answer:
        "Update this with your reservation policy, how to book, and party size limits.",
      category: "Reservations",
    },
    {
      question: "Can I see your menu?",
      answer:
        "Update this with a summary of your menu categories or a link to your online menu.",
      category: "Menu",
    },
    {
      question: "Do you accommodate food allergies?",
      answer:
        "Update this with your allergen policy and how guests should communicate dietary needs.",
      category: "Allergens",
    },
    {
      question: "Is there parking available?",
      answer:
        "Update this with your parking options, including lot, street, or valet information.",
      category: "Parking",
    },
    {
      question: "Do you host private events?",
      answer:
        "Update this with your private event options, capacity, and booking process.",
      category: "Events",
    },
    {
      question: "Do you have a kids menu?",
      answer:
        "Update this with information about your kids menu or family-friendly options.",
      category: "Menu",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "Update this with your accepted payment methods (cash, cards, mobile pay, etc.).",
      category: "General",
    },
  ],
  salon: [
    {
      question: "What are your hours of operation?",
      answer: "Update this with your salon's hours for each day of the week.",
      category: "Hours",
    },
    {
      question: "How do I book an appointment?",
      answer:
        "Update this with your booking process (phone, online, walk-in availability).",
      category: "Booking",
    },
    {
      question: "What is your cancellation policy?",
      answer:
        "Update this with your cancellation window and any fees for late cancellations or no-shows.",
      category: "Cancellation",
    },
    {
      question: "Do you accept walk-ins?",
      answer: "Update this with your walk-in policy and typical wait times.",
      category: "Walk-ins",
    },
    {
      question: "What services do you offer and what are the prices?",
      answer:
        "Update this with your service menu and price ranges for cuts, color, styling, etc.",
      category: "Services",
    },
    {
      question: "Do you sell hair care products?",
      answer:
        "Update this with the product brands you carry and whether they can be purchased in-store or online.",
      category: "Products",
    },
    {
      question: "Do you offer gift cards?",
      answer:
        "Update this with your gift card options, denominations, and how to purchase them.",
      category: "Gift Cards",
    },
    {
      question: "How should I prepare for my appointment?",
      answer:
        "Update this with any pre-appointment instructions (arrive early, hair condition, etc.).",
      category: "Booking",
    },
    {
      question: "Do you offer bridal or group packages?",
      answer:
        "Update this with your group booking options and any special event packages.",
      category: "Services",
    },
    {
      question: "Where are you located and is there parking?",
      answer:
        "Update this with your address, parking information, and accessibility details.",
      category: "Location",
    },
  ],
  medical: [
    {
      question: "What are your office hours?",
      answer:
        "Update this with your practice hours and any extended or weekend availability.",
      category: "Hours",
    },
    {
      question: "What insurance plans do you accept?",
      answer:
        "Update this with the list of insurance providers and plans you accept.",
      category: "Insurance",
    },
    {
      question: "How do I request my medical records?",
      answer:
        "Update this with your medical records request process and turnaround time.",
      category: "Records",
    },
    {
      question: "What should I bring to my first visit?",
      answer:
        "Update this with your new patient requirements (ID, insurance card, medical history, forms).",
      category: "First Visit",
    },
    {
      question: "How do I request a prescription refill?",
      answer:
        "Update this with your prescription refill process and typical turnaround time.",
      category: "Prescriptions",
    },
    {
      question: "What should I do in a medical emergency?",
      answer:
        "Update this with your emergency protocol (call 911, nearest ER, after-hours contact).",
      category: "Emergencies",
    },
    {
      question: "Do you offer telehealth appointments?",
      answer:
        "Update this with your telehealth options, platforms used, and how to schedule.",
      category: "Telehealth",
    },
    {
      question: "How do I schedule an appointment?",
      answer:
        "Update this with your scheduling process (phone, patient portal, online booking).",
      category: "Appointments",
    },
    {
      question: "What is your cancellation and no-show policy?",
      answer:
        "Update this with your cancellation window and any fees for missed appointments.",
      category: "Appointments",
    },
    {
      question: "Do you accept new patients?",
      answer:
        "Update this with your new patient acceptance status and onboarding process.",
      category: "First Visit",
    },
  ],
  hotel: [
    {
      question: "What are your check-in and check-out times?",
      answer:
        "Update this with your standard check-in and check-out times, and early/late options.",
      category: "Check-in/out",
    },
    {
      question: "What amenities does the hotel offer?",
      answer:
        "Update this with your amenities (pool, gym, spa, business center, etc.).",
      category: "Amenities",
    },
    {
      question: "Is parking available?",
      answer:
        "Update this with your parking options, rates, and valet availability.",
      category: "Parking",
    },
    {
      question: "Do you allow pets?",
      answer:
        "Update this with your pet policy, fees, size limits, and any restricted areas.",
      category: "Pets",
    },
    {
      question: "What is your cancellation policy?",
      answer:
        "Update this with your cancellation window, refund policy, and any non-refundable rate details.",
      category: "Cancellation",
    },
    {
      question: "Do you have on-site dining?",
      answer:
        "Update this with your restaurant and room service options, hours, and cuisine.",
      category: "Dining",
    },
    {
      question: "Is Wi-Fi available?",
      answer:
        "Update this with your Wi-Fi availability, whether it is complimentary, and connection instructions.",
      category: "WiFi",
    },
    {
      question: "Do you offer concierge services?",
      answer:
        "Update this with your concierge services (restaurant reservations, tours, transportation, etc.).",
      category: "Concierge",
    },
    {
      question: "Do you have conference or event facilities?",
      answer:
        "Update this with your meeting room and event space options, capacity, and booking process.",
      category: "Events",
    },
    {
      question: "Is airport shuttle service available?",
      answer:
        "Update this with your shuttle or transportation options, schedules, and booking details.",
      category: "Transportation",
    },
  ],
  dental: [
    {
      question: "What are your office hours?",
      answer:
        "Update this with your dental office hours for each day of the week.",
      category: "Hours",
    },
    {
      question: "What insurance plans do you accept?",
      answer:
        "Update this with the dental insurance plans and networks you participate in.",
      category: "Insurance",
    },
    {
      question: "What should I do in a dental emergency?",
      answer:
        "Update this with your emergency dental procedure (call number, after-hours contact, walk-in policy).",
      category: "Emergency",
    },
    {
      question: "What should I expect at my first visit?",
      answer:
        "Update this with your new patient process (forms, X-rays, exam, treatment plan discussion).",
      category: "First Visit",
    },
    {
      question: "What payment options do you offer?",
      answer:
        "Update this with your accepted payment methods and any financing or payment plan options.",
      category: "Payments",
    },
    {
      question: "How often should I get X-rays?",
      answer:
        "Update this with your recommended X-ray schedule and the types of X-rays you offer.",
      category: "X-rays",
    },
    {
      question: "Do you offer teeth whitening?",
      answer:
        "Update this with your whitening options (in-office, take-home kits), pricing, and expected results.",
      category: "Whitening",
    },
    {
      question: "How do I schedule an appointment?",
      answer:
        "Update this with your scheduling process (phone, online portal, walk-in availability).",
      category: "Appointments",
    },
    {
      question: "Do you offer sedation dentistry?",
      answer:
        "Update this with your sedation options for anxious patients or complex procedures.",
      category: "Services",
    },
    {
      question: "Do you see children?",
      answer:
        "Update this with the minimum age you treat and any pediatric dental services you offer.",
      category: "Services",
    },
  ],
  default: [
    {
      question: "What are your hours of operation?",
      answer: "Update this with your business hours for each day of the week.",
      category: "Hours",
    },
    {
      question: "Where are you located?",
      answer: "Update this with your business address and directions.",
      category: "Location",
    },
    {
      question: "How can I contact you?",
      answer:
        "Update this with your phone number, email, and any other contact methods.",
      category: "Contact",
    },
    {
      question: "What services do you offer?",
      answer: "Update this with a summary of your main services or products.",
      category: "Services",
    },
    {
      question: "What are your prices?",
      answer:
        "Update this with your pricing information or how customers can get a quote.",
      category: "Pricing",
    },
    {
      question: "How do I schedule an appointment?",
      answer:
        "Update this with your appointment booking process and availability.",
      category: "Appointments",
    },
    {
      question: "Is there parking available?",
      answer:
        "Update this with your parking options and accessibility information.",
      category: "Parking",
    },
    {
      question: "What payment methods do you accept?",
      answer: "Update this with your accepted payment methods.",
      category: "Payments",
    },
    {
      question: "Do you offer any discounts or promotions?",
      answer:
        "Update this with your current promotions, loyalty programs, or discount policies.",
      category: "Pricing",
    },
    {
      question: "What is your cancellation or refund policy?",
      answer:
        "Update this with your cancellation window, refund process, and any applicable fees.",
      category: "Policies",
    },
  ],
};

// ---------------------------------------------------------------------------
// GET /api/knowledge-base
// List all Q&A pairs for the authenticated tenant
// ---------------------------------------------------------------------------

knowledgeBaseRoutes.get("/", async (c) => {
  try {
    const tenantId = getAuthTenantId(c);
    const items = await queryAll(
      "SELECT * FROM knowledge_base WHERE tenant_id = $1 ORDER BY sort_order ASC, created_at ASC",
      [tenantId],
    );
    return c.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/knowledge-base/search
// Search Q&A pairs (for AI tool usage)
// ---------------------------------------------------------------------------

knowledgeBaseRoutes.get("/search", async (c) => {
  try {
    const tenantId = getAuthTenantId(c);
    const q = c.req.query("q");

    if (!q || q.trim().length === 0) {
      return c.json({ error: "Query parameter 'q' is required" }, 400);
    }

    const pattern = `%${q}%`;
    const results = await queryAll(
      `SELECT question, answer FROM knowledge_base
       WHERE tenant_id = $1 AND is_active = true
         AND (question ILIKE $2 OR answer ILIKE $2)
       ORDER BY sort_order ASC
       LIMIT 5`,
      [tenantId, pattern],
    );

    return c.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/knowledge-base
// Add a Q&A pair
// ---------------------------------------------------------------------------

knowledgeBaseRoutes.post("/", async (c) => {
  try {
    const tenantId = getAuthTenantId(c);
    const body = await c.req.json();

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.issues },
        400,
      );
    }

    const row = await insertOne("knowledge_base", {
      tenant_id: tenantId,
      question: parsed.data.question,
      answer: parsed.data.answer,
      category: parsed.data.category ?? null,
      sort_order: parsed.data.sort_order,
    });

    return c.json(row, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/knowledge-base/seed
// Seed industry-specific default Q&A pairs
// ---------------------------------------------------------------------------

knowledgeBaseRoutes.post("/seed", async (c) => {
  try {
    const tenantId = getAuthTenantId(c);

    // Check if tenant already has knowledge base rows
    const existing = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM knowledge_base WHERE tenant_id = $1",
      [tenantId],
    );

    const existingCount = parseInt(existing?.count || "0", 10);
    if (existingCount > 0) {
      return c.json(
        {
          error:
            "Knowledge base already has entries. Seed is only allowed when empty.",
        },
        409,
      );
    }

    // Get tenant industry
    const tenant = getTenantById(tenantId);
    const industry = tenant?.industry?.toLowerCase() || "default";
    const seeds = INDUSTRY_SEEDS[industry] || INDUSTRY_SEEDS["default"];

    // Insert all seed rows
    let seeded = 0;
    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i];
      await insertOne("knowledge_base", {
        tenant_id: tenantId,
        question: seed.question,
        answer: seed.answer,
        category: seed.category,
        sort_order: i,
      });
      seeded++;
    }

    return c.json({ seeded }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/knowledge-base/:id
// Update a Q&A pair
// ---------------------------------------------------------------------------

knowledgeBaseRoutes.put("/:id", async (c) => {
  try {
    const tenantId = getAuthTenantId(c);
    const id = c.req.param("id");
    const body = await c.req.json();

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.issues },
        400,
      );
    }

    // Verify ownership
    const existing = await queryOne(
      "SELECT id FROM knowledge_base WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );

    if (!existing) {
      return c.json({ error: "Knowledge base entry not found" }, 404);
    }

    // Build dynamic update fields
    const fields: Record<string, unknown> = { updated_at: new Date() };
    if (parsed.data.question !== undefined)
      fields.question = parsed.data.question;
    if (parsed.data.answer !== undefined) fields.answer = parsed.data.answer;
    if (parsed.data.category !== undefined)
      fields.category = parsed.data.category ?? null;
    if (parsed.data.sort_order !== undefined)
      fields.sort_order = parsed.data.sort_order;
    if (parsed.data.is_active !== undefined)
      fields.is_active = parsed.data.is_active;

    const updated = await updateOne("knowledge_base", fields, {
      id,
      tenant_id: tenantId,
    });

    if (!updated) {
      return c.json({ error: "Failed to update entry" }, 500);
    }

    return c.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/knowledge-base/:id
// Delete a Q&A pair
// ---------------------------------------------------------------------------

knowledgeBaseRoutes.delete("/:id", async (c) => {
  try {
    const tenantId = getAuthTenantId(c);
    const id = c.req.param("id");

    // Verify ownership and delete
    const deleted = await queryOne(
      "DELETE FROM knowledge_base WHERE id = $1 AND tenant_id = $2 RETURNING id",
      [id, tenantId],
    );

    if (!deleted) {
      return c.json({ error: "Knowledge base entry not found" }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});
