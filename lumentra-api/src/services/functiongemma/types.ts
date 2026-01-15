// FunctionGemma Types
// Type definitions for the FunctionGemma router

export interface FunctionGemmaConfig {
  ollamaUrl: string;
  model: string;
  timeout: number;
  maxRetries: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ToolParameter {
  type: "string" | "number" | "boolean";
  description: string;
  enum?: string[];
}

export type RouterAction =
  | "direct_tool" // Execute tool directly, skip LLM
  | "llm_required" // Need LLM for conversation/clarification
  | "template_response" // Use canned response (greetings, etc)
  | "escalate"; // Transfer to human

export interface RouterDecision {
  action: RouterAction;
  confidence: number;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  templateKey?: string;
  reason?: string;
  rawOutput?: string;
}

export interface ParsedFunctionCall {
  functionName: string;
  arguments: Record<string, unknown>;
  raw: string;
}

// Template responses for common scenarios
export const TEMPLATE_RESPONSES: Record<string, string[]> = {
  greeting: [
    "Hello! How can I help you today?",
    "Hi there! What can I assist you with?",
    "Welcome! How may I help you?",
  ],
  farewell: [
    "Thank you for calling. Have a great day!",
    "Goodbye! Feel free to call again if you need anything.",
    "Take care! We look forward to seeing you.",
  ],
  thanks: [
    "You're welcome! Is there anything else I can help with?",
    "Happy to help! Anything else you need?",
    "My pleasure! What else can I do for you?",
  ],
  affirmative: [
    "Great! Let me take care of that for you.",
    "Perfect! I'll get that done right away.",
    "Wonderful! Processing that now.",
  ],
  clarification_needed: [
    "I want to make sure I get this right. Could you tell me more about what you're looking for?",
    "Let me help you with that. What specific details do you have in mind?",
  ],
};

// Error types for the router
export class FunctionGemmaError extends Error {
  constructor(
    message: string,
    public code:
      | "CONNECTION_FAILED"
      | "PARSE_ERROR"
      | "TIMEOUT"
      | "INVALID_OUTPUT",
    public retryable: boolean = true,
  ) {
    super(message);
    this.name = "FunctionGemmaError";
  }
}
