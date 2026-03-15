// Streaming Multi-Provider LLM Service with Fallback
// Streams tokens from Gemini / OpenAI / Groq via callbacks.
// Provider order and fallback logic mirrors chatWithFallback in multi-provider.ts.

import { genAI, modelName as geminiModel } from "../gemini/client.js";
import { openaiClient, modelName as openaiModel } from "../openai/client.js";
import { groqClient, toolConfig } from "../groq/client.js";
import type { Part } from "@google/generative-ai";
import type { ConversationMessage } from "../../types/voice.js";
import type { LLMChatOptions } from "./multi-provider.js";
import {
  toOpenAIMessages,
  toOpenAITools,
  toGeminiContents,
  isProviderAvailable,
  isProviderInitialized,
  markProviderError,
  markProviderRateLimited,
  withTimeout,
} from "./multi-provider.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StreamCallbacks {
  onToken: (text: string) => void;
  onToolStart: (tool: string, args: Record<string, unknown>) => void;
  onToolResult: (tool: string, result: unknown) => void;
  onDone: (fullText: string, provider: string) => void;
  onError: (message: string) => void;
}

/** Returned when the model requests tool calls instead of producing text. */
export interface StreamToolCallRequest {
  provider: string;
  toolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
}

// ---------------------------------------------------------------------------
// Streaming timeout helper
// ---------------------------------------------------------------------------

const STREAM_TIMEOUT_MS = 30_000; // 30 s total for streaming calls

/**
 * Wraps an async streaming operation with a timeout. The timeout covers
 * the *entire* stream (connection + all chunks), not just the first byte.
 */
function withStreamTimeout<T>(fn: () => Promise<T>, label: string): Promise<T> {
  return withTimeout(fn(), STREAM_TIMEOUT_MS, label);
}

// ---------------------------------------------------------------------------
// Rate-limit / error detection (shared with multi-provider)
// ---------------------------------------------------------------------------

function isRateLimitError(errMsg: string): boolean {
  return (
    errMsg.includes("429") ||
    errMsg.includes("rate") ||
    errMsg.includes("quota") ||
    errMsg.includes("RESOURCE_EXHAUSTED")
  );
}

function handleProviderError(provider: string, error: unknown): string {
  let errMsg = "Unknown error";
  if (error instanceof Error) {
    errMsg = error.message;
  } else if (typeof error === "object" && error !== null) {
    errMsg = JSON.stringify(error).slice(0, 200);
  } else {
    errMsg = String(error);
  }

  console.error(`[LLM-STREAM] ${provider} failed: ${errMsg}`);

  if (isRateLimitError(errMsg)) {
    markProviderRateLimited(provider);
  } else {
    markProviderError(provider);
  }

  return errMsg;
}

// ---------------------------------------------------------------------------
// chatWithFallbackStream
// ---------------------------------------------------------------------------

/**
 * Stream an LLM response, trying providers in order: Gemini -> OpenAI -> Groq.
 *
 * Text tokens are emitted via `callbacks.onToken` as they arrive.
 *
 * If the model requests tool calls (instead of producing text), the returned
 * promise resolves with a {@link StreamToolCallRequest}. The caller should
 * execute the tools, then call {@link sendToolResultsStream} to stream
 * the post-tool response.
 *
 * If the model produces only text (no tool calls), `callbacks.onDone` is
 * called and the function resolves with `null`.
 */
export async function chatWithFallbackStream(
  options: LLMChatOptions,
  callbacks: StreamCallbacks,
): Promise<StreamToolCallRequest | null> {
  const providers: Array<{
    name: string;
    fn: () => Promise<StreamToolCallRequest | null>;
  }> = [
    { name: "gemini", fn: () => streamGemini(options, callbacks) },
    { name: "openai", fn: () => streamOpenAI(options, callbacks) },
    { name: "groq", fn: () => streamGroq(options, callbacks) },
  ];

  const errors: string[] = [];

  for (const provider of providers) {
    if (!isProviderInitialized(provider.name)) {
      console.log(
        `[LLM-STREAM] Skipping ${provider.name} (not initialized - no API key)`,
      );
      continue;
    }

    if (!isProviderAvailable(provider.name)) {
      console.log(`[LLM-STREAM] Skipping ${provider.name} (cooling down)`);
      continue;
    }

    try {
      console.log(`[LLM-STREAM] Trying ${provider.name}...`);
      const result = await withStreamTimeout(
        provider.fn,
        `${provider.name} stream`,
      );
      console.log(`[LLM-STREAM] ${provider.name} succeeded`);
      return result;
    } catch (error: unknown) {
      const errMsg = handleProviderError(provider.name, error);
      errors.push(`${provider.name}: ${errMsg}`);
      console.log(`[LLM-STREAM] Falling back to next provider...`);
    }
  }

  const msg = `All LLM providers failed (stream): ${errors.join("; ")}`;
  console.error(`[LLM-STREAM] ${msg}`);
  callbacks.onError(msg);
  throw new Error(msg);
}

// ---------------------------------------------------------------------------
// sendToolResultsStream
// ---------------------------------------------------------------------------

