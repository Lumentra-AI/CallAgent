// Chat API Routes
// Text-based chat interface for website widget
// Multi-provider fallback: Gemini -> GPT -> Groq

import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { buildChatSystemPrompt } from "../services/gemini/chat.js";
import {
  chatAgentFunctions,
  executeChatTool,
} from "../services/chat/chat-tools.js";
import {
  getOrCreateSession,
  getConversationHistory,
  saveToHistory,
  updateVisitorInfo,
  getVisitorInfo,
  getSessionCount,
} from "../services/chat/conversation-store.js";
import { getTenantById } from "../services/database/tenant-cache.js";
import { findOrCreateByPhone } from "../services/contacts/contact-service.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { logActivity } from "../services/audit/logger.js";
import type { ToolExecutionContext } from "../types/voice.js";
import {
  resolveFeatures,
  ALL_FEATURES,
} from "../services/features/feature-resolver.js";
import {
  chatWithFallback,
  sendToolResults,
  getProviderStatus,
  type LLMResponse,
} from "../services/llm/multi-provider.js";
import {
  chatWithFallbackStream,
  sendToolResultsStream,
  type StreamCallbacks,
} from "../services/llm/stream-provider.js";
import { queryAll } from "../services/database/client.js";

export const chatRoutes = new Hono();

