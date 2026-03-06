// System Prompt Builder
// Builds system prompts for voice agent and chat widget from tenant configuration

import { getIndustryConfig } from "../../config/industry-prompts.js";
import { MASTER_VOICE_PROMPT } from "../../config/master-voice-prompt.js";

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

  if (options?.customInstructions && options.customInstructions.trim()) {
    prompt += `
## Business-Specific Instructions
${options.customInstructions.trim()}
`;
  }

  prompt += `
## CRITICAL RULES
- NEVER mention tools, functions, or internal systems to the visitor
- NEVER use voice/SSML markup like <break>, <speed>, <emotion>, or <spell>
- NEVER say "thanks for calling" or refer to phone calls
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

  // Add escalation info
  if (options?.escalationPhone) {
    prompt += `\nTransfer phone: ${options.escalationPhone} (use when caller asks for a human/manager)\n`;
  } else {
    prompt += `\nNo transfer phone configured. If caller asks for a human, take a message and say someone will call back.\n`;
  }

  prompt += `
${industryConfig.criticalRules}

${industryConfig.bookingFlow}

${industryConfig.faqSection || ""}
`;

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
