// Streaming Multi-Provider LLM Service
// Streams responses for low-latency voice AI

import { genAI, modelName as geminiModel } from "../gemini/client.js";
import { openaiClient, modelName as openaiModel } from "../openai/client.js";
import { groqClient, toolConfig } from "../groq/client.js";
import { voiceAgentFunctions } from "../gemini/tools.js";
import type { FunctionDeclaration, Content } from "@google/generative-ai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { ConversationMessage } from "../../types/voice.js";

// Unified stream chunk type
export interface StreamChunk {
  type: "text" | "tool_call" | "error" | "done";
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    args: Record<string, unknown>;
  };
  error?: string;
  provider?: string;
}

export interface StreamingChatOptions {
  userMessage: string;
  conversationHistory: ConversationMessage[];
  systemPrompt: string;
  tools?: FunctionDeclaration[];
}

// Provider status tracking (shared with multi-provider.ts)
type ProviderStatus = "available" | "rate_limited" | "error";
const providerStatus: Record<
  string,
  { status: ProviderStatus; until?: number }
> = {
  gemini: { status: "available" },
  openai: { status: "available" },
  groq: { status: "available" },
};

const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;
const ERROR_COOLDOWN_MS = 60 * 1000;

function isProviderAvailable(provider: string): boolean {
  const status = providerStatus[provider];
  if (!status) return false;
  if (status.status === "available") return true;
  if (status.until && Date.now() > status.until) {
    status.status = "available";
    status.until = undefined;
    return true;
  }
  return false;
}

function markProviderError(provider: string, isRateLimit = false): void {
  providerStatus[provider] = {
    status: isRateLimit ? "rate_limited" : "error",
    until:
      Date.now() + (isRateLimit ? RATE_LIMIT_COOLDOWN_MS : ERROR_COOLDOWN_MS),
  };
  console.log(
    `[STREAM] ${provider} marked ${isRateLimit ? "rate limited" : "errored"}`,
  );
}

function isProviderInitialized(provider: string): boolean {
  if (provider === "gemini") return genAI !== null;
  if (provider === "openai") return openaiClient !== null;
  if (provider === "groq") return groqClient !== null;
  return false;
}

// Log provider status at startup - call this from index.ts
let statusLogged = false;
export function logProviderStatus(): void {
  if (statusLogged) return;
  statusLogged = true;

  console.log(`[STREAM] ========== LLM Provider Status ==========`);
  console.log(
    `[STREAM]   groq:   ${groqClient ? "READY" : "NOT INITIALIZED (missing GROQ_API_KEY)"}`,
  );
  console.log(
    `[STREAM]   openai: ${openaiClient ? "READY" : "NOT INITIALIZED (missing OPENAI_API_KEY)"}`,
  );
  console.log(
    `[STREAM]   gemini: ${genAI ? "READY" : "NOT INITIALIZED (missing GEMINI_API_KEY)"}`,
  );
  console.log(`[STREAM] ============================================`);

  // Warn if only Gemini is available (slowest)
  if (!groqClient && !openaiClient && genAI) {
    console.warn(
      `[STREAM] WARNING: Only Gemini available - expect 700-1200ms latency`,
    );
    console.warn(`[STREAM] Add GROQ_API_KEY for 100-300ms latency`);
  }
}

// Convert conversation to Gemini format
function toGeminiContents(messages: ConversationMessage[]): Content[] {
  const contents: Content[] = [];
  for (const msg of messages) {
    if (msg.role === "system") continue;
    if (msg.role === "user") {
      contents.push({ role: "user", parts: [{ text: msg.content }] });
    } else if (msg.role === "assistant") {
      contents.push({ role: "model", parts: [{ text: msg.content }] });
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

/**
 * Validate and clean conversation history to prevent OpenAI format errors
 * Removes orphaned tool messages that don't have a preceding assistant message with tool_calls
 */
function validateConversationHistory(
  messages: ConversationMessage[],
): ConversationMessage[] {
  const cleaned: ConversationMessage[] = [];
  let lastAssistantHadToolCalls = false;

  for (const msg of messages) {
    if (msg.role === "assistant") {
      // Track if this assistant message has tool_calls
      lastAssistantHadToolCalls = !!(msg.toolCalls && msg.toolCalls.length > 0);
      cleaned.push(msg);
    } else if (msg.role === "tool") {
      // Only keep tool message if previous assistant had tool_calls
      if (lastAssistantHadToolCalls) {
        cleaned.push(msg);
      } else {
        console.warn(
          `[STREAM] Skipping orphaned tool message: ${msg.toolName} (no preceding tool_calls)`,
        );
      }
    } else {
      // user or system messages
      lastAssistantHadToolCalls = false; // Reset tracking
      cleaned.push(msg);
    }
  }

  return cleaned;
}

// Convert conversation to OpenAI/Groq format
function toOpenAIMessages(
  messages: ConversationMessage[],
  systemPrompt: string,
): ChatCompletionMessageParam[] {
  // First, validate and clean the conversation history
  const validatedMessages = validateConversationHistory(messages);

  const result: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];
  for (const msg of validatedMessages) {
    if (msg.role === "system") continue;
    if (msg.role === "user") {
      result.push({ role: "user", content: msg.content });
    } else if (msg.role === "assistant") {
      // If assistant message has tool_calls, include them
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        result.push({
          role: "assistant",
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args),
            },
          })),
        });
      } else {
        result.push({ role: "assistant", content: msg.content });
      }
    } else if (msg.role === "tool") {
      result.push({
        role: "tool" as const,
        tool_call_id: msg.toolCallId || "unknown",
        content: JSON.stringify(msg.toolResult || msg.content),
      });
    }
  }
  return result;
}

