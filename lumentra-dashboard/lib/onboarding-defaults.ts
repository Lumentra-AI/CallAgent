import type { IndustryType } from "@/types";

// ============================================================================
// PERSONALITY TEMPLATES
// ============================================================================

export interface PersonalityTemplate {
  id: string;
  label: string;
  tagline: string;
  description: string;
  personality: "professional" | "friendly" | "efficient";
  greeting: string;
  bestFor: string;
  color: string;
}

export const PERSONALITY_TEMPLATES: PersonalityTemplate[] = [
  {
    id: "friendly_receptionist",
    label: "The Friendly Receptionist",
    tagline: "Warm, helpful, and conversational",
    description:
      "Makes callers feel welcome and comfortable. Great for businesses where personal connection matters.",
    personality: "friendly",
    greeting:
      "Hi there! Thanks for calling {business}. I'm {name} - what can I help you with?",
    bestFor: "dental offices, salons, restaurants",
    color: "bg-amber-800",
  },
  {
    id: "professional_assistant",
    label: "The Professional Assistant",
    tagline: "Polished, efficient, and clear",
    description:
      "Projects confidence and competence. Perfect for businesses that value a formal first impression.",
    personality: "professional",
    greeting:
      "Thank you for calling {business}. This is {name}, how may I assist you today?",
    bestFor: "medical clinics, law offices, corporate",
    color: "bg-slate-800",
  },
  {
    id: "casual_helper",
    label: "The Casual Helper",
    tagline: "Relaxed, natural, and approachable",
    description:
      "Keeps it simple and direct. Ideal for businesses with a laid-back, no-fuss vibe.",
    personality: "efficient",
    greeting: "Hey! You've reached {business}. What can we do for you?",
    bestFor: "auto shops, small businesses, local services",
    color: "bg-emerald-800",
  },
];

// ============================================================================
// VOICE OPTIONS (Cartesia UUIDs)
// ============================================================================

export interface VoiceOption {
  id: string;
  cartesiaId: string;
  name: string;
  type: "female" | "male";
  description: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "sarah",
    cartesiaId: "694f9389-aac1-45b6-b726-9d9369183238",
    name: "Sarah",
    type: "female",
    description: "Natural and conversational",
  },
  {
    id: "support_lady",
    cartesiaId: "829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30",
    name: "Emily",
    type: "female",
    description: "Warm and supportive",
  },
  {
    id: "professional_woman",
    cartesiaId: "248be419-c632-4f23-adf1-5324ed7dbf1d",
    name: "Madison",
    type: "female",
    description: "Polished and confident",
  },
  {
    id: "support_man",
    cartesiaId: "a167e0f3-df7e-4d52-a9c3-f949145efdab",
    name: "James",
    type: "male",
    description: "Calm and professional",
  },
  {
    id: "barbershop_man",
    cartesiaId: "a0e99841-438c-4a64-b679-ae501e7d6091",
    name: "Alex",
    type: "male",
    description: "Friendly and upbeat",
  },
  {
    id: "calm_lady",
    cartesiaId: "00a77add-48d5-4ef6-8157-71e5437b282d",
    name: "Maya",
    type: "female",
    description: "Soothing and gentle",
  },
];

// ============================================================================
// CAPABILITY LABELS (human-friendly)
// ============================================================================

export const CAPABILITY_LABELS: Record<
  string,
  { label: string; description: string }
> = {
  appointments: {
    label: "Book appointments",
    description: "Schedule, reschedule, and cancel appointments for callers",
  },
  reservations: {
    label: "Take reservations",
    description: "Book tables, rooms, or services for callers",
  },
  patient_intake: {
    label: "Collect patient information",
    description: "Gather patient details before their visit",
  },
  call_handling: {
    label: "Answer and route calls",
    description: "Pick up calls and connect callers to the right person",
  },
  message_taking: {
    label: "Take messages when you're unavailable",
    description: "Record messages so you can return calls later",
  },
  faq: {
    label: "Answer common questions",
    description: "Share your hours, location, pricing, and other info",
  },
  emergency_dispatch: {
    label: "Handle urgent situations",
    description: "Identify emergencies and route them to the right person",
  },
  promotions: {
    label: "Mention special offers",
    description: "Let callers know about current deals and promotions",
  },
  after_hours: {
    label: "Handle after-hours calls",
    description: "Take care of callers even when you're closed",
  },
};

