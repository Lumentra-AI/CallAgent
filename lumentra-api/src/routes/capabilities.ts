import { Hono } from "hono";
import { getSupabase } from "../services/database/client.js";
import { getAuthUserId } from "../middleware/index.js";

export const capabilitiesRoutes = new Hono();

// Capability definitions by industry
const CAPABILITY_OPTIONS: Record<
  string,
  {
    id: string;
    label: string;
    description: string;
    icon: string;
    category: "core" | "communication" | "advanced";
    requiresIntegration?: boolean;
  }[]
> = {
  // Restaurant/Food Service
  restaurant: [
    {
      id: "reservations",
      label: "Take Reservations",
      description: "Book tables for customers",
      icon: "calendar",
      category: "core",
    },
    {
      id: "takeaway",
      label: "Takeaway Orders",
      description: "Handle pickup and delivery orders",
      icon: "package",
      category: "core",
    },
    {
      id: "menu_questions",
      label: "Menu Questions",
      description: "Answer questions about menu items, ingredients, allergies",
      icon: "utensils",
      category: "core",
    },
    {
      id: "hours_location",
      label: "Hours & Location",
      description: "Provide business hours and directions",
      icon: "clock",
      category: "core",
    },
    {
      id: "messages",
      label: "Take Messages",
      description: "Record messages for follow-up",
      icon: "message-square",
      category: "communication",
    },
    {
      id: "faq",
      label: "FAQ Handling",
      description: "Answer common questions automatically",
      icon: "help-circle",
      category: "advanced",
    },
    {
      id: "transfer_human",
      label: "Transfer to Human",
      description: "Connect callers to staff when needed",
      icon: "phone-forwarded",
      category: "communication",
    },
  ],
  pizza: [
    {
      id: "takeaway",
      label: "Take Orders",
      description: "Handle pickup and delivery orders",
      icon: "package",
      category: "core",
    },
    {
      id: "menu_questions",
      label: "Menu Questions",
      description: "Answer questions about menu items and specials",
      icon: "utensils",
      category: "core",
    },
    {
      id: "hours_location",
      label: "Hours & Location",
      description: "Provide business hours and directions",
      icon: "clock",
      category: "core",
    },
    {
      id: "messages",
      label: "Take Messages",
      description: "Record messages for follow-up",
      icon: "message-square",
      category: "communication",
    },
    {
      id: "transfer_human",
      label: "Transfer to Human",
      description: "Connect callers to staff when needed",
      icon: "phone-forwarded",
      category: "communication",
    },
  ],

  // Healthcare
  medical: [
    {
      id: "appointments",
      label: "Schedule Appointments",
      description: "Book and manage patient appointments",
      icon: "calendar",
      category: "core",
      requiresIntegration: true,
    },
    {
      id: "patient_intake",
      label: "Patient Intake",
      description: "Collect patient information before visits",
      icon: "clipboard",
      category: "core",
    },
    {
      id: "insurance_questions",
      label: "Insurance Questions",
      description: "Answer common insurance and billing questions",
      icon: "shield",
      category: "core",
    },
    {
      id: "prescription_refills",
      label: "Prescription Refills",
      description: "Take refill requests for processing",
      icon: "pill",
      category: "advanced",
    },
    {
      id: "hours_location",
      label: "Hours & Location",
      description: "Provide office hours and directions",
      icon: "clock",
      category: "core",
    },
    {
      id: "messages",
      label: "Take Messages",
      description: "Record messages for medical staff",
      icon: "message-square",
      category: "communication",
    },
    {
      id: "transfer_human",
      label: "Transfer to Staff",
      description: "Connect urgent calls to medical staff",
      icon: "phone-forwarded",
      category: "communication",
    },
  ],
  dental: [
    {
      id: "appointments",
      label: "Schedule Appointments",
      description: "Book dental appointments",
      icon: "calendar",
      category: "core",
      requiresIntegration: true,
    },
    {
      id: "patient_intake",
      label: "New Patient Intake",
      description: "Collect information from new patients",
      icon: "clipboard",
      category: "core",
    },
    {
      id: "insurance_questions",
      label: "Insurance Questions",
      description: "Answer dental insurance questions",
      icon: "shield",
      category: "core",
    },
    {
      id: "hours_location",
      label: "Hours & Location",
      description: "Provide office hours and directions",
      icon: "clock",
      category: "core",
    },
    {
      id: "messages",
      label: "Take Messages",
      description: "Record messages for dental staff",
      icon: "message-square",
      category: "communication",
    },
    {
      id: "faq",
      label: "FAQ Handling",
      description: "Answer common dental questions",
      icon: "help-circle",
      category: "advanced",
    },
    {
      id: "transfer_human",
      label: "Transfer to Staff",
      description: "Connect callers to staff when needed",
      icon: "phone-forwarded",
      category: "communication",
    },
  ],

  // Home Services
  home_services: [
    {
      id: "service_appointments",
      label: "Schedule Service Calls",
      description: "Book service appointments",
      icon: "calendar",
      category: "core",
    },
    {
      id: "emergency_dispatch",
      label: "Emergency Dispatch",
      description: "Handle urgent service requests",
      icon: "alert-triangle",
      category: "core",
    },
    {
      id: "quotes",
      label: "Quote Requests",
      description: "Collect information for estimates",
      icon: "file-text",
      category: "core",
    },
    {
      id: "service_area",
      label: "Service Area Info",
      description: "Answer questions about service areas",
      icon: "map",
      category: "core",
    },
    {
      id: "messages",
      label: "Take Messages",
      description: "Record messages for technicians",
      icon: "message-square",
      category: "communication",
    },
    {
      id: "transfer_human",
      label: "Transfer to Dispatcher",
      description: "Connect urgent calls to dispatch",
      icon: "phone-forwarded",
      category: "communication",
    },
  ],
  hvac: [
    {
      id: "service_appointments",
      label: "Schedule Service",
      description: "Book HVAC service appointments",
      icon: "calendar",
      category: "core",
    },
    {
      id: "emergency_dispatch",
      label: "Emergency Service",
      description: "Handle emergency heating/cooling calls",
      icon: "alert-triangle",
      category: "core",
    },
    {
      id: "quotes",
      label: "Quote Requests",
      description: "Collect information for estimates",
      icon: "file-text",
      category: "core",
    },
    {
      id: "service_area",
      label: "Service Area Info",
      description: "Answer questions about service areas",
      icon: "map",
      category: "core",
    },
    {
      id: "messages",
      label: "Take Messages",
      description: "Record messages for technicians",
      icon: "message-square",
      category: "communication",
    },
    {
      id: "transfer_human",
      label: "Transfer to Dispatcher",
      description: "Connect urgent calls to dispatch",
      icon: "phone-forwarded",
      category: "communication",
    },
  ],
  plumbing: [
    {
      id: "service_appointments",
      label: "Schedule Service",
      description: "Book plumbing service appointments",
      icon: "calendar",
      category: "core",
    },
    {
      id: "emergency_dispatch",
      label: "Emergency Service",
      description: "Handle emergency plumbing calls",
      icon: "alert-triangle",
      category: "core",
    },
    {
      id: "quotes",
      label: "Quote Requests",
      description: "Collect information for estimates",
      icon: "file-text",
      category: "core",
    },
    {
      id: "service_area",
      label: "Service Area Info",
      description: "Answer questions about service areas",
      icon: "map",
      category: "core",
    },
    {
      id: "messages",
      label: "Take Messages",
      description: "Record messages for plumbers",
      icon: "message-square",
      category: "communication",
    },
    {
      id: "transfer_human",
      label: "Transfer to Dispatcher",
      description: "Connect urgent calls to dispatch",
      icon: "phone-forwarded",
      category: "communication",
    },
  ],

  // Professional Services
  legal: [
    {
      id: "consultations",
      label: "Schedule Consultations",
      description: "Book consultation appointments",
      icon: "calendar",
      category: "core",
      requiresIntegration: true,
    },
    {
      id: "case_intake",
      label: "Case Intake",
      description: "Collect initial case information",
      icon: "clipboard",
      category: "core",
    },
    {
      id: "practice_questions",
      label: "Practice Information",
      description: "Answer questions about practice areas",
      icon: "briefcase",
      category: "core",
    },
    {
      id: "messages",
      label: "Take Messages",
      description: "Record messages for attorneys",
      icon: "message-square",
      category: "communication",
    },
    {
      id: "transfer_human",
      label: "Transfer to Staff",
      description: "Connect callers to legal staff",
      icon: "phone-forwarded",
      category: "communication",
    },
  ],

  // Salon/Spa
  salon: [
    {
      id: "appointments",
      label: "Book Appointments",
      description: "Schedule salon services",
      icon: "calendar",
      category: "core",
      requiresIntegration: true,
    },
    {
      id: "services_info",
      label: "Services & Pricing",
      description: "Provide information about services and prices",
      icon: "scissors",
      category: "core",
    },
    {
      id: "hours_location",
      label: "Hours & Location",
      description: "Provide salon hours and directions",
      icon: "clock",
      category: "core",
    },
    {
      id: "messages",
      label: "Take Messages",
      description: "Record messages for stylists",
      icon: "message-square",
      category: "communication",
    },
    {
      id: "transfer_human",
      label: "Transfer to Staff",
      description: "Connect callers to salon staff",
      icon: "phone-forwarded",
      category: "communication",
    },
  ],
  spa: [
    {
      id: "appointments",
      label: "Book Appointments",
      description: "Schedule spa services",
      icon: "calendar",
      category: "core",
      requiresIntegration: true,
    },
    {
      id: "services_info",
      label: "Services & Pricing",
      description: "Provide information about treatments and prices",
      icon: "sparkles",
      category: "core",
    },
    {
      id: "hours_location",
      label: "Hours & Location",
      description: "Provide spa hours and directions",
      icon: "clock",
      category: "core",
    },
    {
      id: "messages",
      label: "Take Messages",
      description: "Record messages for staff",
      icon: "message-square",
      category: "communication",
    },
    {
      id: "transfer_human",
      label: "Transfer to Staff",
      description: "Connect callers to spa staff",
      icon: "phone-forwarded",
      category: "communication",
    },
  ],

  // Hotel/Hospitality
  hotel: [
    {
      id: "reservations",
      label: "Room Reservations",
      description: "Book and manage room reservations",
      icon: "bed",
      category: "core",
      requiresIntegration: true,
    },
    {
      id: "guest_services",
      label: "Guest Services",
      description: "Handle guest requests and inquiries",
      icon: "concierge-bell",
      category: "core",
    },
    {
      id: "amenities_info",
      label: "Amenities Info",
      description: "Provide information about hotel amenities",
      icon: "star",
      category: "core",
    },
    {
      id: "hours_location",
      label: "Hours & Directions",
      description: "Provide check-in times and directions",
      icon: "clock",
      category: "core",
    },
    {
      id: "messages",
      label: "Take Messages",
      description: "Record messages for guests and staff",
      icon: "message-square",
      category: "communication",
    },
    {
      id: "transfer_human",
      label: "Transfer to Front Desk",
      description: "Connect callers to front desk staff",
      icon: "phone-forwarded",
      category: "communication",
    },
  ],
};

