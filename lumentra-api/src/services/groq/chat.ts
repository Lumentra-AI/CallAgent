// Groq Chat Service
// Handles LLM conversations with native tool calling

import { groqClient, chatConfig, toolConfig } from "./client.js";
import { voiceAgentTools, executeTool } from "./tools.js";
import type {
  ConversationMessage,
  GroqMessage,
  ToolExecutionContext,
} from "../../types/voice.js";
import { needsToolCall } from "../voice/intent-detector.js";
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

// Build system prompt for the voice agent
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
  const { terminology } = industryConfig;

  // Build personality section
  let personalitySection = "";
  switch (personality.tone) {
    case "professional":
      personalitySection +=
        "- Maintain a professional and businesslike demeanor\n";
      break;
    case "friendly":
      personalitySection +=
        "- Be warm, friendly, and approachable while remaining professional\n";
      break;
    case "casual":
      personalitySection +=
        "- Keep things casual and relaxed, like talking to a friend\n";
      break;
    case "formal":
      personalitySection +=
        "- Use formal language and maintain proper etiquette\n";
      break;
  }

  switch (personality.verbosity) {
    case "concise":
      personalitySection +=
        "- Keep responses brief and to the point. One or two sentences when possible\n";
      break;
    case "balanced":
      personalitySection +=
        "- Provide enough detail to be helpful without being overly wordy\n";
      break;
    case "detailed":
      personalitySection +=
        "- Provide thorough explanations and details when helpful\n";
      break;
  }

  switch (personality.empathy) {
    case "high":
      personalitySection +=
        "- Show strong empathy. Acknowledge emotions and validate concerns\n";
      break;
    case "medium":
      personalitySection +=
        "- Be understanding and acknowledge the caller's situation\n";
      break;
    case "low":
      personalitySection += "- Focus on efficiency and getting things done\n";
      break;
  }

  // Calculate tomorrow's date for examples
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const todayStr = new Date().toISOString().split("T")[0];

  // Build the full prompt using industry config
  const prompt = `You are ${agentName}, the AI voice assistant for ${businessName}.

## Your Role
${industryConfig.roleDescription} You represent the business professionally.

## Personality
${personalitySection}

## Voice Conversation Guidelines
- This is a voice conversation. Keep responses concise and natural.
- Don't use bullet points, markdown, or formatting - just speak naturally.
- Avoid long pauses. If you need to think, say "Let me check on that for you."
- Confirm important details by repeating them back.
- If you don't understand, ask for clarification.
- When providing multiple options, list no more than 3 at a time.

## Business Context
Industry: ${industry}
Business: ${businessName}
Today's Date: ${todayStr}
Terminology: ${terminology.transaction} (singular), ${terminology.transactionPlural} (plural)
${industryConfig.criticalRules}
${industryConfig.bookingFlow}
${industryConfig.faqSection || ""}

## CRITICAL RULES
- NEVER mention tools, functions, or internal systems to the caller
- NEVER read technical information aloud
- Keep responses SHORT - max 1-2 sentences
- Speak naturally like a human receptionist
- When using dates internally, use YYYY-MM-DD format
- Today's date for internal use: ${todayStr}

## FUNCTION CALLING EXAMPLES
Follow these patterns exactly:

EXAMPLE 1 - Checking availability:
Caller: "When are you available tomorrow?"
Your action: Call check_availability with date="${tomorrowStr}"

EXAMPLE 2 - Creating a ${terminology.transaction.toLowerCase()} (only after confirming time):
Caller: "Yes, book me for 2 PM"
Your action: Call create_booking with time="14:00", date="[the date discussed]", customer_name="[${terminology.customer.toLowerCase()} name given]"

EXAMPLE 3 - Missing info (DO NOT call tool yet):
Caller: "I need an appointment"
Your action: DO NOT call create_booking yet. Ask: "What date works best for you?"

## Call Flow
1. Greet briefly
2. Help with their request
3. Confirm details
4. Say goodbye and hang up
`;

  return prompt;
}

// Convert our conversation format to Groq format
function toGroqMessages(messages: ConversationMessage[]): GroqMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    tool_call_id: msg.toolCallId,
  }));
}

// Main chat function with hybrid model routing
export async function chat(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  systemPrompt: string,
  context: ToolExecutionContext,
): Promise<ChatResponse> {
  if (!groqClient) {
    throw new Error("Groq client not initialized - missing API key");
  }

  // Determine if we need tool calling
  const useTools = needsToolCall(userMessage);
  const config = useTools ? toolConfig : chatConfig;

  console.log(`[CHAT] Using model: ${config.model} (tools: ${useTools})`);

  // Build messages array
  const messages: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    ...toGroqMessages(conversationHistory),
    { role: "user", content: userMessage },
  ];

  try {
    const response = await groqClient.chat.completions.create({
      model: config.model,
      messages: messages as Parameters<
        typeof groqClient.chat.completions.create
      >[0]["messages"],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      ...(useTools && {
        tools: voiceAgentTools as Parameters<
          typeof groqClient.chat.completions.create
        >[0]["tools"],
      }),
    });

    const choice = response.choices[0];
    const message = choice.message;

    // Handle tool calls
    if (choice.finish_reason === "tool_calls" && message.tool_calls) {
      console.log(`[CHAT] Tool calls requested: ${message.tool_calls.length}`);

      const toolResults: ChatResponse["toolCalls"] = [];

      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        console.log(`[CHAT] Executing tool: ${toolName}`, toolArgs);

        const result = await executeTool(toolName, toolArgs, context);
        toolResults.push({
          name: toolName,
          args: toolArgs,
          result,
        });
      }

      // Get final response after tool execution
      const toolResultMessages: GroqMessage[] = [
        ...messages,
        {
          role: "assistant",
          content: "",
          tool_calls: message.tool_calls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: tc.function,
          })),
        },
        ...toolResults.map((tr, idx) => ({
          role: "tool" as const,
          content: JSON.stringify(tr.result),
          tool_call_id: message.tool_calls![idx].id,
        })),
      ];

      const finalResponse = await groqClient.chat.completions.create({
        model: config.model,
        messages: toolResultMessages as Parameters<
          typeof groqClient.chat.completions.create
        >[0]["messages"],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      });

      return {
        text: finalResponse.choices[0].message.content || "",
        toolCalls: toolResults,
      };
    }

    // No tool calls, just return the response
    return {
      text: message.content || "",
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
  if (!groqClient) {
    throw new Error("Groq client not initialized - missing API key");
  }

  const messages: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    ...toGroqMessages(conversationHistory),
    { role: "user", content: userMessage },
  ];

  const response = await groqClient.chat.completions.create({
    model: chatConfig.model,
    messages: messages as Parameters<
      typeof groqClient.chat.completions.create
    >[0]["messages"],
    temperature: chatConfig.temperature,
    max_tokens: chatConfig.maxTokens,
  });

  return response.choices[0].message.content || "";
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
// Uses direct Groq LLM with native tool calling
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