// ============================================================================
// INDUSTRY DEFAULTS
// ============================================================================

export interface IndustryDefaults {
  agentName: string;
  templateId: string;
  voiceId: string;
  capabilities: string[];
  escalationTriggers: string[];
}

const INDUSTRY_DEFAULTS: Partial<Record<IndustryType, IndustryDefaults>> = {
  dental: {
    agentName: "Sarah",
    templateId: "friendly_receptionist",
    voiceId: "sarah",
    capabilities: [
      "appointments",
      "patient_intake",
      "faq",
      "emergency_dispatch",
    ],
    escalationTriggers: [
      "caller_asks_for_person",
      "caller_emergency",
      "caller_complaint",
      "caller_unknown_question",
    ],
  },
  medical: {
    agentName: "Sarah",
    templateId: "professional_assistant",
    voiceId: "professional_woman",
    capabilities: [
      "appointments",
      "patient_intake",
      "faq",
      "emergency_dispatch",
    ],
    escalationTriggers: [
      "caller_asks_for_person",
      "caller_emergency",
      "caller_complaint",
      "caller_unknown_question",
    ],
  },
  restaurant: {
    agentName: "Emma",
    templateId: "friendly_receptionist",
    voiceId: "support_lady",
    capabilities: ["reservations", "faq", "promotions", "after_hours"],
    escalationTriggers: [
      "caller_asks_for_person",
      "caller_frustrated",
      "caller_complaint",
    ],
  },
  hotel: {
    agentName: "Madison",
    templateId: "professional_assistant",
    voiceId: "professional_woman",
    capabilities: ["reservations", "faq", "after_hours"],
    escalationTriggers: [
      "caller_asks_for_person",
      "caller_emergency",
      "caller_complaint",
      "caller_unknown_question",
    ],
  },
  motel: {
    agentName: "Sarah",
    templateId: "friendly_receptionist",
    voiceId: "sarah",
    capabilities: ["reservations", "faq", "after_hours"],
    escalationTriggers: [
      "caller_asks_for_person",
      "caller_complaint",
      "caller_unknown_question",
    ],
  },
  salon: {
    agentName: "Emma",
    templateId: "friendly_receptionist",
    voiceId: "support_lady",
    capabilities: ["appointments", "faq", "promotions"],
    escalationTriggers: [
      "caller_asks_for_person",
      "caller_frustrated",
      "caller_complaint",
    ],
  },
  auto_service: {
    agentName: "Alex",
    templateId: "casual_helper",
    voiceId: "barbershop_man",
    capabilities: ["appointments", "faq", "promotions"],
    escalationTriggers: [
      "caller_asks_for_person",
      "caller_frustrated",
      "caller_unknown_question",
    ],
  },
};

const DEFAULT_INDUSTRY_DEFAULTS: IndustryDefaults = {
  agentName: "Sarah",
  templateId: "friendly_receptionist",
  voiceId: "sarah",
  capabilities: ["call_handling", "message_taking", "faq"],
  escalationTriggers: [
    "caller_asks_for_person",
    "caller_frustrated",
    "caller_emergency",
    "caller_complaint",
    "caller_unknown_question",
    "payment_billing",
  ],
};

export function getIndustryDefaults(
  industry: IndustryType | null,
): IndustryDefaults {
  if (!industry) return DEFAULT_INDUSTRY_DEFAULTS;
  return INDUSTRY_DEFAULTS[industry] || DEFAULT_INDUSTRY_DEFAULTS;
}

export function getRecommendedTemplate(industry: IndustryType | null): string {
  return getIndustryDefaults(industry).templateId;
}

export function getVoiceByCartesiaId(
  cartesiaId: string,
): VoiceOption | undefined {
  return VOICE_OPTIONS.find((v) => v.cartesiaId === cartesiaId);
}

export function getVoiceById(id: string): VoiceOption | undefined {
  return VOICE_OPTIONS.find((v) => v.id === id);
}

