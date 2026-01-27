// Groq Streaming Client
// Streams LLM responses for lower latency voice interactions

import { groqClient } from "./client.js";
import { voiceAgentTools } from "./tools.js";
import type { ConversationMessage, GroqMessage } from "../../types/voice.js";

export interface StreamChunk {
  type: "text" | "tool_call";
  content?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
}

interface PartialToolCall {
  id: string;
  name: string;
  arguments: string;
}

// Convert conversation format to Groq format
function toGroqMessages(messages: ConversationMessage[]): GroqMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    tool_call_id: msg.toolCallId,
  }));
}

// Streaming chat with native tool calling
export async function* streamChat(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  systemPrompt: string,
): AsyncGenerator<StreamChunk> {
  if (!groqClient) {
    throw new Error("Groq client not initialized - missing API key");
  }

  const messages: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    ...toGroqMessages(conversationHistory),
    { role: "user", content: userMessage },
  ];

  const stream = await groqClient.chat.completions.create({
    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    messages: messages as Parameters<
      typeof groqClient.chat.completions.create
    >[0]["messages"],
    tools: voiceAgentTools as Parameters<
      typeof groqClient.chat.completions.create
    >[0]["tools"],
    stream: true,
    temperature: 0.3,
    max_tokens: 500,
  });

  let currentToolCall: PartialToolCall | null = null;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;

    // Yield text content as it arrives
    if (delta?.content) {
      yield { type: "text", content: delta.content };
    }

    // Accumulate tool calls
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        if (tc.function?.name) {
          currentToolCall = {
            id: tc.id || "",
            name: tc.function.name,
            arguments: "",
          };
        }
        if (tc.function?.arguments) {
          if (currentToolCall) {
            currentToolCall.arguments += tc.function.arguments;
          }
        }
      }
    }

    // Yield complete tool call
    if (chunk.choices[0]?.finish_reason === "tool_calls" && currentToolCall) {
      try {
        yield {
          type: "tool_call",
          id: currentToolCall.id,
          name: currentToolCall.name,
          arguments: JSON.parse(currentToolCall.arguments),
        };
      } catch {
        console.error("[STREAM] Failed to parse tool arguments");
      }
      currentToolCall = null;
    }
  }
}

// Streaming chat without tools (for simple responses)
export async function* streamChatSimple(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  systemPrompt: string,
): AsyncGenerator<string> {
  if (!groqClient) {
    throw new Error("Groq client not initialized - missing API key");
  }

  const messages: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    ...toGroqMessages(conversationHistory),
    { role: "user", content: userMessage },
  ];

  const stream = await groqClient.chat.completions.create({
    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    messages: messages as Parameters<
      typeof groqClient.chat.completions.create
    >[0]["messages"],
    stream: true,
    temperature: 0.7,
    max_tokens: 150,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
