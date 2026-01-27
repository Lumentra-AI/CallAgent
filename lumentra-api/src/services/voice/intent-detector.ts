// Intent Detector for Hybrid LLM Routing
// Optimized for accurate tool routing to reduce unnecessary 70B model calls
// and improve function calling accuracy

// High-confidence tool triggers (weighted scoring)
const highConfidenceToolPatterns = [
  // Direct booking/order actions
  { pattern: /\b(book|schedule|reserve)\s+(me|an?|the)/i, weight: 10 },
  { pattern: /\bi('d| would) like to (order|book|schedule)/i, weight: 10 },
  { pattern: /\bplace\s+(an?\s+)?order/i, weight: 10 },
  { pattern: /\bcan i (order|book|schedule)/i, weight: 10 },

  // Explicit food items (pizza ordering)
  {
    pattern:
      /\b(large|medium|small)\s+(pepperoni|cheese|supreme|veggie|hawaiian|margherita)/i,
    weight: 10,
  },
  { pattern: /\bpizza/i, weight: 8 },
  { pattern: /\b(wings|garlic knots|mozzarella sticks)/i, weight: 8 },

  // Order type specification
  { pattern: /\b(for\s+)?(pickup|pick.?up|delivery)/i, weight: 9 },
  { pattern: /\bdeliver(ed)?\s+to/i, weight: 10 },

  // Availability queries
  { pattern: /\bwhen\s+(are\s+you|can\s+i|do\s+you\s+have)/i, weight: 9 },
  { pattern: /\bwhat\s+times?\s+(are|do)/i, weight: 9 },
  { pattern: /\b(any\s+)?availability/i, weight: 8 },

  // Time slot selection (confirming offered times)
  {
    pattern: /\b(i'll\s+take|let's\s+do|book\s+(me\s+)?(for\s+)?)\s*(\d|the)/i,
    weight: 10,
  },
  {
    pattern: /\b(the\s+)?(first|second|third|last)\s+(one|slot|time)/i,
    weight: 9,
  },
  {
    pattern:
      /\b(sounds\s+good|that\s+works|perfect|yes)\s*[,.]?\s*(book|schedule)/i,
    weight: 10,
  },

  // Specific times
  { pattern: /\b\d{1,2}\s*(:|\.)\s*\d{2}\s*(am|pm)?/i, weight: 7 },
  { pattern: /\b\d{1,2}\s*(am|pm|a\.?m\.?|p\.?m\.?)/i, weight: 8 },
  { pattern: /\b(at\s+)?(noon|midnight)/i, weight: 7 },

  // Days/dates
  { pattern: /\b(tomorrow|today)\b/i, weight: 6 },
  {
    pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    weight: 6,
  },
  {
    pattern:
      /\bnext\s+(week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    weight: 7,
  },

  // Transfer requests
  {
    pattern:
      /\b(speak|talk)\s+(to|with)\s+(a\s+)?(human|person|agent|manager|someone)/i,
    weight: 10,
  },
  { pattern: /\btransfer\s+me/i, weight: 10 },
  { pattern: /\breal\s+person/i, weight: 10 },

  // Order modifications
  {
    pattern: /\b(cancel|reschedule|change|modify)\s+(my|the|this)/i,
    weight: 9,
  },

  // Call ending (must be strong signals)
  {
    pattern: /\b(goodbye|bye.?bye|that's\s+all|i'm\s+done|nothing\s+else)\b/i,
    weight: 8,
  },
  { pattern: /\bhang\s+up/i, weight: 10 },
];

// Low-confidence patterns (may need tools but often don't)
const lowConfidenceToolPatterns = [
  { pattern: /\byes\b/i, weight: 2 },
  { pattern: /\bno\b/i, weight: 1 },
  { pattern: /\bokay|ok|sure|alright/i, weight: 2 },
  { pattern: /\bthank(s| you)/i, weight: 1 },
  { pattern: /\b(extra|add|with|without)\b/i, weight: 3 },
];

// Chat-only patterns (negative weight)
const chatOnlyPatterns = [
  {
    pattern: /^(hi|hello|hey|good\s+(morning|afternoon|evening))[\s!.?]*$/i,
    weight: -8,
  },
  { pattern: /^how\s+are\s+you/i, weight: -6 },
  { pattern: /^what\s+(do\s+you\s+do|can\s+you\s+help)/i, weight: -4 },
  { pattern: /^(tell\s+me\s+about|what\s+is|who\s+are)/i, weight: -3 },
  { pattern: /^(thanks|thank\s+you)[\s!.]*$/i, weight: -5 }, // Just "thanks" alone
];

// Tool routing threshold
const TOOL_THRESHOLD = 5;

/**
 * Calculate intent score for a message
 * Positive = likely needs tools, Negative = likely chat only
 */
function calculateIntentScore(text: string): {
  score: number;
  triggers: string[];
} {
  let score = 0;
  const triggers: string[] = [];

  // Check high-confidence tool patterns
  for (const { pattern, weight } of highConfidenceToolPatterns) {
    if (pattern.test(text)) {
      score += weight;
      triggers.push(`+${weight}: ${pattern.source.substring(0, 30)}`);
    }
  }

  // Check low-confidence patterns
  for (const { pattern, weight } of lowConfidenceToolPatterns) {
    if (pattern.test(text)) {
      score += weight;
    }
  }

  // Check chat-only patterns (subtract)
  for (const { pattern, weight } of chatOnlyPatterns) {
    if (pattern.test(text)) {
      score += weight; // weight is already negative
      triggers.push(`${weight}: chat pattern`);
    }
  }

  // Short messages without clear triggers are likely confirmations/chat
  if (text.trim().split(/\s+/).length <= 3 && score < 3) {
    score -= 2;
  }

  return { score, triggers };
}

/**
 * Detect if a user message likely requires tool calling
 * Uses weighted scoring for more accurate routing
 * Returns true if tools should be enabled, false for simple chat
 */
export function needsToolCall(text: string): boolean {
  const { score, triggers } = calculateIntentScore(text);

  const needsTools = score >= TOOL_THRESHOLD;

  if (needsTools) {
    console.log(
      `[INTENT] Tools enabled (score=${score}): "${text.substring(0, 40)}..." [${triggers.slice(0, 2).join(", ")}]`,
    );
  } else {
    console.log(
      `[INTENT] Chat only (score=${score}): "${text.substring(0, 40)}..."`,
    );
  }

  return needsTools;
}

/**
 * Get raw intent score for debugging/analytics
 */
export function getIntentScore(text: string): number {
  return calculateIntentScore(text).score;
}

/**
 * Detect specific intent from user message
 * Used for analytics and routing
 */
export function detectIntent(text: string): string {
  const lowerText = text.toLowerCase();

  // Food ordering intents (check first as they're more specific)
  if (/order|pizza|delivery|pickup|pick up/i.test(lowerText)) {
    return "order";
  }
  if (/menu|what do you have|what's good|recommend/i.test(lowerText)) {
    return "menu";
  }
  if (/book|schedule|appointment|reserve/i.test(lowerText)) {
    return "booking";
  }
  if (/available|availability|open|free|slot|when/i.test(lowerText)) {
    return "availability";
  }
  if (/cancel|reschedule|change|modify/i.test(lowerText)) {
    return "modification";
  }
  if (/transfer|human|person|agent|speak to/i.test(lowerText)) {
    return "transfer";
  }
  if (/help|support|problem|issue/i.test(lowerText)) {
    return "support";
  }
  if (/price|cost|how much|rate/i.test(lowerText)) {
    return "pricing";
  }
  if (/location|address|where|directions/i.test(lowerText)) {
    return "location";
  }
  if (/hours|open|close|business hours/i.test(lowerText)) {
    return "hours";
  }

  return "general";
}