// CORS for embeddable widget - wildcard is intentional since the chat widget
// is embedded on customer websites across different domains.
// Configure CHAT_ALLOWED_ORIGINS to restrict if needed.
chatRoutes.use(
  "/*",
  cors({
    origin: (origin) => {
      const allowedOrigins = process.env.CHAT_ALLOWED_ORIGINS;
      if (!allowedOrigins) return origin; // Allow all for embeddable widget
      const allowed = allowedOrigins.split(",").map((o) => o.trim());
      return allowed.includes(origin || "") ? origin : allowed[0];
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-Tenant-ID"],
  }),
);

// Rate limit chat message endpoint: 60 messages/min per IP
chatRoutes.use(
  "/",
  rateLimit({
    windowMs: 60000,
    max: 60,
    message: "Too many messages. Please wait a moment before sending more.",
  }),
);

// ============================================================================
// POST /api/chat - Send a message
// ============================================================================

// Lumentra marketing site system prompt
const LUMENTRA_MARKETING_PROMPT = `You are the Lumentra AI assistant on the Lumentra website. Your job is to help potential customers understand Lumentra's AI voice and chat agent platform.

## About Lumentra
Lumentra is an AI-powered voice and chat platform that helps businesses automate customer interactions. Key features:

1. **AI Voice Agents**: Handle phone calls 24/7 with natural-sounding AI that can:
   - Answer questions about your business
   - Book appointments and manage calendars
   - Transfer to humans when needed
   - Integrate with your CRM and booking systems

2. **Chat Widgets**: Embeddable chat for websites that:
   - Answers FAQs instantly
   - Captures leads and contact info
   - Provides consistent customer service
   - Works across industries (healthcare, hospitality, services, etc.)

3. **Multi-Provider Reliability**: Uses Gemini, OpenAI, and Groq with automatic fallback for 99.9% uptime

4. **Easy Setup**: Get started in minutes with our dashboard - no coding required

## Your Role
- Explain how Lumentra works and its benefits
- Answer questions about features, pricing, and integration
- Offer to schedule a demo or connect with sales
- Be enthusiastic about helping businesses automate their customer service
- If asked to demonstrate, suggest clicking the demo buttons or trying the call feature

## Tone
Be friendly, professional, and helpful. You're representing Lumentra as a cutting-edge AI platform, so be knowledgeable and confident.

Keep responses conversational and concise - this is a chat widget, not a documentation page.`;

interface ChatResponse {
  response: string;
  session_id: string;
  provider?: string;
  tool_calls?: Array<{
    name: string;
    result: unknown;
  }>;
}

// Zod schema for chat request validation
const chatRequestSchema = z.object({
  tenant_id: z.string().uuid("Invalid tenant_id format"),
  session_id: z.string().min(1).max(256),
  message: z
    .string()
    .min(1, "message is required")
    .max(10000, "Message too long"),
  visitor_info: z
    .object({
      name: z.string().max(256).optional(),
      email: z.string().email().max(256).optional(),
      phone: z.string().max(50).optional(),
    })
    .optional(),
  marketing_mode: z.boolean().optional(),
  source_url: z.string().max(2048).optional(),
  timezone: z.string().max(100).optional(),
});

chatRoutes.post("/", async (c) => {
  try {
    const rawBody = await c.req.json();
    const parsed = chatRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Invalid request";
      return c.json({ error: firstError }, 400);
    }

    const {
      tenant_id,
      session_id,
      message,
      visitor_info,
      marketing_mode,
      source_url,
      timezone,
    } = parsed.data;

    // Restrict marketing_mode to Lumentra's own tenant
    const lumentraTenantId = process.env.LUMENTRA_TENANT_ID;
    if (marketing_mode && tenant_id !== lumentraTenantId) {
      return c.json({ error: "Unauthorized marketing mode" }, 403);
    }

    // Get tenant configuration
    const tenant = await getTenantById(tenant_id);
    if (!tenant) {
      return c.json({ error: "Invalid tenant" }, 404);
    }

    // Check if chat widget is enabled (skip for marketing mode)
    if (!marketing_mode && !tenant.chat_widget_enabled) {
      return c.json({ error: "Chat widget is not enabled" }, 403);
    }

    // Per-tenant origin enforcement
    const chatConfig = tenant.chat_config || {};
    const allowedOrigins = chatConfig.allowed_origins;
    if (
      !marketing_mode &&
      allowedOrigins &&
      Array.isArray(allowedOrigins) &&
      allowedOrigins.length > 0
    ) {
      const requestOrigin = c.req.header("origin") || "";
      if (!allowedOrigins.includes(requestOrigin)) {
        return c.json({ error: "Origin not allowed" }, 403);
      }
    }

    // Get or create session (persisted to DB)
    await getOrCreateSession(session_id, tenant_id, source_url);

    // Update visitor info if provided
    if (visitor_info) {
      await updateVisitorInfo(session_id, visitor_info);
    }

    // Resolve features and determine which are disabled
    const tenantFeatures = await resolveFeatures(
      tenant.subscription_tier || "starter",
      tenant_id,
    );
    const disabledFeatures = ALL_FEATURES.filter((f) => !tenantFeatures.has(f));

    // Build system prompt - use Lumentra marketing prompt if in marketing mode
    // Cast to access extended columns (SELECT * includes all columns)
    const t = tenant as unknown as Record<string, unknown>;
    const systemPrompt = marketing_mode
      ? LUMENTRA_MARKETING_PROMPT
      : buildChatSystemPrompt(
          tenant.agent_name || "Assistant",
          tenant.business_name,
          tenant.industry,
          tenant.agent_personality || {
            tone: "friendly",
            verbosity: "balanced",
            empathy: "medium",
          },
          {
            timezone,
            disabledFeatures,
            operatingHours: tenant.operating_hours || undefined,
            locationAddress: (t.location_address as string) || undefined,
            locationCity: (t.location_city as string) || undefined,
            customInstructions: (t.custom_instructions as string) || undefined,
          },
        );

    // Inject knowledge base Q&A into system prompt
    let finalPrompt = systemPrompt;
    try {
      const kbItems = await queryAll<{ question: string; answer: string }>(
        `SELECT question, answer FROM knowledge_base
         WHERE tenant_id = $1 AND is_active = true
         ORDER BY sort_order ASC LIMIT 20`,
        [tenant_id],
      );
      if (kbItems.length > 0) {
        finalPrompt += "\n\n## Business Knowledge Base\n";
        for (const item of kbItems) {
          finalPrompt += `Q: ${item.question}\nA: ${item.answer}\n\n`;
        }
      }
    } catch {
      // Knowledge base table may not exist yet -- non-fatal
    }

    // Get conversation history
    const history = await getConversationHistory(session_id);

    // Build context for tool execution
    const currentVisitorInfo = await getVisitorInfo(session_id);
    const context: ToolExecutionContext & { sessionId: string } = {
      tenantId: tenant_id,
      callSid: session_id,
      callerPhone: visitor_info?.phone || currentVisitorInfo?.phone,
      sessionId: session_id,
      disabledFeatures,
    };

    // Chat with multi-provider fallback
    const chatResult = await chatWithMultiProvider(
      message,
      history,
      finalPrompt,
      context,
    );

    // Save to history (skip empty assistant responses)
    if (chatResult.text) {
      await saveToHistory(session_id, message, chatResult.text);
    }

    // Create/update contact if we have contact info
    const latestVisitor = await getVisitorInfo(session_id);
    if (latestVisitor?.phone || latestVisitor?.email) {
      try {
        await findOrCreateByPhone(
          tenant_id,
          latestVisitor.phone || latestVisitor.email || "",
          {
            name: latestVisitor.name,
            email: latestVisitor.email,
            source: "web",
          },
        );
      } catch (err) {
        console.warn("[CHAT] Failed to create/update contact:", err);
      }
    }

    const response: ChatResponse = {
      response: chatResult.text,
      session_id,
      provider: chatResult.provider,
      tool_calls: chatResult.toolCalls?.map((tc) => ({
        name: tc.name,
        result: tc.result,
      })),
    };

    await logActivity({
      tenantId: tenant_id,
      userId: null,
      action: "create",
      resourceType: "chat_message",
      resourceId: session_id,
      newValues: { message, provider: chatResult.provider },
    });

    return c.json(response);
  } catch (err) {
    console.error("[CHAT] Error:", err);
    return c.json(
      {
        error: "Chat error",
        message:
          process.env.NODE_ENV === "development" && err instanceof Error
            ? err.message
            : "An unexpected error occurred",
      },
      500,
    );
  }
});