/**
 * After tools have been executed, stream the model's follow-up response.
 * Prefers the same provider that requested the tools, then falls back.
 */
export async function sendToolResultsStream(
  provider: string,
  options: LLMChatOptions,
  toolResults: Array<{ id: string; name: string; result: unknown }>,
  callbacks: StreamCallbacks,
): Promise<StreamToolCallRequest | null> {
  // Build an updated conversation history that includes the assistant
  // tool-call message and the tool-result messages.
  const updatedHistory: ConversationMessage[] = [
    ...options.conversationHistory,
  ];

  // The assistant message that triggered the tool calls
  updatedHistory.push({
    role: "assistant",
    content: "",
    timestamp: new Date(),
    toolCalls: toolResults.map((tr) => ({
      id: tr.id,
      name: tr.name,
      args: {},
    })),
  });

  // Each tool result
  for (const tr of toolResults) {
    const resultStr =
      typeof tr.result === "string" ? tr.result : JSON.stringify(tr.result);
    updatedHistory.push({
      role: "tool",
      content: resultStr,
      toolName: tr.name,
      toolCallId: tr.id,
      toolResult: resultStr,
      timestamp: new Date(),
    });
  }

  const updatedOptions: LLMChatOptions = {
    ...options,
    conversationHistory: updatedHistory,
    userMessage: "", // continuing after tool call
  };

  // Provider ordering: prefer the same provider, then fall back
  const order =
    provider === "gemini"
      ? ["gemini", "openai", "groq"]
      : provider === "openai"
        ? ["openai", "groq", "gemini"]
        : ["groq", "openai", "gemini"];

  const errors: string[] = [];

  for (const p of order) {
    if (!isProviderInitialized(p)) continue;
    if (!isProviderAvailable(p)) continue;

    try {
      console.log(`[LLM-STREAM] Tool results via ${p}...`);

      let result: StreamToolCallRequest | null;

      if (p === "gemini") {
        result = await withStreamTimeout(
          () => streamGeminiToolResults(options, toolResults, callbacks),
          `${p} tool-results stream`,
        );
      } else if (p === "openai") {
        result = await withStreamTimeout(
          () => streamOpenAI(updatedOptions, callbacks),
          `${p} tool-results stream`,
        );
      } else {
        result = await withStreamTimeout(
          () => streamGroq(updatedOptions, callbacks),
          `${p} tool-results stream`,
        );
      }

      console.log(`[LLM-STREAM] ${p} tool-results succeeded`);
      return result;
    } catch (error: unknown) {
      const errMsg = handleProviderError(p, error);
      errors.push(`${p}: ${errMsg}`);
    }
  }

  const msg = `All providers failed for tool results (stream): ${errors.join("; ")}`;
  callbacks.onError(msg);
  throw new Error(msg);
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

// ---- Gemini ---------------------------------------------------------------

async function streamGemini(
  options: LLMChatOptions,
  callbacks: StreamCallbacks,
): Promise<StreamToolCallRequest | null> {
  if (!genAI) throw new Error("Gemini client not initialized");

  const { userMessage, conversationHistory, systemPrompt, tools } = options;

  const model = genAI.getGenerativeModel({
    model: geminiModel,
    generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
  });

  const contents = toGeminiContents(conversationHistory);
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const chatSession = model.startChat({
    history: contents.slice(0, -1),
    systemInstruction: { role: "user", parts: [{ text: systemPrompt }] },
    tools: [{ functionDeclarations: tools }],
  });

  const streamResult = await chatSession.sendMessageStream(userMessage);

  let fullText = "";
  for await (const chunk of streamResult.stream) {
    const text = chunk.text();
    if (text) {
      fullText += text;
      callbacks.onToken(text);
    }
  }

  // Check for function calls in the aggregated response
  const finalResponse = await streamResult.response;
  const functionCalls = finalResponse.functionCalls();

  if (functionCalls && functionCalls.length > 0) {
    const toolCalls = functionCalls.map((fc, i) => ({
      id: `gemini_${Date.now()}_${i}`,
      name: fc.name,
      args: fc.args as Record<string, unknown>,
    }));
    for (const tc of toolCalls) {
      callbacks.onToolStart(tc.name, tc.args);
    }
    return { provider: "gemini", toolCalls };
  }

  callbacks.onDone(fullText, "gemini");
  return null;
}

async function streamGeminiToolResults(
  options: LLMChatOptions,
  toolResults: Array<{ id: string; name: string; result: unknown }>,
  callbacks: StreamCallbacks,
): Promise<StreamToolCallRequest | null> {
  if (!genAI) throw new Error("Gemini not initialized");

  const model = genAI.getGenerativeModel({
    model: geminiModel,
    generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
  });

  const contents = toGeminiContents(options.conversationHistory);
  contents.push({ role: "user", parts: [{ text: options.userMessage }] });

  const chatSession = model.startChat({
    history: contents,
    systemInstruction: {
      role: "user",
      parts: [{ text: options.systemPrompt }],
    },
    tools: [{ functionDeclarations: options.tools }],
  });

  const functionResponses: Part[] = toolResults.map((tr) => ({
    functionResponse: {
      name: tr.name,
      response: { result: tr.result },
    },
  }));

  const streamResult = await chatSession.sendMessageStream(functionResponses);

  let fullText = "";
  for await (const chunk of streamResult.stream) {
    const text = chunk.text();
    if (text) {
      fullText += text;
      callbacks.onToken(text);
    }
  }

  // Check if Gemini wants to call more tools
  const finalResponse = await streamResult.response;
  const functionCalls = finalResponse.functionCalls();

  if (functionCalls && functionCalls.length > 0) {
    const toolCalls = functionCalls.map((fc, i) => ({
      id: `gemini_${Date.now()}_${i}`,
      name: fc.name,
      args: fc.args as Record<string, unknown>,
    }));
    for (const tc of toolCalls) {
      callbacks.onToolStart(tc.name, tc.args);
    }
    return { provider: "gemini", toolCalls };
  }

  callbacks.onDone(fullText, "gemini");
  return null;
}

// ---- OpenAI ---------------------------------------------------------------

async function streamOpenAI(
  options: LLMChatOptions,
  callbacks: StreamCallbacks,
): Promise<StreamToolCallRequest | null> {
  if (!openaiClient) throw new Error("OpenAI client not initialized");

  const { userMessage, conversationHistory, systemPrompt, tools } = options;

  const messages = toOpenAIMessages(conversationHistory, systemPrompt);
  if (userMessage) {
    messages.push({ role: "user", content: userMessage });
  }

  const openaiTools = toOpenAITools(tools);

  const stream = await openaiClient.chat.completions.create({
    model: openaiModel,
    messages,
    tools: openaiTools.length > 0 ? openaiTools : undefined,
    temperature: 0.4,
    max_tokens: 500,
    stream: true,
  });

  return consumeOpenAICompatibleStream(stream, "openai", callbacks);
}

// ---- Groq -----------------------------------------------------------------

async function streamGroq(
  options: LLMChatOptions,
  callbacks: StreamCallbacks,
): Promise<StreamToolCallRequest | null> {
  if (!groqClient) throw new Error("Groq client not initialized");

  const { userMessage, conversationHistory, systemPrompt, tools } = options;

  const messages = toOpenAIMessages(conversationHistory, systemPrompt);
  if (userMessage) {
    messages.push({ role: "user", content: userMessage });
  }

  const groqTools = toOpenAITools(tools);

  const stream = await groqClient.chat.completions.create({
    model: toolConfig.model,
    messages: messages as Parameters<
      typeof groqClient.chat.completions.create
    >[0]["messages"],
    tools:
      groqTools.length > 0
        ? (groqTools as Parameters<
            typeof groqClient.chat.completions.create
          >[0]["tools"])
        : undefined,
    temperature: 0.4,
    max_tokens: 500,
    stream: true,
  });

  return consumeOpenAICompatibleStream(stream, "groq", callbacks);
}

// ---------------------------------------------------------------------------
// Shared OpenAI-compatible stream consumer
// Works for both OpenAI and Groq since Groq uses the same chunk shape.
// ---------------------------------------------------------------------------

/**
 * Tool call fragments arrive incrementally across multiple chunks.
 * We accumulate them by index, then assemble the final list once the
 * stream ends.
 */
interface ToolCallAccumulator {
  id: string;
  name: string;
  argumentChunks: string[];
}

async function consumeOpenAICompatibleStream(
  stream: AsyncIterable<{
    choices: Array<{
      delta: {
        content?: string | null;
        tool_calls?: Array<{
          index: number;
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
      finish_reason?: string | null;
    }>;
  }>,
  provider: string,
  callbacks: StreamCallbacks,
): Promise<StreamToolCallRequest | null> {
  let fullText = "";
  const toolCallMap = new Map<number, ToolCallAccumulator>();

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    if (!choice) continue;

    const delta = choice.delta;

    // Text content
    if (delta.content) {
      fullText += delta.content;
      callbacks.onToken(delta.content);
    }

    // Tool call fragments
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        let acc = toolCallMap.get(tc.index);
        if (!acc) {
          acc = { id: tc.id || "", name: "", argumentChunks: [] };
          toolCallMap.set(tc.index, acc);
        }
        if (tc.id) acc.id = tc.id;
        if (tc.function?.name) acc.name = tc.function.name;
        if (tc.function?.arguments) {
          acc.argumentChunks.push(tc.function.arguments);
        }
      }
    }
  }

  // If tool calls were detected, assemble and return them
  if (toolCallMap.size > 0) {
    const toolCalls = Array.from(toolCallMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, acc]) => {
        const rawArgs = acc.argumentChunks.join("");
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(rawArgs || "{}");
        } catch {
          console.warn(
            `[LLM-STREAM] Failed to parse tool args for ${acc.name}: ${rawArgs}`,
          );
        }
        return { id: acc.id, name: acc.name, args };
      });

    for (const tc of toolCalls) {
      callbacks.onToolStart(tc.name, tc.args);
    }

    return { provider, toolCalls };
  }

  callbacks.onDone(fullText, provider);
  return null;
}
