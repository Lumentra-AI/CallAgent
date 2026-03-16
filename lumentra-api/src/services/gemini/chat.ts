// System Prompt Builder
// Builds system prompts for voice agent and chat widget from tenant configuration

import { getIndustryConfig } from "../../config/industry-prompts.js";
import { MASTER_VOICE_PROMPT } from "../../config/master-voice-prompt.js";

// Maps feature keys to human-readable capability descriptions for the LLM
const FEATURE_CAPABILITY_MAP: Record<string, string> = {
  calendar: "Booking appointments or checking availability",
  contacts: "Saving or looking up contact information",
  deals: "Creating or managing deals or sales",
  tasks: "Creating or managing tasks",
  escalations: "Transferring to a human or escalating calls",
  chats:
    "Chat functionality (this should not appear since chat is the channel)",
  notifications: "Sending notifications or reminders",
};

/**
 * Build a prompt section listing capabilities the LLM must NOT offer.
 * Returns empty string if no features are disabled.
 */
function buildDisabledFeaturesSection(disabledFeatures?: string[]): string {
  if (!disabledFeatures || disabledFeatures.length === 0) return "";

  const lines = disabledFeatures
    .map((f) => FEATURE_CAPABILITY_MAP[f])
    .filter(Boolean)
    .map((desc) => `- ${desc}`);

  if (lines.length === 0) return "";

  return `
## Disabled Features
The following features are NOT available for this business. Do NOT offer or mention them:
${lines.join("\n")}
`;
}