// Default capabilities for unlisted industries
const DEFAULT_CAPABILITIES = [
  {
    id: "appointments",
    label: "Schedule Appointments",
    description: "Book appointments and consultations",
    icon: "calendar",
    category: "core" as const,
    requiresIntegration: true,
  },
  {
    id: "hours_location",
    label: "Hours & Location",
    description: "Provide business hours and directions",
    icon: "clock",
    category: "core" as const,
  },
  {
    id: "faq",
    label: "FAQ Handling",
    description: "Answer common questions automatically",
    icon: "help-circle",
    category: "advanced" as const,
  },
  {
    id: "messages",
    label: "Take Messages",
    description: "Record messages for follow-up",
    icon: "message-square",
    category: "communication" as const,
  },
  {
    id: "transfer_human",
    label: "Transfer to Human",
    description: "Connect callers to staff when needed",
    icon: "phone-forwarded",
    category: "communication" as const,
  },
];

/**
 * GET /api/capabilities/options/:industry
 * Returns available capabilities for an industry
 */
capabilitiesRoutes.get("/options/:industry", async (c) => {
  const industry = c.req.param("industry");

  const capabilities = CAPABILITY_OPTIONS[industry] || DEFAULT_CAPABILITIES;

  return c.json({ capabilities });
});

/**
 * GET /api/capabilities
 * Returns tenant's enabled capabilities
 */
