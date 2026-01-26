// Lumentra Core - Industry Presets
// SOW-Aligned Configuration Templates

import type {
  IndustryPreset,
  IndustryType,
  IndustryCategory,
  AppConfig,
  VoiceConfig,
  FeatureFlags,
  GreetingConfig,
  CustomResponses,
  AgentPersonality,
} from "@/types";

// ============================================================================
// INDUSTRY CATEGORY METADATA
// ============================================================================

export const INDUSTRY_CATEGORIES: Record<
  IndustryCategory,
  { label: string; icon: string; description: string }
> = {
  hospitality: {
    label: "Hospitality",
    icon: "Building2",
    description: "Hotels, restaurants, and lodging services",
  },
  healthcare: {
    label: "Healthcare",
    icon: "Stethoscope",
    description: "Medical, dental, and wellness practices",
  },
  automotive: {
    label: "Automotive",
    icon: "Car",
    description: "Dealerships, service, and rentals",
  },
  professional: {
    label: "Professional Services",
    icon: "Briefcase",
    description: "Legal, accounting, and consulting",
  },
  personal_care: {
    label: "Personal Care",
    icon: "Scissors",
    description: "Salons, spas, and fitness",
  },
  property: {
    label: "Property Services",
    icon: "Home",
    description: "Real estate and home services",
  },
};

// ============================================================================
// INDUSTRY PRESETS (SOW-ALIGNED)
// ============================================================================