// ============================================================================
// POST /api/chat/stream - SSE streaming chat endpoint
// ============================================================================

chatRoutes.post("/stream", async (c) => {
  const rawBody = await c.req.json();
  const parsed = chatRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Invalid request";
    return c.json({ error: firstError }, 400);
  }

  const {
    tenant_id,
    session_id,
    message,
    visitor_info,
    marketing_mode,
    source_url,
    timezone,
  } = parsed.data;

  // Restrict marketing_mode to Lumentra's own tenant
  const lumentraTenantId = process.env.LUMENTRA_TENANT_ID;
  if (marketing_mode && tenant_id !== lumentraTenantId) {
    return c.json({ error: "Unauthorized marketing mode" }, 403);
  }

  const tenant = await getTenantById(tenant_id);
  if (!tenant) {
    return c.json({ error: "Invalid tenant" }, 404);
  }

  if (!marketing_mode && !tenant.chat_widget_enabled) {
    return c.json({ error: "Chat widget is not enabled" }, 403);
  }

  // Per-tenant origin enforcement
  const chatCfg = tenant.chat_config || {};
  const allowedOrig = chatCfg.allowed_origins;
  if (
    !marketing_mode &&
    allowedOrig &&
    Array.isArray(allowedOrig) &&
    allowedOrig.length > 0
  ) {
    const requestOrigin = c.req.header("origin") || "";
    if (!allowedOrig.includes(requestOrigin)) {
      return c.json({ error: "Origin not allowed" }, 403);
    }
  }

  await getOrCreateSession(session_id, tenant_id, source_url);
  if (visitor_info) {
    await updateVisitorInfo(session_id, visitor_info);
  }

  const tenantFeatures = await resolveFeatures(
    tenant.subscription_tier || "starter",
    tenant_id,
  );
  const disabledFeatures = ALL_FEATURES.filter((f) => !tenantFeatures.has(f));

  const t = tenant as unknown as Record<string, unknown>;
  const systemPrompt = marketing_mode
    ? LUMENTRA_MARKETING_PROMPT
    : buildChatSystemPrompt(
        tenant.agent_name || "Assistant",
        tenant.business_name,
        tenant.industry,
        tenant.agent_personality || {
          tone: "friendly",
          verbosity: "balanced",
          empathy: "medium",
        },
        {
          timezone,
          disabledFeatures,
          operatingHours: tenant.operating_hours || undefined,
          locationAddress: (t.location_address as string) || undefined,
          locationCity: (t.location_city as string) || undefined,
          customInstructions: (t.custom_instructions as string) || undefined,
        },
      );

  // Inject knowledge base Q&A into system prompt
  let finalPrompt = systemPrompt;
  try {
    const kbItems = await queryAll<{ question: string; answer: string }>(
      `SELECT question, answer FROM knowledge_base
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY sort_order ASC LIMIT 20`,
      [tenant_id],
    );
    if (kbItems.length > 0) {
      finalPrompt += "\n\n## Business Knowledge Base\n";
      for (const item of kbItems) {
        finalPrompt += `Q: ${item.question}\nA: ${item.answer}\n\n`;
      }
    }
  } catch {
    // Knowledge base table may not exist yet -- non-fatal
  }

  const history = await getConversationHistory(session_id);

  const currentVisitorInfo = await getVisitorInfo(session_id);
  const context: ToolExecutionContext & { sessionId: string } = {
    tenantId: tenant_id,
    callSid: session_id,
    callerPhone: visitor_info?.phone || currentVisitorInfo?.phone,
    sessionId: session_id,
    disabledFeatures,
  };

  // Return SSE stream
  return c.newResponse(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        };

        let fullText = "";
        let usedProvider = "";

        const callbacks: StreamCallbacks = {
          onToken(text) {
            fullText += text;
            send("token", { text });
          },
          onToolStart(tool, args) {
            send("tool_start", { tool, args });
          },
          onToolResult(tool, result) {
            send("tool_result", { tool, result });
          },
          onDone(finalText, provider) {
            fullText = finalText;
            usedProvider = provider;
          },
          onError(msg) {
            send("error", { message: msg });
          },
        };

        try {
          const options = {
            userMessage: message,
            conversationHistory: history,
            systemPrompt: finalPrompt,
            tools: chatAgentFunctions,
          };

          let toolRequest = await chatWithFallbackStream(options, callbacks);

          // Multi-round tool execution (up to 3 rounds, matching non-streaming)
          let round = 0;
          while (toolRequest && toolRequest.toolCalls.length > 0 && round < 3) {
            round++;
            const toolResults: Array<{
              id: string;
              name: string;
              result: unknown;
            }> = [];

            for (const tc of toolRequest.toolCalls) {
              // onToolStart already sent by stream provider
              const result = await executeChatTool(tc.name, tc.args, context);
              callbacks.onToolResult(tc.name, result);
              toolResults.push({
                id: tc.id,
                name: tc.name,
                result,
              });
            }

            // Stream the post-tool response (may return more tool calls)
            fullText = "";
            toolRequest = await sendToolResultsStream(
              toolRequest.provider,
              options,
              toolResults,
              callbacks,
            );
          }

          // Save to history
          if (fullText) {
            await saveToHistory(session_id, message, fullText);
          }

          // CRM contact upsert
          const latestVisitor = await getVisitorInfo(session_id);
          if (latestVisitor?.phone || latestVisitor?.email) {
            try {
              await findOrCreateByPhone(
                tenant_id,
                latestVisitor.phone || latestVisitor.email || "",
                {
                  name: latestVisitor.name,
                  email: latestVisitor.email,
                  source: "web",
                },
              );
            } catch {
              // non-fatal
            }
          }

          send("done", {
            session_id,
            provider: usedProvider,
            full_response: fullText,
          });
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "An unexpected error occurred";
          send("error", { message: msg });
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    },
  );
});

