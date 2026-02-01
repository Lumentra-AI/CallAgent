// Gemini Chat Service
// Handles LLM conversations with native function calling
// Simplified architecture - single model for all requests

import { getModel, modelName } from "./client.js";
import { voiceAgentFunctions, executeTool } from "./tools.js";
import type {
  ConversationMessage,
  ToolExecutionContext,
} from "../../types/voice.js";
import type { Content, Part } from "@google/generative-ai";
import {
  executeChain,
  createChainContext,
  cleanupRetryState,
  type ChainContext,
} from "../fallback/chain.js";
import type { EscalationState } from "../escalation/escalation-manager.js";
import { getIndustryConfig } from "../../config/industry-prompts.js";

interface ChatResponse {
  text: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
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
): string {
  // Get industry-specific configuration
  const industryConfig = getIndustryConfig(industry);

  let prompt = `You are ${agentName}, the AI voice assistant for ${businessName}.

## Your Role
${industryConfig.roleDescription} You represent the business professionally.

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

${industryConfig.criticalRules}

${industryConfig.bookingFlow}

${industryConfig.faqSection || ""}

## CRITICAL RULES
- NEVER mention tools, functions, or internal systems to the caller
- NEVER read technical information aloud
- Keep responses SHORT - max 1-2 sentences, prefer 1
- Sound HUMAN, not like a corporate script or chatbot
- NEVER use phrases like: "I apologize", "I didn't quite catch that", "Could you please", "I'd be happy to"
- DO use phrases like: "Sorry?", "Sure!", "Got it", "One sec", "No problem"
- When using dates internally, use YYYY-MM-DD format
- Today's date for internal use: ${new Date().toISOString().split("T")[0]}

## Call Flow
1. Greet briefly
2. Help with their request
3. Confirm details
4. Say goodbye and hang up
`;

  return prompt;
}

// Convert our conversation format to Gemini Content format
function toGeminiContents(messages: ConversationMessage[]): Content[] {
  const contents: Content[] = [];

  // Note: Gemini handles system prompts differently - we'll prepend to first user message
  // or use systemInstruction in the model config

  for (const msg of messages) {
    if (msg.role === "system") continue; // Handle separately

    if (msg.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: msg.content }],
      });
    } else if (msg.role === "assistant") {
      contents.push({
        role: "model",
        parts: [{ text: msg.content }],
      });
    } else if (msg.role === "tool") {
      // Tool responses go as function responses
      contents.push({
        role: "function",
        parts: [
          {
            functionResponse: {
              name: msg.toolName || "unknown",
              response: { result: msg.toolResult || msg.content },
            },
          },
        ],
      });
    }
  }

  return contents;
}

// Main chat function - simplified without model routing
export async function chat(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  systemPrompt: string,
  context: ToolExecutionContext,
): Promise<ChatResponse> {
  const model = getModel();

  console.log(`[CHAT] Using model: ${modelName}`);

  // Build contents array
  const contents = toGeminiContents(conversationHistory);
  contents.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  try {
    // Start chat with function declarations
    const chatSession = model.startChat({
      history: contents.slice(0, -1), // All but the last message
      systemInstruction: { role: "user", parts: [{ text: systemPrompt }] },
      tools: [{ functionDeclarations: voiceAgentFunctions }],
    });

    // Send the user message
    const result = await chatSession.sendMessage(userMessage);
    const response = result.response;

    // Check for function calls
    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      console.log(`[CHAT] Function calls requested: ${functionCalls.length}`);

      const toolResults: ChatResponse["toolCalls"] = [];
      const functionResponses: Part[] = [];

      for (const fc of functionCalls) {
        const toolName = fc.name;
        const toolArgs = fc.args as Record<string, unknown>;

        console.log(`[CHAT] Executing tool: ${toolName}`, toolArgs);

        const toolResult = await executeTool(toolName, toolArgs, context);
        toolResults.push({
          name: toolName,
          args: toolArgs,
          result: toolResult,
        });

        functionResponses.push({
          functionResponse: {
            name: toolName,
            response: { result: toolResult },
          },
        });
      }

      // Send function responses back to get final text
      const finalResult = await chatSession.sendMessage(functionResponses);
      const finalText = finalResult.response.text();

      return {
        text: finalText,
        toolCalls: toolResults,
      };
    }

    // No function calls, just return the text
    return {
      text: response.text(),
    };
  } catch (error) {
    console.error("[CHAT] Error:", error);
    throw error;
  }
}

// Simple response without tool calling (for quick chitchat)
export async function quickResponse(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  systemPrompt: string,
): Promise<string> {
  const model = getModel();

  const contents = toGeminiContents(conversationHistory);
  contents.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const chatSession = model.startChat({
    history: contents.slice(0, -1),
    systemInstruction: { role: "user", parts: [{ text: systemPrompt }] },
    // No tools for quick response
  });

  const result = await chatSession.sendMessage(userMessage);
  return result.response.text();
}

// Extended response type with chain metadata
export interface ChainChatResponse extends ChatResponse {
  action: "response" | "escalate" | "retry";
  escalationReason?: string;
  metrics: {
    llmUsed: boolean;
    retryCount: number;
    totalLatencyMs: number;
  };
}

// Chat with retry logic and escalation handling
export async function chatWithFallback(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  systemPrompt: string,
  context: ToolExecutionContext,
  escalationState: EscalationState,
): Promise<ChainChatResponse> {
  const chainContext: ChainContext = {
    tenantId: context.tenantId,
    callSid: context.callSid,
    callerPhone: context.callerPhone,
    conversationHistory,
    systemPrompt,
    escalationState,
  };

  // Execute with retry and escalation logic
  const result = await executeChain(
    userMessage,
    chainContext,
    // Direct LLM chat function with native tool calling
    async (msg, history, prompt, toolCtx) => {
      return chat(msg, history, prompt, toolCtx);
    },
  );

  console.log(
    `[CHAT] Result: action=${result.action}, ` +
      `llm=${result.metrics.llmUsed}, ` +
      `latency=${result.metrics.totalLatencyMs}ms`,
  );

  return {
    text: result.text,
    toolCalls: result.toolCalls,
    action: result.action,
    escalationReason: result.escalationReason,
    metrics: result.metrics,
  };
}

// Create a chain context for a new call
export function initializeChainContext(
  tenantId: string,
  callSid: string,
  callerPhone: string | undefined,
  conversationHistory: ConversationMessage[],
  systemPrompt: string,
  escalationPhone?: string,
): ChainContext {
  return createChainContext(
    tenantId,
    callSid,
    callerPhone,
    conversationHistory,
    systemPrompt,
    escalationPhone,
  );
}

// Cleanup when call ends
export function cleanupCall(callSid: string): void {
  cleanupRetryState(callSid);
}
