// Groq Chat Service
// Handles LLM conversations with hybrid model routing

import { groqClient, chatConfig, toolConfig } from "./client.js";
import { voiceAgentTools, executeTool } from "./tools.js";
import type {
  ConversationMessage,
  GroqMessage,
  ToolExecutionContext,
} from "../../types/voice.js";
import { needsToolCall } from "../voice/intent-detector.js";

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
  let prompt = `You are ${agentName}, the AI voice assistant for ${businessName}.

## Your Role
You help callers with inquiries, bookings, and support. You represent the business professionally.

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
- This is a voice conversation. Keep responses concise and natural.
- Don't use bullet points, markdown, or formatting - just speak naturally.
- Avoid long pauses. If you need to think, say "Let me check on that for you."
- Confirm important details by repeating them back.
- If you don't understand, ask for clarification.
- When providing multiple options, list no more than 3 at a time.

## Business Context
Industry: ${industry}
Business: ${businessName}

## Available Tools
You have access to these tools:
- check_availability: Check when appointments are available
- create_booking: Book an appointment for the customer
- transfer_to_human: Transfer to a staff member when needed

When a customer wants to book, first check availability, confirm the time with them, then create the booking.
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