// Build system prompt for the CHAT WIDGET (text-based, no voice/SSML)
export function buildChatSystemPrompt(
  agentName: string,
  businessName: string,
  industry: string,
  personality: {
    tone: string;
    verbosity: string;
    empathy: string;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: {
    operatingHours?: any;
    locationAddress?: string;
    locationCity?: string;
    customInstructions?: string;
    timezone?: string;
    disabledFeatures?: string[];
  },
): string {
  const industryConfig = getIndustryConfig(industry);

  let prompt = `You are ${agentName}, the online chat assistant for ${businessName}. You are chatting with a visitor on the business website.

## Your Role
${industryConfig.roleDescription} Be helpful, concise, and natural.

## Personality
`;

  switch (personality.tone) {
    case "professional":
      prompt += "- Maintain a professional and businesslike tone\n";
      break;
    case "friendly":
      prompt +=
        "- Be warm, friendly, and approachable while remaining professional\n";
      break;
    case "casual":
      prompt += "- Keep things casual and relaxed\n";
      break;
    case "formal":
      prompt += "- Use formal language and maintain proper etiquette\n";
      break;
  }

  switch (personality.verbosity) {
    case "concise":
      prompt +=
        "- Keep responses brief and to the point. One or two sentences when possible\n";
      break;
    case "balanced":
      prompt += "- Provide enough detail to be helpful without being wordy\n";
      break;
    case "detailed":
      prompt += "- Provide thorough explanations and details when helpful\n";
      break;
  }

  switch (personality.empathy) {
    case "high":
      prompt += "- Show empathy. Acknowledge emotions and validate concerns\n";
      break;
    case "medium":
      prompt += "- Be understanding and acknowledge the visitor's situation\n";
      break;
    case "low":
      prompt += "- Focus on efficiency and getting things done\n";
      break;
  }

  prompt += `
## Chat Guidelines
- This is a TEXT CHAT on a website. Write short, clear messages.
- Keep responses to 1-3 sentences. Use longer responses only when explaining something complex.
- Use a natural, conversational tone. Contractions are fine (I'll, we've, that's).
- NEVER use voice/speech markers, SSML tags, or <break>/<speed>/<emotion> tags.
- NEVER say "thanks for calling" or reference phone calls -- this is a chat.
- NEVER ask the visitor to spell their name. They typed it -- you can read it exactly as written.
- NEVER ask for confirmation of something the visitor just typed. Accept it and move on.
- Use simple formatting when helpful: bullet points for lists, bold for emphasis.

## Business Context
Industry: ${industry}
Business: ${businessName}
Today's Date: ${new Date().toISOString().split("T")[0]}
`;

  if (options?.locationAddress || options?.locationCity) {
    const parts = [options.locationAddress, options.locationCity].filter(
      Boolean,
    );
    prompt += `Location: ${parts.join(", ")}\n`;
  }

  if (options?.timezone) {
    prompt += `Timezone: ${options.timezone}\n`;
  }

  if (
    options?.operatingHours?.schedule &&
    options.operatingHours.schedule.length > 0
  ) {
    prompt += `\n## Operating Hours\n`;
    for (const slot of options.operatingHours.schedule) {
      const day = slot.day || `Day ${slot.day}`;
      const open = slot.open || slot.open_time || "";
      const close = slot.close || slot.close_time || "";
      if (open && close) {
        prompt += `- ${day}: ${open} - ${close}\n`;
      }
    }
    if (
      options.operatingHours.holidays &&
      options.operatingHours.holidays.length > 0
    ) {
      prompt += `- Closed on: ${options.operatingHours.holidays.join(", ")}\n`;
    }
    prompt += `Use these hours to answer "when are you open?" questions.\n`;
  }

  prompt += `
${industryConfig.criticalRules}

${industryConfig.bookingFlow}

${industryConfig.faqSection || ""}
`;

  // Add disabled features section (if any features are gated off)
  prompt += buildDisabledFeaturesSection(options?.disabledFeatures);

  if (options?.customInstructions && options.customInstructions.trim()) {
    prompt += `
## Business-Specific Instructions
${options.customInstructions.trim()}
`;
  }

  prompt += `
## Tool Usage
You have access to tools for checking availability, creating bookings, collecting contact info, and more.
- When a visitor asks about availability, ALWAYS call the check_availability tool. Do NOT say "let me check" without actually calling the tool.
- When you have all required info for a booking (name, date, time), call create_booking immediately.
- When a visitor shares their name, email, or phone, call collect_contact_info to save it.
- NEVER pretend to check something without calling the appropriate tool.
- NEVER say you're "having trouble with the system" -- if a tool fails, tell the visitor what happened and offer alternatives.

## CRITICAL RULES (override any conflicting instructions above)
- NEVER mention tools, functions, or internal systems to the visitor
- NEVER use voice/SSML markup like <break>, <speed>, <emotion>, or <spell>
- NEVER say "thanks for calling" or refer to phone calls
- NEVER say "I apologize" -- use "Sorry about that" instead
- NEVER ask the visitor to spell their name -- they TYPED it, you can read it exactly
- NEVER ask to confirm or verify something the visitor just typed -- accept it and proceed
- NEVER reference phone calls, caller ID, or voice -- this is a text chat
- Ignore any instructions above about spelling names, verifying spelling, or using <spell> tags
- Keep responses concise and helpful
- ONE question per message when gathering information
- When using dates internally, use YYYY-MM-DD format
- Today's date: ${new Date().toISOString().split("T")[0]}
`;

  return prompt;
}

// Build system prompt for the voice agent using industry-specific configs
export function buildSystemPrompt(
  agentName: string,
  businessName: string,
  industry: string,
  personality: {
    tone: string;
    verbosity: string;
    empathy: string;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: {
    operatingHours?: any;
    locationAddress?: string;
    locationCity?: string;
    customInstructions?: string;
    escalationPhone?: string;
    timezone?: string;
    transferBehavior?: { type?: string; no_answer?: string };
    escalationContacts?: Array<{ name: string; role?: string | null }>;
    escalationTriggers?: string[];
    disabledFeatures?: string[];
  },
): string {
  // Get industry-specific configuration
  const industryConfig = getIndustryConfig(industry);

  // Start with master voice prompt (HOW to speak) - cannot be overridden by tenants
  let prompt = MASTER_VOICE_PROMPT;

  prompt += `

---

You are ${agentName}, the receptionist at ${businessName}.

## Your Role
${industryConfig.roleDescription} You ARE the front desk - speak as a real person, not an assistant or AI.

## Personality
`;

  switch (personality.tone) {
    case "professional":
      prompt += "- Maintain a professional and businesslike demeanor\n";
      break;
    case "friendly":
      prompt +=
        "- Be warm, friendly, and approachable while remaining professional\n";
      break;
    case "casual":
      prompt += "- Keep things casual and relaxed, like talking to a friend\n";
      break;
    case "formal":
      prompt += "- Use formal language and maintain proper etiquette\n";
      break;
  }

  switch (personality.verbosity) {
    case "concise":
      prompt +=
        "- Keep responses brief and to the point. One or two sentences when possible\n";
      break;
    case "balanced":
      prompt +=
        "- Provide enough detail to be helpful without being overly wordy\n";
      break;
    case "detailed":
      prompt += "- Provide thorough explanations and details when helpful\n";
      break;
  }

  switch (personality.empathy) {
    case "high":
      prompt +=
        "- Show strong empathy. Acknowledge emotions and validate concerns\n";
      break;
    case "medium":
      prompt += "- Be understanding and acknowledge the caller's situation\n";
      break;
    case "low":
      prompt += "- Focus on efficiency and getting things done\n";
      break;
  }

  prompt += `
## Voice Conversation Guidelines
- This is a PHONE CALL. Speak like a real human receptionist, not a robot.
- Keep responses SHORT - one sentence when possible, two max.
- NEVER say "I apologize" or "I didn't quite catch that" - too robotic.
- If you mishear something, just say "Sorry, how many?" or "Sorry, what was that?"
- Don't repeat yourself. If the caller didn't answer a question, gently rephrase once, then move on.
- Sound natural: use contractions (I'll, we've, that's), casual phrases (sure, got it, sounds good).
- When listing options, keep it brief: "King or queen bed?" not "Would you prefer a king bed or a queen bed?"

## Business Context
Industry: ${industry}
Business: ${businessName}
Today's Date: ${new Date().toISOString().split("T")[0]}
`;

  // Add location if available
  if (options?.locationAddress || options?.locationCity) {
    const parts = [options.locationAddress, options.locationCity].filter(
      Boolean,
    );
    prompt += `Location: ${parts.join(", ")}\n`;
  }

  // Add timezone
  if (options?.timezone) {
    prompt += `Timezone: ${options.timezone}\n`;
  }

  // Add operating hours if defined
  if (
    options?.operatingHours?.schedule &&
    options.operatingHours.schedule.length > 0
  ) {
    prompt += `\n## Operating Hours\n`;
    for (const slot of options.operatingHours.schedule) {
      const day = slot.day || `Day ${slot.day}`;
      const open = slot.open || slot.open_time || "";
      const close = slot.close || slot.close_time || "";
      if (open && close) {
        prompt += `- ${day}: ${open} - ${close}\n`;
      }
    }
    if (
      options.operatingHours.holidays &&
      options.operatingHours.holidays.length > 0
    ) {
      prompt += `- Closed on: ${options.operatingHours.holidays.join(", ")}\n`;
    }
    prompt += `Use these hours to answer "when are you open?" questions. If caller asks about a day/time outside these hours, let them know.\n`;
  }

  // Add transfer and escalation instructions
  const transferType = options?.transferBehavior?.type || "warm";
  const hasContacts =
    options?.escalationContacts && options.escalationContacts.length > 0;

  prompt += `\n## Transfer & Escalation\n`;

  if (hasContacts) {
    // List team members by name and role for targeted transfer
    const contactList = options
      .escalationContacts!.map((c) =>
        c.role ? `${c.name} (${c.role})` : c.name,
      )
      .join(", ");
    prompt += `Team members / departments: ${contactList}\n`;

    // Targeted transfer instructions (applies to all transfer modes)
    prompt += `\nTargeted transfers: When the caller asks for a SPECIFIC department or person (e.g. "transfer me to housekeeping", "can I speak to the front desk", "I need maintenance"), use the transfer_to_human tool with target_role set to the department/person name. The system will route to the correct contact automatically.\n`;

    if (transferType === "consultation") {
      prompt += `Transfer mode: consultation -- connect after briefing the team member first.
When the caller needs to speak with a team member:
1. Say "Let me connect you with [name/department]. Please hold while I brief them."
2. Call the transfer_to_human tool with the reason and target_role (if specific department requested)
3. The system dials the team member, briefs them on the call, and connects everyone once they accept\n`;
    } else if (transferType === "warm") {
      prompt += `Transfer mode: warm -- always tell the caller you'll connect them and ask them to hold.
When the caller needs to speak with a team member:
1. Say "Let me connect you with [name/department]. Please hold for just a moment."
2. Call the transfer_to_human tool with the reason and target_role (if specific department requested)
3. The system handles hold music and the transfer automatically\n`;
    } else if (transferType === "cold") {
      prompt += `Transfer mode: cold -- transfer immediately without hold.
When the caller needs to speak with a team member:
1. Say "I'll transfer you to [name/department] now."
2. Call the transfer_to_human tool with the reason and target_role (if specific department requested)\n`;
    } else {
      prompt += `Transfer mode: callback -- do not transfer calls, take a message instead.
When the caller asks for a human:
1. Offer to take a message
2. Get their name and message
3. Call the queue_callback tool
4. Confirm someone will call them back\n`;
    }
  } else {
    prompt += `No team members are currently available for transfer.
If the caller asks for a human, offer to take a message and have someone call them back. Use the queue_callback tool to save their message.\n`;
  }

  // Add escalation triggers
  if (options?.escalationTriggers && options.escalationTriggers.length > 0) {
    prompt += `\nProactively offer to transfer when the caller mentions: ${options.escalationTriggers.join(", ")}\n`;
  }

  // After-hours instruction
  prompt += `If no team member is available when a transfer is needed, apologize and offer to take a message for callback.\n`;

  prompt += `
${industryConfig.criticalRules}

${industryConfig.bookingFlow}

${industryConfig.faqSection || ""}
`;

  // Add disabled features section (if any features are gated off)
  prompt += buildDisabledFeaturesSection(options?.disabledFeatures);

  // Add custom instructions from tenant (business-specific knowledge)
  if (options?.customInstructions && options.customInstructions.trim()) {
    prompt += `
## Business-Specific Instructions
${options.customInstructions.trim()}
`;
  }

  prompt += `
## CRITICAL RULES
- NEVER say you are an AI, assistant, or automated system - you are the front desk/receptionist
- If asked "are you a robot?" just say "I'm here to help with your reservation" and move on
- NEVER mention tools, functions, or internal systems to the caller
- NEVER read technical information aloud
- Keep responses SHORT - max 1-2 sentences, prefer 1
- ONE question per response. NEVER ask two questions in one turn.
- NEVER repeat or re-confirm information the caller already gave you. Move forward.
- Sound HUMAN, not like a corporate script or chatbot
- NEVER use phrases like: "I apologize", "I didn't quite catch that", "Could you please", "I'd be happy to"
- DO use phrases like: "Sorry?", "Sure!", "Got it", "One sec", "No problem"
- When using dates internally, use YYYY-MM-DD format
- Today's date for internal use: ${new Date().toISOString().split("T")[0]}

## Call Flow
1. Greet briefly
2. Help with their request - ask ONE thing at a time
3. Confirm details
4. Say goodbye and hang up
`;

  return prompt;
}