// ============================================================================
// INDUSTRY HOURS DEFAULTS
// ============================================================================

export interface IndustryHoursDefaults {
  schedule: Record<string, { status: string; open: string; close: string }>;
  sameEveryDay: boolean;
}

const INDUSTRY_HOURS: Partial<Record<IndustryType, IndustryHoursDefaults>> = {
  hotel: {
    sameEveryDay: false,
    schedule: {
      monday: { status: "24hours", open: "", close: "" },
      tuesday: { status: "24hours", open: "", close: "" },
      wednesday: { status: "24hours", open: "", close: "" },
      thursday: { status: "24hours", open: "", close: "" },
      friday: { status: "24hours", open: "", close: "" },
      saturday: { status: "24hours", open: "", close: "" },
      sunday: { status: "24hours", open: "", close: "" },
    },
  },
  motel: {
    sameEveryDay: false,
    schedule: {
      monday: { status: "24hours", open: "", close: "" },
      tuesday: { status: "24hours", open: "", close: "" },
      wednesday: { status: "24hours", open: "", close: "" },
      thursday: { status: "24hours", open: "", close: "" },
      friday: { status: "24hours", open: "", close: "" },
      saturday: { status: "24hours", open: "", close: "" },
      sunday: { status: "24hours", open: "", close: "" },
    },
  },
  restaurant: {
    sameEveryDay: false,
    schedule: {
      monday: { status: "open", open: "11:00", close: "22:00" },
      tuesday: { status: "open", open: "11:00", close: "22:00" },
      wednesday: { status: "open", open: "11:00", close: "22:00" },
      thursday: { status: "open", open: "11:00", close: "22:00" },
      friday: { status: "open", open: "11:00", close: "23:00" },
      saturday: { status: "open", open: "11:00", close: "23:00" },
      sunday: { status: "open", open: "11:00", close: "22:00" },
    },
  },
  dental: {
    sameEveryDay: true,
    schedule: {
      monday: { status: "open", open: "08:00", close: "17:00" },
      tuesday: { status: "open", open: "08:00", close: "17:00" },
      wednesday: { status: "open", open: "08:00", close: "17:00" },
      thursday: { status: "open", open: "08:00", close: "17:00" },
      friday: { status: "open", open: "08:00", close: "17:00" },
      saturday: { status: "closed", open: "", close: "" },
      sunday: { status: "closed", open: "", close: "" },
    },
  },
  medical: {
    sameEveryDay: true,
    schedule: {
      monday: { status: "open", open: "08:00", close: "17:00" },
      tuesday: { status: "open", open: "08:00", close: "17:00" },
      wednesday: { status: "open", open: "08:00", close: "17:00" },
      thursday: { status: "open", open: "08:00", close: "17:00" },
      friday: { status: "open", open: "08:00", close: "17:00" },
      saturday: { status: "closed", open: "", close: "" },
      sunday: { status: "closed", open: "", close: "" },
    },
  },
  salon: {
    sameEveryDay: false,
    schedule: {
      monday: { status: "closed", open: "", close: "" },
      tuesday: { status: "open", open: "10:00", close: "19:00" },
      wednesday: { status: "open", open: "10:00", close: "19:00" },
      thursday: { status: "open", open: "10:00", close: "19:00" },
      friday: { status: "open", open: "10:00", close: "19:00" },
      saturday: { status: "open", open: "10:00", close: "19:00" },
      sunday: { status: "closed", open: "", close: "" },
    },
  },
  auto_service: {
    sameEveryDay: false,
    schedule: {
      monday: { status: "open", open: "08:00", close: "18:00" },
      tuesday: { status: "open", open: "08:00", close: "18:00" },
      wednesday: { status: "open", open: "08:00", close: "18:00" },
      thursday: { status: "open", open: "08:00", close: "18:00" },
      friday: { status: "open", open: "08:00", close: "18:00" },
      saturday: { status: "open", open: "09:00", close: "14:00" },
      sunday: { status: "closed", open: "", close: "" },
    },
  },
};

export function getIndustryHoursDefaults(
  industry: IndustryType | null,
): IndustryHoursDefaults | null {
  if (!industry) return null;
  return INDUSTRY_HOURS[industry] || null;
}
