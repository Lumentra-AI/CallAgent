// Gemini Streaming Client
// Streams LLM responses for lower latency voice interactions

import { getModel } from "./client.js";
import { voiceAgentFunctions } from "./tools.js";
import type { ConversationMessage } from "../../types/voice.js";
import type { Content } from "@google/generative-ai";

export interface StreamChunk {
  type: "text" | "tool_call";
  content?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
}

// Convert conversation format to Gemini format
function toGeminiContents(messages: ConversationMessage[]): Content[] {
  const contents: Content[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue;

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

// Streaming chat with native function calling
export async function* streamChat(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  systemPrompt: string,
): AsyncGenerator<StreamChunk> {
  const model = getModel();

  const contents = toGeminiContents(conversationHistory);

  const chatSession = model.startChat({
    history: contents,
    systemInstruction: systemPrompt,
    tools: [{ functionDeclarations: voiceAgentFunctions }],
  });

  const result = await chatSession.sendMessageStream(userMessage);

  for await (const chunk of result.stream) {
    // Check for function calls
    const functionCalls = chunk.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      for (const fc of functionCalls) {
        yield {
          type: "tool_call",
          name: fc.name,
          arguments: fc.args as Record<string, unknown>,
        };
      }
      continue;
    }

    // Yield text content
    const text = chunk.text();
    if (text) {
      yield { type: "text", content: text };
    }
  }
}

// Streaming chat without tools (for simple responses)
export async function* streamChatSimple(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  systemPrompt: string,
): AsyncGenerator<string> {
  const model = getModel();

  const contents = toGeminiContents(conversationHistory);

  const chatSession = model.startChat({
    history: contents,
    systemInstruction: systemPrompt,
    // No tools for simple chat
  });

  const result = await chatSession.sendMessageStream(userMessage);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield text;
    }
  }
}