export const INDUSTRY_PRESETS: Record<IndustryType, IndustryPreset> = {
  // ==========================================================================
  // HOSPITALITY
  // ==========================================================================
  hotel: {
    id: "hotel",
    category: "hospitality",
    label: "Hotel",
    description: "Full-service hotels and resorts",
    icon: "Building2",
    popular: true,
    terminology: {
      transaction: "Booking",
      transactionPlural: "Bookings",
      customer: "Guest",
      customerPlural: "Guests",
      availability: "Room Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "occupancy",
        label: "Occupancy Rate",
        shortLabel: "OCC",
        unit: "%",
        format: "percentage",
      },
      {
        id: "adr",
        label: "Average Daily Rate",
        shortLabel: "ADR",
        format: "currency",
      },
      {
        id: "revpar",
        label: "Revenue Per Room",
        shortLabel: "RevPAR",
        format: "currency",
      },
      {
        id: "bookings",
        label: "Bookings Today",
        shortLabel: "BOOK",
        format: "number",
      },
    ],
    intents: [
      {
        id: "book_room",
        name: "Book Room",
        description: "Guest wants to reserve a room",
        examples: ["I need a room", "Book for tonight"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "check_rates",
        name: "Check Rates",
        description: "Guest inquiring about pricing",
        examples: ["What are your rates", "How much for a king"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "check_availability",
        name: "Check Availability",
        description: "Guest checking if rooms available",
        examples: ["Do you have rooms", "Available this weekend"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "pet_policy",
        name: "Pet Policy",
        description: "Guest asking about pets",
        examples: ["Do you allow dogs", "Pet friendly"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "group_booking",
        name: "Group Booking",
        description: "Large party inquiry",
        examples: ["10 rooms", "Family reunion", "Wedding block"],
        action: "transfer",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 139,
      currency: "USD",
      taxRate: 0.12,
      fees: [
        {
          id: "pet",
          label: "Pet Fee",
          amount: 25,
          type: "fixed",
          conditional: "hasPet",
        },
        { id: "resort", label: "Resort Fee", amount: 15, type: "fixed" },
        { id: "parking", label: "Parking", amount: 0, type: "fixed" },
      ],
      rateModifiers: [
        {
          id: "weekend",
          label: "Weekend Rate",
          multiplier: 1.15,
          conditions: ["isFriday", "isSaturday"],
        },
        {
          id: "suite",
          label: "Suite Upgrade",
          multiplier: 1.36,
          conditions: ["roomType === suite"],
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. This is {agentName}, how may I assist you today?",
      "Welcome to {businessName}! I'm {agentName}, your virtual concierge. How can I help?",
    ],
    faqTemplates: [
      {
        question: "What time is check-in?",
        answer: "Check-in begins at 3:00 PM and checkout is at 11:00 AM.",
        category: "policies",
      },
      {
        question: "Do you have parking?",
        answer: "Yes, we offer complimentary self-parking for all guests.",
        category: "amenities",
      },
      {
        question: "Is breakfast included?",
        answer:
          "Continental breakfast is included with your stay, served from 6:30-9:30 AM.",
        category: "amenities",
      },
    ],
  },

  motel: {
    id: "motel",
    category: "hospitality",
    label: "Motel",
    description: "Budget-friendly roadside lodging",
    icon: "Building",
    popular: true,
    terminology: {
      transaction: "Booking",
      transactionPlural: "Bookings",
      customer: "Guest",
      customerPlural: "Guests",
      availability: "Room Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "occupancy",
        label: "Occupancy Rate",
        shortLabel: "OCC",
        unit: "%",
        format: "percentage",
      },
      {
        id: "adr",
        label: "Average Daily Rate",
        shortLabel: "ADR",
        format: "currency",
      },
      {
        id: "bookings",
        label: "Bookings Today",
        shortLabel: "BOOK",
        format: "number",
      },
      {
        id: "walkins",
        label: "Walk-ins",
        shortLabel: "WALK",
        format: "number",
      },
    ],
    intents: [
      {
        id: "book_room",
        name: "Book Room",
        description: "Guest wants to reserve",
        examples: ["Need a room tonight", "Book a room"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "check_rates",
        name: "Check Rates",
        description: "Price inquiry",
        examples: ["How much per night", "Your rates"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "check_availability",
        name: "Availability",
        description: "Room availability",
        examples: ["Any rooms available", "Have vacancies"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 69,
      currency: "USD",
      taxRate: 0.1,
      fees: [
        {
          id: "pet",
          label: "Pet Fee",
          amount: 15,
          type: "fixed",
          conditional: "hasPet",
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. How can I help you today?",
    ],
    faqTemplates: [
      {
        question: "What time is check-in?",
        answer: "Check-in is at 2:00 PM, checkout by 11:00 AM.",
        category: "policies",
      },
      {
        question: "Do you allow pets?",
        answer: "Yes, we are pet-friendly with a $15 per night pet fee.",
        category: "policies",
      },
    ],
  },

  vacation_rental: {
    id: "vacation_rental",
    category: "hospitality",
    label: "Vacation Rental",
    description: "Short-term rental properties",
    icon: "Home",
    popular: false,
    terminology: {
      transaction: "Booking",
      transactionPlural: "Bookings",
      customer: "Guest",
      customerPlural: "Guests",
      availability: "Property Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "occupancy",
        label: "Occupancy Rate",
        shortLabel: "OCC",
        unit: "%",
        format: "percentage",
      },
      {
        id: "adr",
        label: "Average Nightly Rate",
        shortLabel: "ANR",
        format: "currency",
      },
      {
        id: "bookings",
        label: "Active Bookings",
        shortLabel: "BOOK",
        format: "number",
      },
      {
        id: "inquiries",
        label: "Inquiries",
        shortLabel: "INQ",
        format: "number",
      },
    ],
    intents: [
      {
        id: "book_property",
        name: "Book Property",
        description: "Guest wants to reserve",
        examples: ["Book this property", "Reserve for next week"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "check_availability",
        name: "Check Availability",
        description: "Date availability",
        examples: ["Available in July", "Open dates"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "amenities",
        name: "Amenities",
        description: "Property features",
        examples: ["Does it have a pool", "Kitchen equipped"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 199,
      currency: "USD",
      taxRate: 0.12,
      fees: [
        { id: "cleaning", label: "Cleaning Fee", amount: 150, type: "fixed" },
        {
          id: "pet",
          label: "Pet Fee",
          amount: 75,
          type: "fixed",
          conditional: "hasPet",
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling about {businessName}. I'm {agentName}, how can I help with your stay?",
    ],
    faqTemplates: [
      {
        question: "What is the minimum stay?",
        answer:
          "Our minimum stay is 2 nights, with a 3-night minimum during peak season.",
        category: "policies",
      },
    ],
  },

  restaurant: {
    id: "restaurant",
    category: "hospitality",
    label: "Restaurant",
    description: "Restaurants and dining establishments",
    icon: "UtensilsCrossed",
    popular: true,
    terminology: {
      transaction: "Reservation",
      transactionPlural: "Reservations",
      customer: "Guest",
      customerPlural: "Guests",
      availability: "Table Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "covers",
        label: "Covers Today",
        shortLabel: "COV",
        format: "number",
      },
      {
        id: "reservations",
        label: "Reservations",
        shortLabel: "RES",
        format: "number",
      },
      {
        id: "walkins",
        label: "Walk-ins",
        shortLabel: "WALK",
        format: "number",
      },
      {
        id: "avgCheck",
        label: "Avg Check",
        shortLabel: "AVG",
        format: "currency",
      },
    ],
    intents: [
      {
        id: "make_reservation",
        name: "Make Reservation",
        description: "Guest wants to book a table",
        examples: ["Table for 4", "Reservation for tonight"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "check_availability",
        name: "Check Availability",
        description: "Table availability",
        examples: ["Open at 7", "Available Saturday"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "menu_info",
        name: "Menu Info",
        description: "Menu questions",
        examples: ["Vegetarian options", "Gluten free"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "hours",
        name: "Hours",
        description: "Operating hours",
        examples: ["What time do you close", "Open on Sunday"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 0,
      currency: "USD",
      taxRate: 0.08,
      fees: [
        {
          id: "large_party",
          label: "Large Party Fee",
          amount: 18,
          type: "percentage",
          conditional: "partySize >= 8",
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. Would you like to make a reservation?",
    ],
    faqTemplates: [
      {
        question: "Do you take reservations?",
        answer: "Yes, we accept reservations for parties of any size.",
        category: "reservations",
      },
      {
        question: "Do you have outdoor seating?",
        answer: "Yes, we have a beautiful patio available weather permitting.",
        category: "amenities",
      },
    ],
  },

  pizza: {
    id: "pizza",
    category: "hospitality",
    label: "Pizza Restaurant",
    description: "Pizza shops and delivery restaurants",
    icon: "Pizza",
    popular: true,
    terminology: {
      transaction: "Order",
      transactionPlural: "Orders",
      customer: "Customer",
      customerPlural: "Customers",
      availability: "Delivery/Pickup Status",
      revenue: "Sales",
    },
    metrics: [
      {
        id: "orders",
        label: "Orders Today",
        shortLabel: "ORD",
        format: "number",
      },
      {
        id: "deliveries",
        label: "Deliveries",
        shortLabel: "DEL",
        format: "number",
      },
      {
        id: "pickups",
        label: "Pickups",
        shortLabel: "PICK",
        format: "number",
      },
      {
        id: "avgOrder",
        label: "Avg Order",
        shortLabel: "AVG",
        format: "currency",
      },
    ],
    intents: [
      {
        id: "place_order",
        name: "Place Order",
        description: "Customer wants to place a food order",
        examples: ["I want to order", "Large pepperoni", "Order for delivery"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "delivery_pickup",
        name: "Delivery/Pickup",
        description: "Customer asking about order fulfillment",
        examples: ["Is this for delivery", "Pickup available", "Delivery time"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "menu_info",
        name: "Menu Info",
        description: "Menu and pricing questions",
        examples: ["What toppings", "Gluten free options", "Specials today"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "hours",
        name: "Hours",
        description: "Operating hours",
        examples: ["What time do you close", "Open on Sunday"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "order_status",
        name: "Order Status",
        description: "Checking on existing order",
        examples: ["Where is my order", "How long", "Is it ready"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 0,
      currency: "USD",
      taxRate: 0.08,
      fees: [
        {
          id: "delivery",
          label: "Delivery Fee",
          amount: 3,
          type: "fixed",
          conditional: "orderType === delivery",
        },
      ],
    },
    greetingTemplates: [
      "Thanks for calling {businessName}! Are you calling to place an order?",
      "Hi, thanks for calling {businessName}. This is {agentName}. What can I get for you today?",
    ],
    faqTemplates: [
      {
        question: "What are your hours?",
        answer:
          "We're open Sunday 12-9 PM, Monday-Thursday 11 AM-10 PM, and Friday-Saturday 11 AM-11 PM.",
        category: "hours",
      },
      {
        question: "Do you deliver?",
        answer:
          "Yes! We deliver within 5 miles. Orders over $30 get free delivery, otherwise there's a $3 delivery fee.",
        category: "delivery",
      },
      {
        question: "Do you have gluten-free options?",
        answer:
          "Yes, we offer gluten-free crust for an additional $3, available in medium size.",
        category: "menu",
      },
      {
        question: "What's the wait time?",
        answer:
          "Pickup orders are ready in about 15-25 minutes. Delivery takes about 30-45 minutes.",
        category: "timing",
      },
    ],
  },

  catering: {
    id: "catering",
    category: "hospitality",
    label: "Catering",
    description: "Catering and event food services",
    icon: "ChefHat",
    popular: false,
    terminology: {
      transaction: "Event",
      transactionPlural: "Events",
      customer: "Client",
      customerPlural: "Clients",
      availability: "Calendar",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "events",
        label: "Events This Month",
        shortLabel: "EVT",
        format: "number",
      },
      {
        id: "quotes",
        label: "Pending Quotes",
        shortLabel: "QTE",
        format: "number",
      },
      {
        id: "avgValue",
        label: "Avg Event Value",
        shortLabel: "AVG",
        format: "currency",
      },
      {
        id: "bookings",
        label: "Confirmed",
        shortLabel: "CONF",
        format: "number",
      },
    ],
    intents: [
      {
        id: "get_quote",
        name: "Get Quote",
        description: "Client wants pricing",
        examples: ["Quote for wedding", "Pricing for 100 people"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "book_event",
        name: "Book Event",
        description: "Client ready to book",
        examples: ["Book for June 15", "Reserve the date"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "menu_options",
        name: "Menu Options",
        description: "Menu inquiries",
        examples: ["Menu options", "Dietary accommodations"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 45,
      currency: "USD",
      taxRate: 0.08,
      fees: [
        {
          id: "service",
          label: "Service Charge",
          amount: 20,
          type: "percentage",
        },
        { id: "delivery", label: "Delivery", amount: 75, type: "fixed" },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName} catering. I'm {agentName}, tell me about your event.",
    ],
    faqTemplates: [
      {
        question: "What is your minimum order?",
        answer: "Our minimum order is 20 guests for full-service catering.",
        category: "policies",
      },
    ],
  },

  // ==========================================================================
  // HEALTHCARE
  // ==========================================================================
  medical: {
    id: "medical",
    category: "healthcare",
    label: "Medical Practice",
    description: "Primary care and specialty clinics",
    icon: "Stethoscope",
    popular: true,
    terminology: {
      transaction: "Appointment",
      transactionPlural: "Appointments",
      customer: "Patient",
      customerPlural: "Patients",
      availability: "Schedule",
      revenue: "Billing",
    },
    metrics: [
      {
        id: "appointments",
        label: "Appointments Today",
        shortLabel: "APPT",
        format: "number",
      },
      {
        id: "scheduled",
        label: "Scheduled",
        shortLabel: "SCHD",
        format: "number",
      },
      {
        id: "callbacks",
        label: "Pending Callbacks",
        shortLabel: "CALL",
        format: "number",
        thresholds: { warning: 5, critical: 10, direction: "above" },
      },
      {
        id: "noshow",
        label: "No-Show Rate",
        shortLabel: "NS%",
        unit: "%",
        format: "percentage",
      },
    ],
    intents: [
      {
        id: "schedule_appointment",
        name: "Schedule Appointment",
        description: "Patient wants to book",
        examples: ["Schedule with Dr. Martinez", "Need an appointment"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "reschedule",
        name: "Reschedule",
        description: "Patient needs to change time",
        examples: ["Reschedule my appointment", "Change my time"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "cancel",
        name: "Cancel Appointment",
        description: "Patient canceling",
        examples: ["Cancel my appointment", "I cant make it"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "prescription",
        name: "Prescription Refill",
        description: "Patient needs refill",
        examples: ["Refill my prescription", "Need more medication"],
        action: "message",
        requiresConfirmation: false,
      },
      {
        id: "urgent",
        name: "Urgent/Emergency",
        description: "Urgent medical need",
        examples: ["Its an emergency", "Urgent"],
        action: "transfer",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 150,
      currency: "USD",
      taxRate: 0,
      fees: [
        {
          id: "new_patient",
          label: "New Patient Fee",
          amount: 50,
          type: "fixed",
          conditional: "isNewPatient",
        },
        {
          id: "late_cancel",
          label: "Late Cancellation",
          amount: 75,
          type: "fixed",
          conditional: "isLateCancellation",
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. This is {agentName}. How may I help you today?",
      "{businessName}, this is {agentName}. Are you calling to schedule an appointment?",
    ],
    faqTemplates: [
      {
        question: "Do you accept my insurance?",
        answer:
          "We accept most major insurance plans. Please provide your insurance information and we can verify coverage.",
        category: "billing",
      },
      {
        question: "What should I bring to my appointment?",
        answer:
          "Please bring your photo ID, insurance card, and a list of current medications.",
        category: "appointments",
      },
    ],
  },

  dental: {
    id: "dental",
    category: "healthcare",
    label: "Dental Office",
    description: "Dental practices and clinics",
    icon: "Smile",
    popular: true,
    terminology: {
      transaction: "Appointment",
      transactionPlural: "Appointments",
      customer: "Patient",
      customerPlural: "Patients",
      availability: "Schedule",
      revenue: "Production",
    },
    metrics: [
      {
        id: "appointments",
        label: "Appointments Today",
        shortLabel: "APPT",
        format: "number",
      },
      {
        id: "production",
        label: "Daily Production",
        shortLabel: "PROD",
        format: "currency",
      },
      {
        id: "newPatients",
        label: "New Patients",
        shortLabel: "NEW",
        format: "number",
      },
      {
        id: "recalls",
        label: "Recalls Due",
        shortLabel: "RCL",
        format: "number",
      },
    ],
    intents: [
      {
        id: "schedule_appointment",
        name: "Schedule Appointment",
        description: "Patient wants to book",
        examples: ["Schedule a cleaning", "Book dental appointment"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "emergency",
        name: "Dental Emergency",
        description: "Urgent dental issue",
        examples: ["Tooth pain", "Broken tooth", "Emergency"],
        action: "transfer",
        requiresConfirmation: false,
      },
      {
        id: "insurance",
        name: "Insurance Question",
        description: "Coverage inquiry",
        examples: ["Do you take Delta Dental", "Insurance accepted"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 175,
      currency: "USD",
      taxRate: 0,
      fees: [
        {
          id: "new_patient",
          label: "New Patient Exam",
          amount: 99,
          type: "fixed",
        },
        {
          id: "late_cancel",
          label: "Missed Appointment",
          amount: 50,
          type: "fixed",
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. This is {agentName}, how can I help you today?",
    ],
    faqTemplates: [
      {
        question: "How often should I get a cleaning?",
        answer: "We recommend professional cleanings every 6 months.",
        category: "care",
      },
    ],
  },

  veterinary: {
    id: "veterinary",
    category: "healthcare",
    label: "Veterinary Clinic",
    description: "Animal hospitals and vet clinics",
    icon: "Heart",
    popular: false,
    terminology: {
      transaction: "Appointment",
      transactionPlural: "Appointments",
      customer: "Pet Parent",
      customerPlural: "Pet Parents",
      availability: "Schedule",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "appointments",
        label: "Appointments Today",
        shortLabel: "APPT",
        format: "number",
      },
      {
        id: "emergencies",
        label: "Emergencies",
        shortLabel: "EMRG",
        format: "number",
      },
      {
        id: "vaccinations",
        label: "Vaccinations",
        shortLabel: "VAX",
        format: "number",
      },
      {
        id: "surgeries",
        label: "Surgeries",
        shortLabel: "SURG",
        format: "number",
      },
    ],
    intents: [
      {
        id: "schedule_appointment",
        name: "Schedule Appointment",
        description: "Book for pet",
        examples: ["Schedule for my dog", "Cat needs checkup"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "emergency",
        name: "Pet Emergency",
        description: "Urgent pet issue",
        examples: ["My dog is sick", "Emergency", "Pet injured"],
        action: "transfer",
        requiresConfirmation: false,
      },
      {
        id: "prescription",
        name: "Medication Refill",
        description: "Pet prescription",
        examples: ["Refill medication", "Need more flea medicine"],
        action: "message",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 65,
      currency: "USD",
      taxRate: 0,
      fees: [
        {
          id: "emergency",
          label: "Emergency Fee",
          amount: 100,
          type: "fixed",
          conditional: "isEmergency",
        },
        {
          id: "afterhours",
          label: "After Hours",
          amount: 75,
          type: "fixed",
          conditional: "isAfterHours",
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. How can we help you and your pet today?",
    ],
    faqTemplates: [
      {
        question: "Do you handle emergencies?",
        answer:
          "Yes, we handle emergencies during business hours. After hours, please call the emergency animal hospital.",
        category: "emergencies",
      },
    ],
  },

  mental_health: {
    id: "mental_health",
    category: "healthcare",
    label: "Mental Health",
    description: "Therapy and counseling practices",
    icon: "Brain",
    popular: false,
    terminology: {
      transaction: "Session",
      transactionPlural: "Sessions",
      customer: "Client",
      customerPlural: "Clients",
      availability: "Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "sessions",
        label: "Sessions Today",
        shortLabel: "SESS",
        format: "number",
      },
      {
        id: "newClients",
        label: "New Clients",
        shortLabel: "NEW",
        format: "number",
      },
      {
        id: "cancellations",
        label: "Cancellations",
        shortLabel: "CXL",
        format: "number",
      },
      {
        id: "utilization",
        label: "Utilization",
        shortLabel: "UTIL",
        unit: "%",
        format: "percentage",
      },
    ],
    intents: [
      {
        id: "schedule_session",
        name: "Schedule Session",
        description: "Client wants to book",
        examples: ["Schedule appointment", "Book a session"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "crisis",
        name: "Crisis",
        description: "Urgent mental health need",
        examples: ["Crisis", "Emergency", "Urgent"],
        action: "transfer",
        requiresConfirmation: false,
      },
      {
        id: "insurance",
        name: "Insurance",
        description: "Coverage questions",
        examples: ["Do you take insurance", "Out of network"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 175,
      currency: "USD",
      taxRate: 0,
      fees: [
        { id: "intake", label: "Initial Intake", amount: 225, type: "fixed" },
        {
          id: "late_cancel",
          label: "Late Cancellation",
          amount: 100,
          type: "fixed",
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. This is {agentName}. How may I assist you?",
    ],
    faqTemplates: [
      {
        question: "Is this confidential?",
        answer:
          "Yes, all calls and appointments are confidential and protected by HIPAA.",
        category: "privacy",
      },
    ],
  },

  chiropractic: {
    id: "chiropractic",
    category: "healthcare",
    label: "Chiropractic",
    description: "Chiropractic and wellness centers",
    icon: "Activity",
    popular: false,
    terminology: {
      transaction: "Visit",
      transactionPlural: "Visits",
      customer: "Patient",
      customerPlural: "Patients",
      availability: "Schedule",
      revenue: "Collections",
    },
    metrics: [
      {
        id: "visits",
        label: "Visits Today",
        shortLabel: "VIS",
        format: "number",
      },
      {
        id: "newPatients",
        label: "New Patients",
        shortLabel: "NEW",
        format: "number",
      },
      {
        id: "adjustments",
        label: "Adjustments",
        shortLabel: "ADJ",
        format: "number",
      },
      {
        id: "retention",
        label: "Retention",
        shortLabel: "RET",
        unit: "%",
        format: "percentage",
      },
    ],
    intents: [
      {
        id: "schedule_visit",
        name: "Schedule Visit",
        description: "Patient wants to book",
        examples: ["Schedule adjustment", "Book appointment"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "new_patient",
        name: "New Patient",
        description: "First time caller",
        examples: ["New patient", "First visit"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "insurance",
        name: "Insurance",
        description: "Coverage questions",
        examples: ["Take insurance", "Covered by"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 65,
      currency: "USD",
      taxRate: 0,
      fees: [
        {
          id: "new_patient",
          label: "New Patient Exam",
          amount: 125,
          type: "fixed",
        },
        { id: "xray", label: "X-Ray", amount: 150, type: "fixed" },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. How can we help you feel better today?",
    ],
    faqTemplates: [
      {
        question: "Do you take walk-ins?",
        answer:
          "We do accept walk-ins when available, but appointments are recommended.",
        category: "scheduling",
      },
    ],
  },

  // ==========================================================================
  // AUTOMOTIVE
  // ==========================================================================
  auto_dealer: {
    id: "auto_dealer",
    category: "automotive",
    label: "Auto Dealership",
    description: "New and used car dealerships",
    icon: "Car",
    popular: true,
    terminology: {
      transaction: "Sale",
      transactionPlural: "Sales",
      customer: "Customer",
      customerPlural: "Customers",
      availability: "Inventory",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "leads",
        label: "Leads Today",
        shortLabel: "LEAD",
        format: "number",
      },
      {
        id: "testDrives",
        label: "Test Drives",
        shortLabel: "TEST",
        format: "number",
      },
      { id: "sales", label: "Sales MTD", shortLabel: "SALE", format: "number" },
      {
        id: "inventory",
        label: "In Stock",
        shortLabel: "INV",
        format: "number",
      },
    ],
    intents: [
      {
        id: "schedule_test_drive",
        name: "Test Drive",
        description: "Customer wants to test drive",
        examples: ["Test drive", "Try out a car"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "check_inventory",
        name: "Check Inventory",
        description: "Looking for specific vehicle",
        examples: ["Do you have", "Looking for a truck"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "pricing",
        name: "Pricing",
        description: "Price inquiry",
        examples: ["How much for", "Best price"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "financing",
        name: "Financing",
        description: "Finance questions",
        examples: ["Financing options", "Monthly payment"],
        action: "transfer",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 0,
      currency: "USD",
      taxRate: 0.06,
      fees: [
        { id: "doc", label: "Documentation Fee", amount: 499, type: "fixed" },
        { id: "prep", label: "Dealer Prep", amount: 0, type: "fixed" },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. I'm {agentName}. Are you looking for a new or pre-owned vehicle?",
    ],
    faqTemplates: [
      {
        question: "Do you offer financing?",
        answer:
          "Yes, we work with multiple lenders to find the best rates for all credit situations.",
        category: "financing",
      },
    ],
  },

  auto_service: {
    id: "auto_service",
    category: "automotive",
    label: "Auto Service",
    description: "Auto repair and service centers",
    icon: "Wrench",
    popular: true,
    terminology: {
      transaction: "Service",
      transactionPlural: "Services",
      customer: "Customer",
      customerPlural: "Customers",
      availability: "Bay Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "appointments",
        label: "Appointments",
        shortLabel: "APPT",
        format: "number",
      },
      {
        id: "inProgress",
        label: "In Progress",
        shortLabel: "WIP",
        format: "number",
      },
      {
        id: "completed",
        label: "Completed",
        shortLabel: "DONE",
        format: "number",
      },
      {
        id: "avgTicket",
        label: "Avg Ticket",
        shortLabel: "AVG",
        format: "currency",
      },
    ],
    intents: [
      {
        id: "schedule_service",
        name: "Schedule Service",
        description: "Customer needs service",
        examples: ["Oil change", "Schedule service"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "get_quote",
        name: "Get Quote",
        description: "Price estimate",
        examples: ["How much for brakes", "Cost of"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "status",
        name: "Check Status",
        description: "Vehicle status",
        examples: ["Is my car ready", "Status update"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "emergency",
        name: "Emergency",
        description: "Breakdown",
        examples: ["Car broke down", "Wont start"],
        action: "transfer",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 95,
      currency: "USD",
      taxRate: 0.08,
      fees: [
        {
          id: "diagnostic",
          label: "Diagnostic Fee",
          amount: 89,
          type: "fixed",
        },
        { id: "shop", label: "Shop Supplies", amount: 5, type: "percentage" },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. What can we help you with today?",
    ],
    faqTemplates: [
      {
        question: "Do you offer loaner cars?",
        answer:
          "Yes, we have loaner vehicles available for major repairs by appointment.",
        category: "services",
      },
    ],
  },

  car_rental: {
    id: "car_rental",
    category: "automotive",
    label: "Car Rental",
    description: "Vehicle rental services",
    icon: "CarFront",
    popular: false,
    terminology: {
      transaction: "Rental",
      transactionPlural: "Rentals",
      customer: "Renter",
      customerPlural: "Renters",
      availability: "Fleet Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "activeRentals",
        label: "Active Rentals",
        shortLabel: "ACTV",
        format: "number",
      },
      {
        id: "available",
        label: "Available",
        shortLabel: "AVAIL",
        format: "number",
      },
      {
        id: "pickups",
        label: "Pickups Today",
        shortLabel: "PICK",
        format: "number",
      },
      {
        id: "returns",
        label: "Returns Today",
        shortLabel: "RTN",
        format: "number",
      },
    ],
    intents: [
      {
        id: "book_rental",
        name: "Book Rental",
        description: "Customer wants to rent",
        examples: ["Rent a car", "Book a vehicle"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "check_availability",
        name: "Availability",
        description: "Check fleet",
        examples: ["SUV available", "What do you have"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "extend_rental",
        name: "Extend Rental",
        description: "Extend current rental",
        examples: ["Extend my rental", "Keep it longer"],
        action: "book",
        requiresConfirmation: true,
      },
    ],
    defaultPricing: {
      baseRate: 49,
      currency: "USD",
      taxRate: 0.15,
      fees: [
        { id: "insurance", label: "Insurance", amount: 19, type: "fixed" },
        {
          id: "underage",
          label: "Under 25 Fee",
          amount: 25,
          type: "fixed",
          conditional: "age < 25",
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. Would you like to make a reservation?",
    ],
    faqTemplates: [
      {
        question: "What do I need to rent?",
        answer:
          "You'll need a valid driver's license, credit card, and be at least 21 years old.",
        category: "requirements",
      },
    ],
  },

  towing: {
    id: "towing",
    category: "automotive",
    label: "Towing Service",
    description: "Towing and roadside assistance",
    icon: "Truck",
    popular: false,
    terminology: {
      transaction: "Service Call",
      transactionPlural: "Service Calls",
      customer: "Customer",
      customerPlural: "Customers",
      availability: "Truck Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "calls",
        label: "Calls Today",
        shortLabel: "CALL",
        format: "number",
      },
      {
        id: "active",
        label: "Active Jobs",
        shortLabel: "ACTV",
        format: "number",
      },
      {
        id: "avgResponse",
        label: "Avg Response",
        shortLabel: "RESP",
        format: "duration",
      },
      {
        id: "completed",
        label: "Completed",
        shortLabel: "DONE",
        format: "number",
      },
    ],
    intents: [
      {
        id: "request_tow",
        name: "Request Tow",
        description: "Customer needs tow",
        examples: ["Need a tow", "Car broke down"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "roadside",
        name: "Roadside Assist",
        description: "Roadside help",
        examples: ["Flat tire", "Locked out", "Jump start"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "pricing",
        name: "Pricing",
        description: "Cost inquiry",
        examples: ["How much to tow", "Towing cost"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 95,
      currency: "USD",
      taxRate: 0,
      fees: [
        { id: "mileage", label: "Per Mile", amount: 4, type: "fixed" },
        {
          id: "afterhours",
          label: "After Hours",
          amount: 50,
          type: "fixed",
          conditional: "isAfterHours",
        },
      ],
    },
    greetingTemplates: [
      "{businessName} towing, what's your location and situation?",
    ],
    faqTemplates: [
      {
        question: "How long until you arrive?",
        answer:
          "Typical response time is 30-45 minutes depending on your location.",
        category: "service",
      },
    ],
  },

  // ==========================================================================
  // PROFESSIONAL SERVICES
  // ==========================================================================
  legal: {
    id: "legal",
    category: "professional",
    label: "Law Firm",
    description: "Legal practices and law offices",
    icon: "Scale",
    popular: true,
    terminology: {
      transaction: "Consultation",
      transactionPlural: "Consultations",
      customer: "Client",
      customerPlural: "Clients",
      availability: "Attorney Availability",
      revenue: "Billables",
    },
    metrics: [
      {
        id: "consultations",
        label: "Consultations",
        shortLabel: "CONS",
        format: "number",
      },
      {
        id: "newMatters",
        label: "New Matters",
        shortLabel: "NEW",
        format: "number",
      },
      {
        id: "activeMatters",
        label: "Active Matters",
        shortLabel: "ACTV",
        format: "number",
      },
      {
        id: "billableHours",
        label: "Billable Hours",
        shortLabel: "HRS",
        format: "number",
      },
    ],
    intents: [
      {
        id: "schedule_consultation",
        name: "Consultation",
        description: "Client wants to meet",
        examples: ["Schedule consultation", "Meet with attorney"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "case_status",
        name: "Case Status",
        description: "Existing client inquiry",
        examples: ["Update on my case", "Case status"],
        action: "transfer",
        requiresConfirmation: false,
      },
      {
        id: "practice_areas",
        name: "Practice Areas",
        description: "Service inquiry",
        examples: ["Do you handle divorces", "Personal injury"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 350,
      currency: "USD",
      taxRate: 0,
      fees: [
        { id: "retainer", label: "Retainer", amount: 2500, type: "fixed" },
        { id: "filing", label: "Court Filing", amount: 0, type: "fixed" },
      ],
    },
    greetingTemplates: [
      "Thank you for calling the law offices of {businessName}. How may I direct your call?",
    ],
    faqTemplates: [
      {
        question: "Do you offer free consultations?",
        answer: "Yes, we offer a complimentary 30-minute initial consultation.",
        category: "consultations",
      },
    ],
  },

  accounting: {
    id: "accounting",
    category: "professional",
    label: "Accounting Firm",
    description: "CPA firms and accounting services",
    icon: "Calculator",
    popular: false,
    terminology: {
      transaction: "Engagement",
      transactionPlural: "Engagements",
      customer: "Client",
      customerPlural: "Clients",
      availability: "Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "appointments",
        label: "Appointments",
        shortLabel: "APPT",
        format: "number",
      },
      {
        id: "taxReturns",
        label: "Returns Filed",
        shortLabel: "TAX",
        format: "number",
      },
      {
        id: "activeClients",
        label: "Active Clients",
        shortLabel: "CLNT",
        format: "number",
      },
      {
        id: "pendingReturns",
        label: "Pending",
        shortLabel: "PEND",
        format: "number",
      },
    ],
    intents: [
      {
        id: "schedule_appointment",
        name: "Schedule Appointment",
        description: "Client wants to meet",
        examples: ["Schedule with CPA", "Tax appointment"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "document_status",
        name: "Document Status",
        description: "Check on documents",
        examples: ["Status of my return", "Documents ready"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "services",
        name: "Services",
        description: "Service inquiry",
        examples: ["Do you do bookkeeping", "Business taxes"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 200,
      currency: "USD",
      taxRate: 0,
      fees: [
        { id: "tax_return", label: "Tax Return", amount: 350, type: "fixed" },
        {
          id: "rush",
          label: "Rush Fee",
          amount: 150,
          type: "fixed",
          conditional: "isRush",
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. How can I assist you today?",
    ],
    faqTemplates: [
      {
        question: "When should I file my taxes?",
        answer:
          "Individual tax returns are due April 15th. We recommend scheduling early to avoid the rush.",
        category: "taxes",
      },
    ],
  },

  insurance: {
    id: "insurance",
    category: "professional",
    label: "Insurance Agency",
    description: "Insurance agents and brokers",
    icon: "Shield",
    popular: false,
    terminology: {
      transaction: "Policy",
      transactionPlural: "Policies",
      customer: "Policyholder",
      customerPlural: "Policyholders",
      availability: "Agent Availability",
      revenue: "Premiums",
    },
    metrics: [
      {
        id: "quotes",
        label: "Quotes Today",
        shortLabel: "QTE",
        format: "number",
      },
      {
        id: "newPolicies",
        label: "New Policies",
        shortLabel: "NEW",
        format: "number",
      },
      {
        id: "renewals",
        label: "Renewals",
        shortLabel: "RNW",
        format: "number",
      },
      { id: "claims", label: "Claims", shortLabel: "CLM", format: "number" },
    ],
    intents: [
      {
        id: "get_quote",
        name: "Get Quote",
        description: "Customer wants quote",
        examples: ["Quote for auto", "Insurance quote"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "file_claim",
        name: "File Claim",
        description: "Customer filing claim",
        examples: ["File a claim", "Had an accident"],
        action: "transfer",
        requiresConfirmation: false,
      },
      {
        id: "policy_info",
        name: "Policy Info",
        description: "Policy questions",
        examples: ["My policy number", "Coverage details"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "make_payment",
        name: "Make Payment",
        description: "Pay premium",
        examples: ["Make a payment", "Pay my bill"],
        action: "transfer",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 0,
      currency: "USD",
      taxRate: 0,
      fees: [],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. Are you an existing policyholder or looking for a new quote?",
    ],
    faqTemplates: [
      {
        question: "How do I file a claim?",
        answer:
          "You can file a claim by calling us directly or through your online portal 24/7.",
        category: "claims",
      },
    ],
  },

  consulting: {
    id: "consulting",
    category: "professional",
    label: "Consulting Firm",
    description: "Business and management consulting",
    icon: "Lightbulb",
    popular: false,
    terminology: {
      transaction: "Engagement",
      transactionPlural: "Engagements",
      customer: "Client",
      customerPlural: "Clients",
      availability: "Consultant Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "meetings",
        label: "Meetings Today",
        shortLabel: "MTG",
        format: "number",
      },
      {
        id: "activeProjects",
        label: "Active Projects",
        shortLabel: "PROJ",
        format: "number",
      },
      {
        id: "proposals",
        label: "Proposals",
        shortLabel: "PROP",
        format: "number",
      },
      {
        id: "utilization",
        label: "Utilization",
        shortLabel: "UTIL",
        unit: "%",
        format: "percentage",
      },
    ],
    intents: [
      {
        id: "schedule_meeting",
        name: "Schedule Meeting",
        description: "Client wants to meet",
        examples: ["Schedule a meeting", "Discuss project"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "project_status",
        name: "Project Status",
        description: "Project inquiry",
        examples: ["Project update", "Status of deliverable"],
        action: "transfer",
        requiresConfirmation: false,
      },
      {
        id: "services",
        name: "Services",
        description: "Service inquiry",
        examples: ["What services", "Consulting areas"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 250,
      currency: "USD",
      taxRate: 0,
      fees: [
        {
          id: "discovery",
          label: "Discovery Session",
          amount: 0,
          type: "fixed",
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. How can I help you today?",
    ],
    faqTemplates: [
      {
        question: "What industries do you serve?",
        answer:
          "We work with clients across healthcare, technology, finance, and manufacturing sectors.",
        category: "services",
      },
    ],
  },

  // ==========================================================================
  // PERSONAL CARE
  // ==========================================================================
  salon: {
    id: "salon",
    category: "personal_care",
    label: "Hair Salon",
    description: "Hair salons and styling studios",
    icon: "Scissors",
    popular: true,
    terminology: {
      transaction: "Appointment",
      transactionPlural: "Appointments",
      customer: "Client",
      customerPlural: "Clients",
      availability: "Stylist Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "appointments",
        label: "Appointments",
        shortLabel: "APPT",
        format: "number",
      },
      {
        id: "walkins",
        label: "Walk-ins",
        shortLabel: "WALK",
        format: "number",
      },
      {
        id: "productSales",
        label: "Product Sales",
        shortLabel: "PROD",
        format: "currency",
      },
      {
        id: "avgTicket",
        label: "Avg Ticket",
        shortLabel: "AVG",
        format: "currency",
      },
    ],
    intents: [
      {
        id: "book_appointment",
        name: "Book Appointment",
        description: "Client wants to book",
        examples: ["Book a haircut", "Appointment with Sarah"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "services",
        name: "Services",
        description: "Service inquiry",
        examples: ["Do you do color", "Services offered"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "pricing",
        name: "Pricing",
        description: "Price inquiry",
        examples: ["How much for highlights", "Pricing"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 45,
      currency: "USD",
      taxRate: 0.08,
      fees: [
        { id: "color", label: "Color Service", amount: 85, type: "fixed" },
        {
          id: "noshow",
          label: "No-Show Fee",
          amount: 25,
          type: "fixed",
          conditional: "isNoShow",
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. Would you like to book an appointment?",
    ],
    faqTemplates: [
      {
        question: "Do I need an appointment?",
        answer:
          "Appointments are recommended but we do accept walk-ins when stylists are available.",
        category: "booking",
      },
    ],
  },

  spa: {
    id: "spa",
    category: "personal_care",
    label: "Spa",
    description: "Day spas and wellness centers",
    icon: "Sparkles",
    popular: false,
    terminology: {
      transaction: "Appointment",
      transactionPlural: "Appointments",
      customer: "Guest",
      customerPlural: "Guests",
      availability: "Therapist Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "appointments",
        label: "Appointments",
        shortLabel: "APPT",
        format: "number",
      },
      {
        id: "massages",
        label: "Massages",
        shortLabel: "MASS",
        format: "number",
      },
      { id: "facials", label: "Facials", shortLabel: "FACE", format: "number" },
      {
        id: "avgTicket",
        label: "Avg Ticket",
        shortLabel: "AVG",
        format: "currency",
      },
    ],
    intents: [
      {
        id: "book_service",
        name: "Book Service",
        description: "Guest wants to book",
        examples: ["Book a massage", "Spa appointment"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "services",
        name: "Services",
        description: "Service menu",
        examples: ["What services", "Spa menu"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "packages",
        name: "Packages",
        description: "Package inquiry",
        examples: ["Spa packages", "Couples massage"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 95,
      currency: "USD",
      taxRate: 0.08,
      fees: [
        {
          id: "gratuity",
          label: "Service Charge",
          amount: 20,
          type: "percentage",
        },
        {
          id: "late_cancel",
          label: "Late Cancellation",
          amount: 50,
          type: "fixed",
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName} spa. How may I help you relax today?",
    ],
    faqTemplates: [
      {
        question: "What should I wear?",
        answer:
          "We provide robes and slippers. Please arrive 15 minutes early to enjoy our amenities.",
        category: "preparation",
      },
    ],
  },

  barbershop: {
    id: "barbershop",
    category: "personal_care",
    label: "Barbershop",
    description: "Traditional barbershops",
    icon: "Scissors",
    popular: false,
    terminology: {
      transaction: "Cut",
      transactionPlural: "Cuts",
      customer: "Client",
      customerPlural: "Clients",
      availability: "Barber Availability",
      revenue: "Revenue",
    },
    metrics: [
      { id: "cuts", label: "Cuts Today", shortLabel: "CUT", format: "number" },
      {
        id: "walkins",
        label: "Walk-ins",
        shortLabel: "WALK",
        format: "number",
      },
      { id: "shaves", label: "Shaves", shortLabel: "SHV", format: "number" },
      {
        id: "avgTicket",
        label: "Avg Ticket",
        shortLabel: "AVG",
        format: "currency",
      },
    ],
    intents: [
      {
        id: "book_cut",
        name: "Book Haircut",
        description: "Client wants a cut",
        examples: ["Book a haircut", "Appointment for cut"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "walk_in",
        name: "Walk-in",
        description: "Check wait time",
        examples: ["How long is the wait", "Walk-in available"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "services",
        name: "Services",
        description: "Service inquiry",
        examples: ["Do you do shaves", "Beard trim"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 30,
      currency: "USD",
      taxRate: 0.08,
      fees: [
        { id: "shave", label: "Hot Shave", amount: 25, type: "fixed" },
        { id: "beard", label: "Beard Trim", amount: 15, type: "fixed" },
      ],
    },
    greetingTemplates: ["{businessName}, how can I help you?"],
    faqTemplates: [
      {
        question: "Do you take walk-ins?",
        answer:
          "Yes, we take walk-ins on a first-come basis. Appointments are also available.",
        category: "booking",
      },
    ],
  },

  fitness: {
    id: "fitness",
    category: "personal_care",
    label: "Fitness Center",
    description: "Gyms and fitness studios",
    icon: "Dumbbell",
    popular: false,
    terminology: {
      transaction: "Session",
      transactionPlural: "Sessions",
      customer: "Member",
      customerPlural: "Members",
      availability: "Class Schedule",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "checkins",
        label: "Check-ins",
        shortLabel: "CHK",
        format: "number",
      },
      {
        id: "classes",
        label: "Classes Today",
        shortLabel: "CLS",
        format: "number",
      },
      {
        id: "ptSessions",
        label: "PT Sessions",
        shortLabel: "PT",
        format: "number",
      },
      {
        id: "newMembers",
        label: "New Members",
        shortLabel: "NEW",
        format: "number",
      },
    ],
    intents: [
      {
        id: "membership_info",
        name: "Membership Info",
        description: "Membership inquiry",
        examples: ["Membership options", "How much to join"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "book_class",
        name: "Book Class",
        description: "Class reservation",
        examples: ["Book spin class", "Reserve spot"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "personal_training",
        name: "Personal Training",
        description: "PT inquiry",
        examples: ["Personal trainer", "Training sessions"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "hours",
        name: "Hours",
        description: "Operating hours",
        examples: ["What time open", "Holiday hours"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 49,
      currency: "USD",
      taxRate: 0,
      fees: [
        {
          id: "enrollment",
          label: "Enrollment Fee",
          amount: 99,
          type: "fixed",
        },
        { id: "pt", label: "PT Session", amount: 75, type: "fixed" },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. Are you interested in membership information?",
    ],
    faqTemplates: [
      {
        question: "Do you have a free trial?",
        answer: "Yes, we offer a free 3-day trial for new guests.",
        category: "membership",
      },
    ],
  },

  // ==========================================================================
  // PROPERTY SERVICES
  // ==========================================================================
  real_estate: {
    id: "real_estate",
    category: "property",
    label: "Real Estate",
    description: "Real estate agencies",
    icon: "Home",
    popular: true,
    terminology: {
      transaction: "Showing",
      transactionPlural: "Showings",
      customer: "Client",
      customerPlural: "Clients",
      availability: "Agent Availability",
      revenue: "Commission",
    },
    metrics: [
      {
        id: "showings",
        label: "Showings",
        shortLabel: "SHOW",
        format: "number",
      },
      {
        id: "listings",
        label: "Active Listings",
        shortLabel: "LIST",
        format: "number",
      },
      { id: "leads", label: "New Leads", shortLabel: "LEAD", format: "number" },
      {
        id: "closings",
        label: "Closings MTD",
        shortLabel: "CLOS",
        format: "number",
      },
    ],
    intents: [
      {
        id: "schedule_showing",
        name: "Schedule Showing",
        description: "Client wants to see property",
        examples: ["Schedule a showing", "See the house"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "property_info",
        name: "Property Info",
        description: "Listing questions",
        examples: ["Details on listing", "How many bedrooms"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "sell_home",
        name: "Sell Home",
        description: "Listing inquiry",
        examples: ["Want to sell", "List my home"],
        action: "transfer",
        requiresConfirmation: false,
      },
      {
        id: "agent_request",
        name: "Speak to Agent",
        description: "Agent request",
        examples: ["Talk to an agent", "Speak to realtor"],
        action: "transfer",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 0,
      currency: "USD",
      taxRate: 0,
      fees: [],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. Are you looking to buy or sell?",
    ],
    faqTemplates: [
      {
        question: "What is your commission?",
        answer:
          "Our commission structure varies. An agent can discuss this during your consultation.",
        category: "fees",
      },
    ],
  },

  property_management: {
    id: "property_management",
    category: "property",
    label: "Property Management",
    description: "Residential property management",
    icon: "Building",
    popular: false,
    terminology: {
      transaction: "Lease",
      transactionPlural: "Leases",
      customer: "Tenant",
      customerPlural: "Tenants",
      availability: "Unit Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "units",
        label: "Total Units",
        shortLabel: "UNIT",
        format: "number",
      },
      {
        id: "occupied",
        label: "Occupied",
        shortLabel: "OCC",
        format: "number",
      },
      {
        id: "workOrders",
        label: "Work Orders",
        shortLabel: "WO",
        format: "number",
      },
      { id: "moveIns", label: "Move-ins", shortLabel: "IN", format: "number" },
    ],
    intents: [
      {
        id: "schedule_tour",
        name: "Schedule Tour",
        description: "Prospect wants to tour",
        examples: ["Schedule a tour", "See an apartment"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "maintenance",
        name: "Maintenance Request",
        description: "Tenant issue",
        examples: ["Maintenance request", "Something broken"],
        action: "message",
        requiresConfirmation: false,
      },
      {
        id: "rent_payment",
        name: "Rent Payment",
        description: "Payment inquiry",
        examples: ["Pay rent", "Payment question"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "emergency",
        name: "Emergency",
        description: "Urgent maintenance",
        examples: ["Emergency", "Flood", "No heat"],
        action: "transfer",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 1200,
      currency: "USD",
      taxRate: 0,
      fees: [
        {
          id: "application",
          label: "Application Fee",
          amount: 50,
          type: "fixed",
        },
        {
          id: "pet",
          label: "Pet Deposit",
          amount: 300,
          type: "fixed",
          conditional: "hasPet",
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. Are you a current resident or looking for a new home?",
    ],
    faqTemplates: [
      {
        question: "What are the requirements to rent?",
        answer:
          "Generally we require proof of income 3x rent, good credit, and references.",
        category: "leasing",
      },
    ],
  },

  home_services: {
    id: "home_services",
    category: "property",
    label: "Home Services",
    description: "General home maintenance and handyman",
    icon: "Wrench",
    popular: false,
    terminology: {
      transaction: "Job",
      transactionPlural: "Jobs",
      customer: "Customer",
      customerPlural: "Customers",
      availability: "Crew Schedule",
      revenue: "Revenue",
    },
    metrics: [
      { id: "jobs", label: "Jobs Today", shortLabel: "JOB", format: "number" },
      { id: "quotes", label: "Quotes", shortLabel: "QTE", format: "number" },
      {
        id: "completed",
        label: "Completed",
        shortLabel: "DONE",
        format: "number",
      },
      {
        id: "avgTicket",
        label: "Avg Ticket",
        shortLabel: "AVG",
        format: "currency",
      },
    ],
    intents: [
      {
        id: "book_service",
        name: "Book Service",
        description: "Customer needs service",
        examples: ["Need help with", "Schedule service"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "get_quote",
        name: "Get Quote",
        description: "Price inquiry",
        examples: ["How much for", "Get a quote"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "emergency",
        name: "Emergency",
        description: "Urgent service",
        examples: ["Emergency", "Urgent"],
        action: "transfer",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 85,
      currency: "USD",
      taxRate: 0.08,
      fees: [
        {
          id: "service_call",
          label: "Service Call",
          amount: 75,
          type: "fixed",
        },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. What can we help you with today?",
    ],
    faqTemplates: [
      {
        question: "Do you offer free estimates?",
        answer: "Yes, we provide free estimates for most projects.",
        category: "pricing",
      },
    ],
  },

  hvac: {
    id: "hvac",
    category: "property",
    label: "HVAC",
    description: "Heating and air conditioning services",
    icon: "Thermometer",
    popular: true,
    terminology: {
      transaction: "Service Call",
      transactionPlural: "Service Calls",
      customer: "Customer",
      customerPlural: "Customers",
      availability: "Tech Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "calls",
        label: "Calls Today",
        shortLabel: "CALL",
        format: "number",
      },
      {
        id: "installs",
        label: "Installs",
        shortLabel: "INST",
        format: "number",
      },
      { id: "repairs", label: "Repairs", shortLabel: "RPR", format: "number" },
      {
        id: "avgTicket",
        label: "Avg Ticket",
        shortLabel: "AVG",
        format: "currency",
      },
    ],
    intents: [
      {
        id: "schedule_service",
        name: "Schedule Service",
        description: "Customer needs service",
        examples: ["AC not working", "Schedule service"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "emergency",
        name: "Emergency",
        description: "No heat/AC emergency",
        examples: ["No heat", "AC down", "Emergency"],
        action: "transfer",
        requiresConfirmation: false,
      },
      {
        id: "get_quote",
        name: "Get Quote",
        description: "Installation quote",
        examples: ["Quote for new AC", "System replacement"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "maintenance",
        name: "Maintenance",
        description: "Maintenance plan",
        examples: ["Tune up", "Maintenance plan"],
        action: "book",
        requiresConfirmation: true,
      },
    ],
    defaultPricing: {
      baseRate: 89,
      currency: "USD",
      taxRate: 0.08,
      fees: [
        { id: "diagnostic", label: "Diagnostic", amount: 89, type: "fixed" },
        {
          id: "emergency",
          label: "Emergency Fee",
          amount: 99,
          type: "fixed",
          conditional: "isEmergency",
        },
      ],
    },
    greetingTemplates: [
      "{businessName} heating and cooling. Is this an emergency or routine service?",
    ],
    faqTemplates: [
      {
        question: "Do you offer financing?",
        answer:
          "Yes, we offer financing for new system installations with approved credit.",
        category: "financing",
      },
    ],
  },

  plumbing: {
    id: "plumbing",
    category: "property",
    label: "Plumbing",
    description: "Plumbing repair and installation",
    icon: "Droplet",
    popular: true,
    terminology: {
      transaction: "Service Call",
      transactionPlural: "Service Calls",
      customer: "Customer",
      customerPlural: "Customers",
      availability: "Plumber Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "calls",
        label: "Calls Today",
        shortLabel: "CALL",
        format: "number",
      },
      {
        id: "completed",
        label: "Completed",
        shortLabel: "DONE",
        format: "number",
      },
      {
        id: "emergency",
        label: "Emergencies",
        shortLabel: "EMRG",
        format: "number",
      },
      {
        id: "avgTicket",
        label: "Avg Ticket",
        shortLabel: "AVG",
        format: "currency",
      },
    ],
    intents: [
      {
        id: "schedule_service",
        name: "Schedule Service",
        description: "Customer needs service",
        examples: ["Leaky faucet", "Schedule plumber"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "emergency",
        name: "Emergency",
        description: "Plumbing emergency",
        examples: ["Pipe burst", "Flooding", "Emergency"],
        action: "transfer",
        requiresConfirmation: false,
      },
      {
        id: "get_quote",
        name: "Get Quote",
        description: "Price inquiry",
        examples: ["Cost to replace", "Estimate"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 95,
      currency: "USD",
      taxRate: 0.08,
      fees: [
        {
          id: "service_call",
          label: "Service Call",
          amount: 79,
          type: "fixed",
        },
        {
          id: "emergency",
          label: "Emergency Fee",
          amount: 150,
          type: "fixed",
          conditional: "isEmergency",
        },
      ],
    },
    greetingTemplates: ["{businessName} plumbing. Is this an emergency?"],
    faqTemplates: [
      {
        question: "Do you do 24/7 emergency service?",
        answer: "Yes, we offer 24/7 emergency plumbing service.",
        category: "emergency",
      },
    ],
  },

  electrical: {
    id: "electrical",
    category: "property",
    label: "Electrical",
    description: "Electrical services and repairs",
    icon: "Zap",
    popular: false,
    terminology: {
      transaction: "Service Call",
      transactionPlural: "Service Calls",
      customer: "Customer",
      customerPlural: "Customers",
      availability: "Electrician Availability",
      revenue: "Revenue",
    },
    metrics: [
      {
        id: "calls",
        label: "Calls Today",
        shortLabel: "CALL",
        format: "number",
      },
      {
        id: "completed",
        label: "Completed",
        shortLabel: "DONE",
        format: "number",
      },
      {
        id: "inspections",
        label: "Inspections",
        shortLabel: "INSP",
        format: "number",
      },
      {
        id: "avgTicket",
        label: "Avg Ticket",
        shortLabel: "AVG",
        format: "currency",
      },
    ],
    intents: [
      {
        id: "schedule_service",
        name: "Schedule Service",
        description: "Customer needs service",
        examples: ["Outlet not working", "Schedule electrician"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "emergency",
        name: "Emergency",
        description: "Electrical emergency",
        examples: ["Power out", "Sparking", "Emergency"],
        action: "transfer",
        requiresConfirmation: false,
      },
      {
        id: "get_quote",
        name: "Get Quote",
        description: "Price inquiry",
        examples: ["Quote for panel", "Estimate"],
        action: "inquire",
        requiresConfirmation: false,
      },
    ],
    defaultPricing: {
      baseRate: 99,
      currency: "USD",
      taxRate: 0.08,
      fees: [
        {
          id: "service_call",
          label: "Service Call",
          amount: 89,
          type: "fixed",
        },
        {
          id: "emergency",
          label: "Emergency Fee",
          amount: 125,
          type: "fixed",
          conditional: "isEmergency",
        },
      ],
    },
    greetingTemplates: [
      "{businessName} electrical. How can we help you today?",
    ],
    faqTemplates: [
      {
        question: "Are you licensed?",
        answer: "Yes, all our electricians are fully licensed and insured.",
        category: "credentials",
      },
    ],
  },

  cleaning: {
    id: "cleaning",
    category: "property",
    label: "Cleaning Service",
    description: "Residential and commercial cleaning",
    icon: "Sparkles",
    popular: true,
    terminology: {
      transaction: "Cleaning",
      transactionPlural: "Cleanings",
      customer: "Customer",
      customerPlural: "Customers",
      availability: "Crew Schedule",
      revenue: "Revenue",
    },
    metrics: [
      { id: "jobs", label: "Jobs Today", shortLabel: "JOB", format: "number" },
      {
        id: "recurring",
        label: "Recurring",
        shortLabel: "REC",
        format: "number",
      },
      { id: "oneTime", label: "One-Time", shortLabel: "ONE", format: "number" },
      {
        id: "avgTicket",
        label: "Avg Ticket",
        shortLabel: "AVG",
        format: "currency",
      },
    ],
    intents: [
      {
        id: "book_cleaning",
        name: "Book Cleaning",
        description: "Customer wants cleaning",
        examples: ["Book a cleaning", "Schedule house cleaning"],
        action: "book",
        requiresConfirmation: true,
      },
      {
        id: "get_quote",
        name: "Get Quote",
        description: "Price inquiry",
        examples: ["How much for", "Cleaning quote"],
        action: "inquire",
        requiresConfirmation: false,
      },
      {
        id: "recurring",
        name: "Recurring Service",
        description: "Regular service",
        examples: ["Weekly cleaning", "Regular service"],
        action: "book",
        requiresConfirmation: true,
      },
    ],
    defaultPricing: {
      baseRate: 120,
      currency: "USD",
      taxRate: 0.08,
      fees: [
        { id: "deep_clean", label: "Deep Clean", amount: 60, type: "fixed" },
        { id: "supplies", label: "Supplies", amount: 0, type: "fixed" },
      ],
    },
    greetingTemplates: [
      "Thank you for calling {businessName}. Would you like to schedule a cleaning?",
    ],
    faqTemplates: [
      {
        question: "What do you bring?",
        answer:
          "We bring all cleaning supplies and equipment. Just let us know if you have preferences.",
        category: "supplies",
      },
    ],
  },
};

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  provider: "openai",
  voiceId: "nova",
  voiceName: "Nova",
  speakingRate: 1.0,
  pitch: 1.0,
  language: "en-US",
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  smsConfirmations: true,
  emailNotifications: true,
  liveTransfer: true,
  voicemailFallback: true,
  sentimentAnalysis: false,
  recordingEnabled: true,
  transcriptionEnabled: true,
  callerIdLookup: false,
  multiLanguage: false,
};

export const DEFAULT_OPERATING_HOURS = {
  timezone: "America/New_York",
  schedule: [
    { day: 0 as const, enabled: false, openTime: "09:00", closeTime: "17:00" },
    { day: 1 as const, enabled: true, openTime: "09:00", closeTime: "17:00" },
    { day: 2 as const, enabled: true, openTime: "09:00", closeTime: "17:00" },
    { day: 3 as const, enabled: true, openTime: "09:00", closeTime: "17:00" },
    { day: 4 as const, enabled: true, openTime: "09:00", closeTime: "17:00" },
    { day: 5 as const, enabled: true, openTime: "09:00", closeTime: "17:00" },
    { day: 6 as const, enabled: false, openTime: "09:00", closeTime: "17:00" },
  ],
  holidays: [],
};

export const DEFAULT_PERSONALITY: AgentPersonality = {
  tone: "professional",
  verbosity: "balanced",
  empathy: "medium",
  humor: false,
};

export const DEFAULT_GREETINGS: GreetingConfig = {
  standard:
    "Thank you for calling {businessName}. This is {agentName}, how may I assist you today?",
  afterHours:
    "Thank you for calling {businessName}. We are currently closed. I can still help with some requests or take a message.",
  holiday:
    "Happy holidays from {businessName}! We are currently closed but I can still assist you.",
  busy: "Thank you for your patience. I'm {agentName} with {businessName}. How can I help you?",
  returning:
    "Welcome back! Thank you for calling {businessName} again. How can I help you today?",
};

export const DEFAULT_RESPONSES: CustomResponses = {
  notAvailable:
    "I apologize, but that is not available at this time. Is there anything else I can help you with?",
  transferring:
    "I'll transfer you to someone who can better assist you. Please hold for just a moment.",
  bookingConfirmed:
    "Great! Your booking has been confirmed. You'll receive a confirmation shortly.",
  bookingFailed:
    "I apologize, but I was unable to complete that booking. Would you like to try a different option?",
  goodbye: "Thank you for calling {businessName}. Have a great day!",
  holdMessage: "Thank you for holding. I'm still working on your request.",
  fallback:
    "I want to make sure I understand you correctly. Could you please rephrase that?",
};

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createDefaultConfig(
  industry: IndustryType,
  userRole: "developer" | "admin" | "staff" = "developer",
): AppConfig {
  const preset = INDUSTRY_PRESETS[industry];
  const themeColor = getDefaultThemeForIndustry(industry);

  return {
    industry,
    businessName: "",
    agentName: "Lumentra",
    agentVoice: { ...DEFAULT_VOICE_CONFIG },
    agentPersonality: { ...DEFAULT_PERSONALITY },
    themeColor,
    pricing: { ...preset.defaultPricing },
    operatingHours: { ...DEFAULT_OPERATING_HOURS },
    lateNightMode: {
      enabled: true,
      startTime: "22:00",
      endTime: "06:00",
      behavior: "full_service",
    },
    escalation: {
      enabled: true,
      triggers: [
        {
          id: "angry",
          condition: "sentiment < -0.5",
          action: "transfer",
          priority: "high",
        },
        {
          id: "emergency",
          condition: "intent === emergency",
          action: "transfer",
          priority: "critical",
        },
        {
          id: "complex",
          condition: "confidence < 0.6",
          action: "message",
          priority: "medium",
        },
      ],
      notifyOnEscalation: true,
      maxWaitTime: 60,
    },
    greetings: { ...DEFAULT_GREETINGS },
    responses: { ...DEFAULT_RESPONSES },
    faqs: preset.faqTemplates.map((faq, index) => ({
      id: `faq_${index}`,
      ...faq,
      enabled: true,
      priority: index,
    })),
    features: { ...DEFAULT_FEATURE_FLAGS },
    userRole,
    isConfigured: false,
  };
}

function getDefaultThemeForIndustry(
  industry: IndustryType,
): AppConfig["themeColor"] {
  const categoryThemes: Record<IndustryCategory, AppConfig["themeColor"]> = {
    hospitality: "indigo",
    healthcare: "blue",
    automotive: "zinc",
    professional: "violet",
    personal_care: "rose",
    property: "emerald",
  };

  const preset = INDUSTRY_PRESETS[industry];
  return categoryThemes[preset.category] || "indigo";
}

export function getPreset(industry: IndustryType): IndustryPreset {
  return INDUSTRY_PRESETS[industry];
}

export function getTerminology(industry: IndustryType) {
  return INDUSTRY_PRESETS[industry].terminology;
}

export function getIndustriesByCategory(
  category: IndustryCategory,
): IndustryPreset[] {
  return Object.values(INDUSTRY_PRESETS).filter(
    (preset) => preset.category === category,
  );
}

export function getPopularIndustries(): IndustryPreset[] {
  return Object.values(INDUSTRY_PRESETS).filter((preset) => preset.popular);
}