capabilitiesRoutes.get("/", async (c) => {
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Get tenant
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return c.json({ capabilities: [] });
  }

  const { data: capabilities, error } = await db
    .from("tenant_capabilities")
    .select("*")
    .eq("tenant_id", membership.tenant_id)
    .order("created_at", { ascending: true });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ capabilities: capabilities || [] });
});

/**
 * PUT /api/capabilities
 * Updates tenant's capabilities
 */
capabilitiesRoutes.put("/", async (c) => {
  const body = await c.req.json();
  const userId = getAuthUserId(c);
  const db = getSupabase();

  if (!body.capabilities || !Array.isArray(body.capabilities)) {
    return c.json({ error: "capabilities array is required" }, 400);
  }

  // Get tenant (must be owner or admin)
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const tenantId = membership.tenant_id;

  // Delete existing capabilities
  await db.from("tenant_capabilities").delete().eq("tenant_id", tenantId);

  // Insert new capabilities
  if (body.capabilities.length > 0) {
    const capabilities = body.capabilities.map(
      (cap: { capability: string; config?: Record<string, unknown> }) => ({
        tenant_id: tenantId,
        capability: cap.capability,
        config: cap.config || {},
        is_enabled: true,
      }),
    );

    const { error } = await db.from("tenant_capabilities").insert(capabilities);

    if (error) {
      return c.json({ error: error.message }, 500);
    }
  }

  // Return updated list
  const { data: updated } = await db
    .from("tenant_capabilities")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  return c.json({ capabilities: updated || [] });
});

/**
 * PUT /api/capabilities/:capability
 * Update a specific capability's config
 */
capabilitiesRoutes.put("/:capability", async (c) => {
  const capability = c.req.param("capability");
  const body = await c.req.json();
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Get tenant (must be owner or admin)
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { data, error } = await db
    .from("tenant_capabilities")
    .update({
      config: body.config || {},
      is_enabled: body.is_enabled !== undefined ? body.is_enabled : true,
    })
    .eq("tenant_id", membership.tenant_id)
    .eq("capability", capability)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Capability not found" }, 404);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json(data);
});
