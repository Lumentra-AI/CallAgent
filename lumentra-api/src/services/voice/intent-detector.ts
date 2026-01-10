// Intent Detector for Hybrid LLM Routing
// Determines if a user message requires tool calling

// Patterns that typically indicate tool calling is needed
const toolTriggers = [
  // Booking-related
  /\b(book|schedule|appointment|reserve|reservation)\b/i,
  /\b(when can i|when are you|when do you)\b/i,

  // Availability
  /\b(available|availability|open|free|slot)\b/i,
  /\b(what times?|which days?)\b/i,

  // Transfer/escalation
  /\b(transfer|human|person|agent|speak to|talk to|representative)\b/i,
  /\b(real person|actual person|someone else)\b/i,

  // Booking modifications
  /\b(cancel|reschedule|change|modify)\b/i,
  /\b(my appointment|my booking|my reservation)\b/i,

  // Specific date/time mentions
  /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(next week|this week|next month)\b/i,
  /\b(\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))\b/i,
];

// Patterns that indicate simple chat (no tools needed)
const chatOnlyPatterns = [
  /\b(hi|hello|hey|good morning|good afternoon|good evening)\b/i,
  /\b(how are you|what's up|sup)\b/i,
  /\b(thank you|thanks|appreciate)\b/i,
  /\b(bye|goodbye|see you|take care)\b/i,
  /\b(yes|no|okay|ok|sure|alright)\b/i,
  /\b(what do you do|what can you help|what services)\b/i,
  /\b(tell me about|what is|who are)\b/i,
];

/**
 * Detect if a user message likely requires tool calling
 * Returns true if tools should be enabled, false for simple chat
 */
export function needsToolCall(text: string): boolean {
  // First check if it's clearly just chat
  const isChatOnly = chatOnlyPatterns.some((pattern) => pattern.test(text));
  const hasToolTrigger = toolTriggers.some((pattern) => pattern.test(text));

  // If it has tool triggers, use tools regardless of chat patterns
  if (hasToolTrigger) {
    console.log(`[INTENT] Tool call needed for: "${text.substring(0, 50)}..."`);
    return true;
  }

  // If it's clearly just chat, skip tools
  if (isChatOnly && !hasToolTrigger) {
    console.log(`[INTENT] Chat only for: "${text.substring(0, 50)}..."`);
    return false;
  }

  // For ambiguous cases, default to no tools (faster)
  console.log(
    `[INTENT] Ambiguous, defaulting to chat: "${text.substring(0, 50)}..."`,
  );
  return false;
}

/**
 * Detect specific intent from user message
 * Used for analytics and routing
 */
export function detectIntent(text: string): string {
  const lowerText = text.toLowerCase();

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
