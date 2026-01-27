// Chat API Routes
// Text-based chat interface for website widget
// Multi-provider fallback: Gemini -> GPT -> Groq

import { Hono } from "hono";
import { cors } from "hono/cors";
import { buildSystemPrompt } from "../services/gemini/chat.js";
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
  type VisitorInfo,
} from "../services/chat/conversation-store.js";
import { getTenantById } from "../services/database/tenant-cache.js";
import { findOrCreateByPhone } from "../services/contacts/contact-service.js";
import type { ToolExecutionContext } from "../types/voice.js";
import {
  chatWithFallback,
  sendToolResults,
  getProviderStatus,
  type LLMResponse,
} from "../services/llm/multi-provider.js";

export const chatRoutes = new Hono();

// CORS for widget - allow all origins for embedding
chatRoutes.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-Tenant-ID"],
  }),
);

// ============================================================================
// POST /api/chat - Send a message
// ============================================================================

interface ChatRequest {
  tenant_id: string;
  session_id: string;
  message: string;
  visitor_info?: VisitorInfo;
}

interface ChatResponse {
  response: string;
  session_id: string;
  provider?: string;
  tool_calls?: Array<{
    name: string;
    result: unknown;
  }>;
}

chatRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json<ChatRequest>();
    const { tenant_id, session_id, message, visitor_info } = body;

    if (!tenant_id) {
      return c.json({ error: "tenant_id is required" }, 400);
    }
    if (!session_id) {
      return c.json({ error: "session_id is required" }, 400);
    }
    if (!message || !message.trim()) {
      return c.json({ error: "message is required" }, 400);
    }

    // Get tenant configuration
    const tenant = await getTenantById(tenant_id);
    if (!tenant) {
      return c.json({ error: "Invalid tenant" }, 404);
    }

    // Get or create session (ensures session exists for history operations)
    getOrCreateSession(session_id, tenant_id);

    // Update visitor info if provided
    if (visitor_info) {
      updateVisitorInfo(session_id, visitor_info);
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(
      tenant.agent_name || "Assistant",
      tenant.business_name,
      tenant.industry,
      tenant.agent_personality || {
        tone: "friendly",
        verbosity: "balanced",
        empathy: "medium",
      },
    );

    // Get conversation history
    const history = getConversationHistory(session_id);

    // Build context for tool execution
    const context: ToolExecutionContext & { sessionId: string } = {
      tenantId: tenant_id,
      callSid: session_id,
      callerPhone: visitor_info?.phone || getVisitorInfo(session_id)?.phone,
      sessionId: session_id,
    };

    // Chat with multi-provider fallback
    const chatResult = await chatWithMultiProvider(
      message,
      history,
      systemPrompt,
      context,
    );

    // Save to history
    saveToHistory(session_id, message, chatResult.text);

    // Create/update contact if we have contact info
    const currentVisitor = getVisitorInfo(session_id);
    if (currentVisitor?.phone || currentVisitor?.email) {
      try {
        await findOrCreateByPhone(
          tenant_id,
          currentVisitor.phone || currentVisitor.email || "",
          {
            name: currentVisitor.name,
            email: currentVisitor.email,
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

    return c.json(response);
  } catch (err) {
    console.error("[CHAT] Error:", err);
    return c.json(
      {
        error: "Chat error",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      500,
    );
  }
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
}

chatRoutes.get("/config/:tenant_id", async (c) => {
  try {
    const tenantId = c.req.param("tenant_id");

    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return c.json({ error: "Tenant not found" }, 404);
    }

    const config: WidgetConfig = {
      agent_name: tenant.agent_name || "Assistant",
      business_name: tenant.business_name,
      greeting:
        tenant.greeting_standard
          ?.replace(/{businessName}/g, tenant.business_name)
          .replace(/{agentName}/g, tenant.agent_name || "Assistant") ||
        `Hi! I'm ${tenant.agent_name || "here"} to help you with ${tenant.business_name}. How can I assist you today?`,
      industry: tenant.industry,
      theme_color: "#6366f1",
    };

    return c.json(config);
  } catch (err) {
    console.error("[CHAT] Config error:", err);
    return c.json({ error: "Failed to get config" }, 500);
  }
});

// ============================================================================
// GET /api/chat/health - Health check with provider status
// ============================================================================

chatRoutes.get("/health", (c) => {
  const providers = getProviderStatus();
  return c.json({
    status: "ok",
    providers,
    sessions: getSessionCount(),
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

  const options = {
    userMessage,
    conversationHistory,
    systemPrompt,
    tools: chatAgentFunctions,
  };

  // First call - may return tool calls
  let response: LLMResponse = await chatWithFallback(options);

  console.log(`[CHAT] Response from ${response.provider}`);

  // Handle tool calls if present
  if (response.toolCalls && response.toolCalls.length > 0) {
    console.log(`[CHAT] Executing ${response.toolCalls.length} tool calls`);

    const toolResults: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
      result: unknown;
    }> = [];

    for (const tc of response.toolCalls) {
      console.log(`[CHAT] Executing tool: ${tc.name}`, tc.args);

      const result = await executeChatTool(tc.name, tc.args, context);
      toolResults.push({
        id: tc.id,
        name: tc.name,
        args: tc.args,
        result,
      });
    }

    // Send tool results back to get final response
    const finalResponse = await sendToolResults(
      response.provider,
      options,
      toolResults,
    );

    return {
      text: finalResponse.text,
      provider: finalResponse.provider,
      toolCalls: toolResults,
    };
  }

  // No tool calls, return text response
  return {
    text: response.text,
    provider: response.provider,
  };
}

export default chatRoutes;