// Convert Gemini tools to OpenAI format
function toOpenAITools(
  geminiTools: FunctionDeclaration[],
): ChatCompletionTool[] {
  return geminiTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: convertSchema(tool.parameters),
    },
  }));
}

function convertSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") {
    return { type: "object", properties: {} };
  }
  const s = schema as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  if (s.type) result.type = String(s.type).toLowerCase();
  if (s.description) result.description = s.description;
  if (s.properties && typeof s.properties === "object") {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(s.properties)) {
      props[key] = convertSchema(value);
    }
    result.properties = props;
  }
  if (s.required && Array.isArray(s.required)) result.required = s.required;
  if (s.items) result.items = convertSchema(s.items);

  return result;
}

// Gemini streaming implementation (kept for potential future use)
// @ts-expect-error - Unused but kept for potential future fallback
async function* _streamWithGemini(
  options: StreamingChatOptions,
): AsyncGenerator<StreamChunk> {
  if (!genAI) throw new Error("Gemini not initialized");

  const { userMessage, conversationHistory, systemPrompt, tools } = options;

  const model = genAI.getGenerativeModel({
    model: geminiModel,
    generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
  });

  const contents = toGeminiContents(conversationHistory);
  const chatSession = model.startChat({
    history: contents,
    systemInstruction: { role: "user", parts: [{ text: systemPrompt }] },
    tools: tools ? [{ functionDeclarations: tools }] : undefined,
  });

  const stream = await chatSession.sendMessageStream(userMessage);

  for await (const chunk of stream.stream) {
    // Check for function calls
    const functionCalls = chunk.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      for (const fc of functionCalls) {
        yield {
          type: "tool_call",
          toolCall: {
            id: `gemini_${Date.now()}`,
            name: fc.name,
            args: fc.args as Record<string, unknown>,
          },
          provider: "gemini",
        };
      }
      continue;
    }

    // Yield text
    const text = chunk.text();
    if (text) {
      yield { type: "text", content: text, provider: "gemini" };
    }
  }

  yield { type: "done", provider: "gemini" };
}

// OpenAI streaming implementation
async function* streamWithOpenAI(
  options: StreamingChatOptions,
): AsyncGenerator<StreamChunk> {
  if (!openaiClient) throw new Error("OpenAI not initialized");

  const { userMessage, conversationHistory, systemPrompt, tools } = options;

  const messages = toOpenAIMessages(conversationHistory, systemPrompt);
  messages.push({ role: "user", content: userMessage });

  const openaiTools = tools ? toOpenAITools(tools) : undefined;

  const stream = await openaiClient.chat.completions.create({
    model: openaiModel,
    messages,
    tools: openaiTools,
    temperature: 0.3,
    max_tokens: 500,
    stream: true,
  });

  let currentToolCall: { id: string; name: string; args: string } | null = null;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;

    // Yield text content
    if (delta?.content) {
      yield { type: "text", content: delta.content, provider: "openai" };
    }

    // Accumulate tool calls
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        if (tc.function?.name) {
          currentToolCall = {
            id: tc.id || `openai_${Date.now()}`,
            name: tc.function.name,
            args: "",
          };
        }
        if (tc.function?.arguments && currentToolCall) {
          currentToolCall.args += tc.function.arguments;
        }
      }
    }

    // Yield complete tool call
    if (chunk.choices[0]?.finish_reason === "tool_calls" && currentToolCall) {
      try {
        yield {
          type: "tool_call",
          toolCall: {
            id: currentToolCall.id,
            name: currentToolCall.name,
            args: JSON.parse(currentToolCall.args || "{}"),
          },
          provider: "openai",
        };
      } catch {
        console.error("[STREAM] Failed to parse OpenAI tool args");
      }
      currentToolCall = null;
    }
  }

  yield { type: "done", provider: "openai" };
}