// ============================================================================
// GET /api/chat/config/:tenant_id - Get widget configuration
// ============================================================================

interface WidgetConfig {
  agent_name: string;
  business_name: string;
  greeting: string;
  industry: string;
  theme_color: string;
  position: string;
  logo_url: string | null;
  contact_collection: string;
}

chatRoutes.get("/config/:tenant_id", async (c) => {
  try {
    const tenantId = c.req.param("tenant_id");

    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return c.json({ error: "Tenant not found" }, 404);
    }

    // Return 404 if widget is disabled -- widget silently exits
    if (!tenant.chat_widget_enabled) {
      return c.json({ error: "Chat widget not enabled" }, 404);
    }

    const chatConfig = tenant.chat_config || {};

    const config: WidgetConfig = {
      agent_name: tenant.agent_name || "Assistant",
      business_name: tenant.business_name,
      greeting:
        chatConfig.greeting ||
        tenant.greeting_standard
          ?.replace(/{businessName}/g, tenant.business_name)
          .replace(/{agentName}/g, tenant.agent_name || "Assistant") ||
        `Hi! I'm ${tenant.agent_name || "here"} to help you with ${tenant.business_name}. How can I assist you today?`,
      industry: tenant.industry,
      theme_color: chatConfig.theme_color || "#6366f1",
      position: chatConfig.position || "bottom-right",
      logo_url: chatConfig.logo_url || null,
      contact_collection: chatConfig.contact_collection || "soft",
    };

    return c.json(config);
  } catch (err) {
    console.error("[CHAT] Config error:", err);
    return c.json({ error: "Failed to get config" }, 500);
  }
});

