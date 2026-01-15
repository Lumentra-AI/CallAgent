// Fallback Chain
// Orchestrates the flow: FunctionGemma -> Llama -> Retry -> Escalate
// Handles failures gracefully with intelligent retry logic

import { getFunctionGemmaRouter } from "../functiongemma/router.js";
import { RouterDecision, TEMPLATE_RESPONSES } from "../functiongemma/types.js";
import {
  EscalationState,
  createEscalationState,
  evaluateEscalation,
  shouldEscalateOnAIFailure,
  markTaskCompleted,
} from "../escalation/escalation-manager.js";
import type {
  ConversationMessage,
  ToolExecutionContext,
} from "../../types/voice.js";

// Retry configuration
const RETRY_CONFIG = {
  maxLlmRetries: 2,
  maxTotalRetries: 3,
  clarificationPrompts: [
    "I want to make sure I understand. Could you tell me more specifically what you're looking for?",
    "Let me help you with that. What day and time were you thinking?",
    "I'd be happy to help. Can you give me a few more details?",
  ],
};

export interface ChainResult {
  text: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
  action: "response" | "escalate" | "retry";
  escalationReason?: string;
  metrics: {
    functionGemmaUsed: boolean;
    llmUsed: boolean;
    retryCount: number;
    totalLatencyMs: number;
  };
}

export interface ChainContext {
  tenantId: string;
  callSid: string;
  callerPhone?: string;
  conversationHistory: ConversationMessage[];
  systemPrompt: string;
  escalationState: EscalationState;
}

// Track retry state per call
interface RetryState {
  consecutiveFailures: number;
  lastFailureReason?: string;
  totalRetries: number;
}

const retryStates = new Map<string, RetryState>();

/**
 * Get or create retry state for a call
 */
function getRetryState(callSid: string): RetryState {
  if (!retryStates.has(callSid)) {
    retryStates.set(callSid, {
      consecutiveFailures: 0,
      totalRetries: 0,
    });
  }
  return retryStates.get(callSid)!;
}

/**
 * Clean up retry state when call ends
 */
export function cleanupRetryState(callSid: string): void {
  retryStates.delete(callSid);
}

/**
 * Get a random clarification prompt
 */
function getClarificationPrompt(): string {
  const prompts = RETRY_CONFIG.clarificationPrompts;
  return prompts[Math.floor(Math.random() * prompts.length)];
}

/**
 * Main fallback chain execution
 */