// Groq streaming implementation (kept for potential future use)
// @ts-expect-error - Unused but kept for potential future fallback
async function* _streamWithGroq(
  options: StreamingChatOptions,
): AsyncGenerator<StreamChunk> {
  if (!groqClient) throw new Error("Groq not initialized");

  const { userMessage, conversationHistory, systemPrompt, tools } = options;

  const messages = toOpenAIMessages(conversationHistory, systemPrompt);
  messages.push({ role: "user", content: userMessage });

  const groqTools = tools ? toOpenAITools(tools) : undefined;

  const stream = await groqClient.chat.completions.create({
    model: toolConfig.model,
    messages: messages as Parameters<
      typeof groqClient.chat.completions.create
    >[0]["messages"],
    tools: groqTools as Parameters<
      typeof groqClient.chat.completions.create
    >[0]["tools"],
    temperature: 0.4,
    max_tokens: 500,
    stream: true,
  });

  let currentToolCall: { id: string; name: string; args: string } | null = null;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;

    // Yield text content
    if (delta?.content) {
      yield { type: "text", content: delta.content, provider: "groq" };
    }

    // Accumulate tool calls
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        if (tc.function?.name) {
          currentToolCall = {
            id: tc.id || `groq_${Date.now()}`,
            name: tc.function.name,
            args: "",
          };
        }
        if (tc.function?.arguments && currentToolCall) {
          currentToolCall.args += tc.function.arguments;
        }
      }
    }

    // Yield complete tool call
    if (chunk.choices[0]?.finish_reason === "tool_calls" && currentToolCall) {
      try {
        yield {
          type: "tool_call",
          toolCall: {
            id: currentToolCall.id,
            name: currentToolCall.name,
            args: JSON.parse(currentToolCall.args || "{}"),
          },
          provider: "groq",
        };
      } catch {
        console.error("[STREAM] Failed to parse Groq tool args");
      }
      currentToolCall = null;
    }
  }

  yield { type: "done", provider: "groq" };
}

// Main streaming function with fallback
export async function* streamChatWithFallback(
  options: StreamingChatOptions,
): AsyncGenerator<StreamChunk> {
  // Default to voice agent tools if not specified
  const optionsWithTools = {
    ...options,
    tools: options.tools || voiceAgentFunctions,
  };

  // Provider: OpenAI GPT-4.1 mini ONLY (no fallback)
  // User requirement: Use only GPT, skip Groq and Gemini
  const providers = [
    { name: "openai", fn: () => streamWithOpenAI(optionsWithTools) },
  ];

  // Log provider status on first call (helps debug why certain providers are used)
  logProviderStatus();

  for (const provider of providers) {
    if (!isProviderInitialized(provider.name)) {
      console.warn(`[STREAM] SKIP ${provider.name} - not initialized`);
      continue;
    }

    if (!isProviderAvailable(provider.name)) {
      const status = providerStatus[provider.name];
      const remainingMs = status?.until ? status.until - Date.now() : 0;
      console.warn(
        `[STREAM] SKIP ${provider.name} - cooling down (${Math.ceil(remainingMs / 1000)}s remaining)`,
      );
      continue;
    }

    try {
      console.log(`[STREAM] Using ${provider.name}`);
      const stream = provider.fn();

      // Yield all chunks from this provider
      for await (const chunk of stream) {
        yield chunk;
      }

      // Success - exit
      return;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[STREAM] ${provider.name} failed: ${errMsg}`);

      const isRateLimit =
        errMsg.includes("429") ||
        errMsg.includes("rate") ||
        errMsg.includes("quota");

      markProviderError(provider.name, isRateLimit);

      // Yield error and try next provider
      yield {
        type: "error",
        error: `${provider.name} failed: ${errMsg}`,
        provider: provider.name,
      };
    }
  }

  // All providers failed
  yield {
    type: "error",
    error: "All streaming providers failed",
  };
}

// Utility: Send tool results and stream response
export async function* streamToolResults(
  _provider: string, // Preserved for future provider-preference routing
  options: StreamingChatOptions,
  toolResults: Array<{ id: string; name: string; result: unknown }>,
): AsyncGenerator<StreamChunk> {
  // Add tool results to history
  const updatedHistory = [...options.conversationHistory];
  for (const tr of toolResults) {
    updatedHistory.push({
      role: "tool",
      content:
        typeof tr.result === "string" ? tr.result : JSON.stringify(tr.result),
      toolName: tr.name,
      toolCallId: tr.id,
      toolResult:
        typeof tr.result === "string" ? tr.result : JSON.stringify(tr.result),
      timestamp: new Date(),
    });
  }

  const updatedOptions: StreamingChatOptions = {
    ...options,
    conversationHistory: updatedHistory,
    userMessage: "", // Continue from tool results
  };

  // Try the same provider first, then fallback
  yield* streamChatWithFallback(updatedOptions);
}