// ============================================================================
// GET /api/chat/history/:session_id - Restore chat history for widget
// ============================================================================

chatRoutes.get("/history/:session_id", async (c) => {
  try {
    const sessionId = c.req.param("session_id");
    const tenantId = c.req.query("tenant_id");
    if (!sessionId || sessionId.length > 256) {
      return c.json({ error: "Invalid session" }, 400);
    }
    if (!tenantId || tenantId.length > 256) {
      return c.json({ error: "tenant_id required" }, 400);
    }

    const messages = await getConversationHistory(sessionId, tenantId);
    return c.json({ messages });
  } catch (err) {
    console.error("[CHAT] History error:", err);
    return c.json({ messages: [] });
  }
});

// ============================================================================
// GET /api/chat/health - Health check with provider status
// ============================================================================

chatRoutes.get("/health", async (c) => {
  const providers = getProviderStatus();
  const sessions = await getSessionCount();
  return c.json({
    status: "ok",
    providers,
    sessions,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Chat with multi-provider fallback and tool execution
// ============================================================================

interface ChatResult {
  text: string;
  provider: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
}

async function chatWithMultiProvider(
  userMessage: string,
  conversationHistory: Parameters<
    typeof chatWithFallback
  >[0]["conversationHistory"],
  systemPrompt: string,
  context: ToolExecutionContext & { sessionId: string },
): Promise<ChatResult> {
  console.log(`[CHAT] Processing message with multi-provider fallback`);

  let options = {
    userMessage,
    conversationHistory,
    systemPrompt,
    tools: chatAgentFunctions,
  };

  // First call - may return tool calls
  let response: LLMResponse = await chatWithFallback(options);
  console.log(`[CHAT] Response from ${response.provider}`);

  const allToolResults: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }> = [];

  // Loop to handle multi-round tool calls (max 3 rounds)
  let round = 0;
  while (response.toolCalls && response.toolCalls.length > 0 && round < 3) {
    round++;
    console.log(
      `[CHAT] Tool round ${round}: executing ${response.toolCalls.length} tool calls`,
    );

    const roundResults: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
      result: unknown;
    }> = [];

    for (const tc of response.toolCalls) {
      console.log(`[CHAT] Executing tool: ${tc.name}`, tc.args);
      const result = await executeChatTool(tc.name, tc.args, context);
      roundResults.push({ id: tc.id, name: tc.name, args: tc.args, result });
      allToolResults.push({ name: tc.name, args: tc.args, result });
    }

    // Send tool results back -- may return more tool calls
    response = await sendToolResults(response.provider, options, roundResults);

    // Update options history for next round if needed
    if (response.toolCalls && response.toolCalls.length > 0) {
      options = {
        ...options,
        conversationHistory: [
          ...options.conversationHistory,
          {
            role: "assistant" as const,
            content: "",
            timestamp: new Date(),
            toolCalls: roundResults.map((r) => ({
              id: r.id,
              name: r.name,
              args: r.args,
            })),
          },
          ...roundResults.map((r) => ({
            role: "tool" as const,
            content:
              typeof r.result === "string"
                ? r.result
                : JSON.stringify(r.result),
            toolName: r.name,
            toolCallId: r.id,
            toolResult:
              typeof r.result === "string"
                ? r.result
                : JSON.stringify(r.result),
            timestamp: new Date(),
          })),
        ],
      };
    }
  }

  if (allToolResults.length > 0) {
    return {
      text: response.text,
      provider: response.provider,
      toolCalls: allToolResults,
    };
  }

  return {
    text: response.text,
    provider: response.provider,
  };
}

export default chatRoutes;