export async function executeChain(
  userMessage: string,
  context: ChainContext,
  llmChatFn: (
    message: string,
    history: ConversationMessage[],
    systemPrompt: string,
    toolContext: ToolExecutionContext,
  ) => Promise<{
    text: string;
    toolCalls?: Array<{
      name: string;
      args: Record<string, unknown>;
      result: unknown;
    }>;
  }>,
  executeToolFn: (
    toolName: string,
    args: Record<string, unknown>,
    toolContext: ToolExecutionContext,
  ) => Promise<unknown>,
): Promise<ChainResult> {
  const startTime = Date.now();
  const router = getFunctionGemmaRouter();
  const retryState = getRetryState(context.callSid);

  const metrics = {
    functionGemmaUsed: false,
    llmUsed: false,
    retryCount: retryState.totalRetries,
    totalLatencyMs: 0,
  };

  const toolContext: ToolExecutionContext = {
    tenantId: context.tenantId,
    callSid: context.callSid,
    callerPhone: context.callerPhone,
  };

  // Step 1: Check escalation first
  const escalationDecision = evaluateEscalation(
    context.escalationState,
    userMessage,
  );

  if (escalationDecision.shouldEscalate) {
    metrics.totalLatencyMs = Date.now() - startTime;
    return {
      text: escalationDecision.deflectionResponse || "Let me transfer you now.",
      action: "escalate",
      escalationReason: escalationDecision.escalationReason,
      metrics,
    };
  }

  // If we got a deflection response, return it
  if (escalationDecision.deflectionResponse) {
    metrics.totalLatencyMs = Date.now() - startTime;
    return {
      text: escalationDecision.deflectionResponse,
      action: "response",
      metrics,
    };
  }

  // Step 2: Route with FunctionGemma
  let routerDecision: RouterDecision;
  try {
    routerDecision = await router.route(userMessage);
    metrics.functionGemmaUsed = true;
  } catch (error) {
    console.error("[CHAIN] FunctionGemma failed:", error);
    // Fall back to LLM
    routerDecision = {
      action: "llm_required",
      confidence: 0.5,
      reason: "functiongemma_error",
    };
  }

  console.log(
    `[CHAIN] Router decision: ${routerDecision.action} (confidence: ${routerDecision.confidence})`,
  );

  // Step 3: Handle based on router decision
  try {
    switch (routerDecision.action) {
      case "template_response": {
        // Simple template response - no LLM needed
        const templateKey = routerDecision.templateKey || "greeting";
        const responses = TEMPLATE_RESPONSES[templateKey];
        const text =
          responses?.[Math.floor(Math.random() * responses.length)] ||
          "How can I help you?";

        // Reset failure count on success
        retryState.consecutiveFailures = 0;

        metrics.totalLatencyMs = Date.now() - startTime;
        return { text, action: "response", metrics };
      }

      case "direct_tool": {
        // Execute tool directly without LLM
        if (!routerDecision.toolName || !routerDecision.toolArgs) {
          throw new Error("Missing tool info for direct execution");
        }

        const toolResult = await executeToolFn(
          routerDecision.toolName,
          routerDecision.toolArgs,
          toolContext,
        );

        // Format response based on tool result
        const resultObj = toolResult as { message?: string; success?: boolean };
        const text = resultObj.message || "Done!";

        // Mark task completed if booking succeeded
        if (routerDecision.toolName === "create_booking" && resultObj.success) {
          markTaskCompleted(context.escalationState);
        }

        retryState.consecutiveFailures = 0;

        metrics.totalLatencyMs = Date.now() - startTime;
        return {
          text,
          toolCalls: [
            {
              name: routerDecision.toolName,
              args: routerDecision.toolArgs,
              result: toolResult,
            },
          ],
          action: "response",
          metrics,
        };
      }

      case "llm_required": {
        // Need LLM for conversation or to fill in missing params
        metrics.llmUsed = true;

        const llmResult = await llmChatFn(
          userMessage,
          context.conversationHistory,
          context.systemPrompt,
          toolContext,
        );

        // Check if booking was completed
        if (llmResult.toolCalls?.some((tc) => tc.name === "create_booking")) {
          const bookingCall = llmResult.toolCalls.find(
            (tc) => tc.name === "create_booking",
          );
          if ((bookingCall?.result as { success?: boolean })?.success) {
            markTaskCompleted(context.escalationState);
          }
        }

        retryState.consecutiveFailures = 0;

        metrics.totalLatencyMs = Date.now() - startTime;
        return {
          text: llmResult.text,
          toolCalls: llmResult.toolCalls,
          action: "response",
          metrics,
        };
      }

      case "escalate": {
        // Router decided to escalate
        metrics.totalLatencyMs = Date.now() - startTime;
        return {
          text: "Let me connect you with our team. Please hold.",
          action: "escalate",
          escalationReason: routerDecision.reason,
          metrics,
        };
      }

      default:
        throw new Error(`Unknown router action: ${routerDecision.action}`);
    }
  } catch (error) {
    console.error("[CHAIN] Execution error:", error);

    // Increment failure count
    retryState.consecutiveFailures++;
    retryState.totalRetries++;
    retryState.lastFailureReason = (error as Error).message;

    // Check if we should escalate due to AI failures
    if (
      shouldEscalateOnAIFailure(
        context.escalationState,
        retryState.consecutiveFailures,
      )
    ) {
      metrics.totalLatencyMs = Date.now() - startTime;
      return {
        text: "I'm having trouble with that request. Let me connect you with someone who can help.",
        action: "escalate",
        escalationReason: "ai_failure",
        metrics,
      };
    }

    // Still have retries - ask for clarification
    if (retryState.totalRetries < RETRY_CONFIG.maxTotalRetries) {
      metrics.totalLatencyMs = Date.now() - startTime;
      return {
        text: getClarificationPrompt(),
        action: "retry",
        metrics,
      };
    }

    // Out of retries - escalate
    metrics.totalLatencyMs = Date.now() - startTime;
    return {
      text: "I apologize, but I'm having difficulty helping you. Let me transfer you to our team.",
      action: "escalate",
      escalationReason: "max_retries_exceeded",
      metrics,
    };
  }
}

/**
 * Create a new chain context for a call
 */
export function createChainContext(
  tenantId: string,
  callSid: string,
  callerPhone: string | undefined,
  conversationHistory: ConversationMessage[],
  systemPrompt: string,
): ChainContext {
  return {
    tenantId,
    callSid,
    callerPhone,
    conversationHistory,
    systemPrompt,
    escalationState: createEscalationState(),
  };
}
