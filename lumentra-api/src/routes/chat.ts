// Chat API Routes
// Text-based chat interface for website widget
// Uses Gemini 2.5 Flash (same as voice AI)

import { Hono } from "hono";
import { cors } from "hono/cors";
import { buildSystemPrompt } from "../services/gemini/chat.js";
import { getModel, modelName } from "../services/gemini/client.js";
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
import type {
  ConversationMessage,
  ToolExecutionContext,
} from "../types/voice.js";
import type { Content, Part } from "@google/generative-ai";

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
      callSid: session_id, // Reuse for consistency
      callerPhone: visitor_info?.phone || getVisitorInfo(session_id)?.phone,
      sessionId: session_id,
    };

    // Call Gemini with tools
    const chatResponse = await chatWithGemini(
      message,
      history,
      systemPrompt,
      context,
    );

    // Save to history
    saveToHistory(session_id, message, chatResponse.text);

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
      response: chatResponse.text,
      session_id,
      tool_calls: chatResponse.toolCalls?.map((tc) => ({
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
      theme_color: "#6366f1", // Indigo - can be made configurable
    };

    return c.json(config);
  } catch (err) {
    console.error("[CHAT] Config error:", err);
    return c.json({ error: "Failed to get config" }, 500);
  }
});

// ============================================================================
// GET /api/chat/health - Health check
// ============================================================================

chatRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    model: modelName,
    sessions: getSessionCount(),
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Chat with Gemini - uses same model as voice AI
// ============================================================================

interface ChatResult {
  text: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
}

// Convert conversation history to Gemini Content format
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

async function chatWithGemini(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  systemPrompt: string,
  context: ToolExecutionContext & { sessionId: string },
): Promise<ChatResult> {
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
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: chatAgentFunctions }],
    });

    // Send the user message
    const result = await chatSession.sendMessage(userMessage);
    const response = result.response;

    // Check for function calls
    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      console.log(`[CHAT] Function calls requested: ${functionCalls.length}`);

      const toolResults: ChatResult["toolCalls"] = [];
      const functionResponses: Part[] = [];

      for (const fc of functionCalls) {
        const toolName = fc.name;
        const toolArgs = fc.args as Record<string, unknown>;

        console.log(`[CHAT] Executing tool: ${toolName}`, toolArgs);

        const toolResult = await executeChatTool(toolName, toolArgs, context);
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
    console.error("[CHAT] Gemini error:", error);
    throw error;
  }
}

export default chatRoutes;
