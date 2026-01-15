// FunctionGemma Router
// Routes user messages to appropriate handlers using FunctionGemma 270M
// Falls back to regex-based routing if FunctionGemma is unavailable

import {
  FunctionGemmaConfig,
  ToolDefinition,
  RouterDecision,
  ParsedFunctionCall,
  TEMPLATE_RESPONSES,
  FunctionGemmaError,
} from "./types.js";

// Default configuration
const DEFAULT_CONFIG: FunctionGemmaConfig = {
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  model: "functiongemma:270m",
  timeout: 5000, // 5 second timeout
  maxRetries: 2,
};

// Tool definitions for FunctionGemma
// These are converted to FunctionGemma's expected format
const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "check_availability",
    description:
      "Check available appointment slots for a specific date. Use when user asks about availability or open times.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "The date to check in YYYY-MM-DD format",
        },
        service_type: {
          type: "string",
          description: "The type of service (optional)",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "create_booking",
    description:
      "Create a new appointment booking. Use when user confirms they want to book a specific time.",
    parameters: {
      type: "object",
      properties: {
        customer_name: {
          type: "string",
          description: "Customer's full name",
        },
        customer_phone: {
          type: "string",
          description: "Customer's phone number",
        },
        date: {
          type: "string",
          description: "Booking date in YYYY-MM-DD format",
        },
        time: {
          type: "string",
          description: "Booking time in HH:MM format",
        },
        service_type: {
          type: "string",
          description: "Type of service being booked",
        },
        notes: {
          type: "string",
          description: "Additional notes",
        },
      },
      required: ["customer_name", "customer_phone", "date", "time"],
    },
  },
  {
    name: "transfer_to_human",
    description:
      "Transfer the call to a human staff member. Use ONLY when explicitly needed for complaints, refunds, or complex issues AI cannot handle.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Reason for transfer",
        },
      },
      required: ["reason"],
    },
  },
];

// Patterns for template responses (fallback)
const TEMPLATE_PATTERNS: Record<string, RegExp[]> = {
  greeting: [
    /^(hi|hello|hey|good\s*(morning|afternoon|evening))[\s!.]*$/i,
    /^(what's\s*up|sup|howdy)[\s!.]*$/i,
  ],
  farewell: [
    /^(bye|goodbye|see\s*you|take\s*care|later)[\s!.]*$/i,
    /^(that's\s*all|nothing\s*else|i'm\s*done)[\s!.]*$/i,
  ],
  thanks: [
    /^(thank\s*you|thanks|appreciate\s*it)[\s!.]*$/i,
    /^(great|perfect|awesome|wonderful)[\s,]*\s*(thanks?)?[\s!.]*$/i,
  ],
  affirmative: [/^(yes|yeah|yep|sure|ok|okay|alright)[\s!.]*$/i],
};

// Class to manage FunctionGemma router
class FunctionGemmaRouter {
  private config: FunctionGemmaConfig;
  private isAvailable: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval = 30000; // 30 seconds

  constructor(config: Partial<FunctionGemmaConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if Ollama/FunctionGemma is available
   */
  async checkHealth(): Promise<boolean> {
    const now = Date.now();

    // Use cached result if recent
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isAvailable;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.config.ollamaUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as {
          models?: Array<{ name: string }>;
        };
        // Check if functiongemma model is available
        this.isAvailable =
          data.models?.some(
            (m) => m.name.includes("functiongemma") || m.name.includes("270m"),
          ) ?? false;
      } else {
        this.isAvailable = false;
      }
    } catch {
      this.isAvailable = false;
    }

    this.lastHealthCheck = now;
    console.log(
      `[FUNCGEMMA] Health check: ${this.isAvailable ? "OK" : "UNAVAILABLE"}`,
    );
    return this.isAvailable;
  }

  /**
   * Build the prompt for FunctionGemma
   */
  private buildPrompt(userMessage: string): string {
    // FunctionGemma expects a specific format
    const toolsJson = JSON.stringify(
      TOOL_DEFINITIONS.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    );

    return `<start_of_turn>developer
You are a function calling model. Analyze the user message and call the appropriate function.
Available functions: ${toolsJson}

Rules:
- If user wants to book/schedule, check availability first
- If user confirms a booking, use create_booking
- Only use transfer_to_human for complaints, refunds, or issues you cannot handle
- If the message is just a greeting or chitchat, respond with NO_FUNCTION_NEEDED
<end_of_turn>
<start_of_turn>user
${userMessage}
<end_of_turn>
<start_of_turn>model
`;
  }

  /**
   * Parse FunctionGemma output to extract function call
   */
  private parseOutput(output: string): ParsedFunctionCall | null {
    // FunctionGemma outputs: <start_function_call>call:function_name{args}<end_function_call>
    const functionCallPattern =
      /<start_function_call>call:(\w+)\{(.*?)\}<end_function_call>/s;
    const match = output.match(functionCallPattern);

    if (!match) {
      // Check for NO_FUNCTION_NEEDED response
      if (output.includes("NO_FUNCTION_NEEDED")) {
        return null;
      }
      return null;
    }

    const [raw, functionName, argsString] = match;

    // Parse arguments - FunctionGemma uses <escape>value<escape> for strings
    const args: Record<string, unknown> = {};
    const argPattern = /(\w+):(?:<escape>(.*?)<escape>|([^,}]*))/g;
    let argMatch;

    while ((argMatch = argPattern.exec(argsString)) !== null) {
      const [, key, escapedValue, rawValue] = argMatch;
      const value = escapedValue !== undefined ? escapedValue : rawValue;

      // Try to parse as number or boolean
      if (value === "true") {
        args[key] = true;
      } else if (value === "false") {
        args[key] = false;
      } else if (!isNaN(Number(value)) && value.trim() !== "") {
        args[key] = Number(value);
      } else {
        args[key] = value;
      }
    }

    return { functionName, arguments: args, raw };
  }

  /**
   * Call FunctionGemma via Ollama API
   */
  private async callFunctionGemma(userMessage: string): Promise<string> {
    const prompt = this.buildPrompt(userMessage);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.1, // Low temperature for deterministic output
            num_predict: 256, // Limit output length
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new FunctionGemmaError(
          `Ollama returned ${response.status}`,
          "CONNECTION_FAILED",
        );
      }

      const data = (await response.json()) as { response?: string };
      return data.response || "";
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof FunctionGemmaError) {
        throw error;
      }

      if ((error as Error).name === "AbortError") {
        throw new FunctionGemmaError("Request timed out", "TIMEOUT");
      }

      throw new FunctionGemmaError(
        `Failed to call FunctionGemma: ${(error as Error).message}`,
        "CONNECTION_FAILED",
      );
    }
  }

  /**
   * Fallback regex-based routing when FunctionGemma unavailable
   */
  private regexFallbackRoute(userMessage: string): RouterDecision {
    const lowerMessage = userMessage.toLowerCase().trim();

    // Check template patterns first
    for (const [key, patterns] of Object.entries(TEMPLATE_PATTERNS)) {
      if (patterns.some((p) => p.test(userMessage))) {
        return {
          action: "template_response",
          templateKey: key,
          confidence: 0.9,
          reason: "regex_template_match",
        };
      }
    }

    // Check for booking intent
    if (/\b(book|schedule|appointment|reserve)\b/i.test(lowerMessage)) {
      // Check if we have enough info for direct booking
      const dateMatch = lowerMessage.match(
        /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[\/\-]\d{1,2})\b/i,
      );
      const timeMatch = lowerMessage.match(
        /\b(\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))\b/i,
      );

      if (dateMatch && timeMatch) {
        return {
          action: "llm_required", // Need LLM to parse exact date/time
          confidence: 0.7,
          reason: "booking_intent_detected",
        };
      }

      return {
        action: "llm_required",
        confidence: 0.6,
        reason: "booking_intent_partial",
      };
    }

    // Check for availability query
    if (
      /\b(available|availability|open|free|slot|when)\b/i.test(lowerMessage)
    ) {
      return {
        action: "llm_required",
        confidence: 0.7,
        reason: "availability_intent",
      };
    }

    // Default to LLM for ambiguous cases
    return {
      action: "llm_required",
      confidence: 0.5,
      reason: "ambiguous_fallback",
    };
  }

  /**
   * Main routing function
   */
  async route(userMessage: string): Promise<RouterDecision> {
    const startTime = Date.now();

    // Quick template check first (saves API call)
    for (const [key, patterns] of Object.entries(TEMPLATE_PATTERNS)) {
      if (patterns.some((p) => p.test(userMessage))) {
        console.log(
          `[FUNCGEMMA] Template match: ${key} (${Date.now() - startTime}ms)`,
        );
        return {
          action: "template_response",
          templateKey: key,
          confidence: 0.95,
          reason: "template_match",
        };
      }
    }

    // Check if FunctionGemma is available
    const isAvailable = await this.checkHealth();

    if (!isAvailable) {
      console.log("[FUNCGEMMA] Unavailable, using regex fallback");
      return this.regexFallbackRoute(userMessage);
    }

    // Try FunctionGemma with retries
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const output = await this.callFunctionGemma(userMessage);
        const parsed = this.parseOutput(output);

        if (!parsed) {
          // No function call needed - let LLM handle
          console.log(
            `[FUNCGEMMA] No function call (${Date.now() - startTime}ms)`,
          );
          return {
            action: "llm_required",
            confidence: 0.8,
            reason: "no_function_needed",
            rawOutput: output,
          };
        }

        // Validate tool name
        const validTools = TOOL_DEFINITIONS.map((t) => t.name);
        if (!validTools.includes(parsed.functionName)) {
          console.warn(`[FUNCGEMMA] Unknown tool: ${parsed.functionName}`);
          return {
            action: "llm_required",
            confidence: 0.5,
            reason: "unknown_tool",
            rawOutput: output,
          };
        }

        // Check if we have all required params for direct execution
        const toolDef = TOOL_DEFINITIONS.find(
          (t) => t.name === parsed.functionName,
        );
        const requiredParams = toolDef?.parameters.required || [];
        const hasAllRequired = requiredParams.every(
          (p) => parsed.arguments[p] !== undefined,
        );

        if (hasAllRequired && parsed.functionName !== "transfer_to_human") {
          console.log(
            `[FUNCGEMMA] Direct tool: ${parsed.functionName} (${Date.now() - startTime}ms)`,
          );
          return {
            action: "direct_tool",
            toolName: parsed.functionName,
            toolArgs: parsed.arguments,
            confidence: 0.9,
            reason: "complete_params",
            rawOutput: output,
          };
        }

        // Need LLM to fill in missing params or handle conversation
        console.log(
          `[FUNCGEMMA] LLM required: ${parsed.functionName} missing params (${Date.now() - startTime}ms)`,
        );
        return {
          action: "llm_required",
          toolName: parsed.functionName,
          toolArgs: parsed.arguments,
          confidence: 0.7,
          reason: "incomplete_params",
          rawOutput: output,
        };
      } catch (error) {
        console.warn(
          `[FUNCGEMMA] Attempt ${attempt + 1} failed:`,
          (error as Error).message,
        );

        // Don't retry on non-retryable errors
        if (error instanceof FunctionGemmaError && !error.retryable) {
          break;
        }
      }
    }

    // All retries failed, use regex fallback
    console.error("[FUNCGEMMA] All attempts failed, using fallback");
    return this.regexFallbackRoute(userMessage);
  }

  /**
   * Get a template response
   */
  getTemplateResponse(key: string): string {
    const responses = TEMPLATE_RESPONSES[key];
    if (!responses || responses.length === 0) {
      return "How can I help you?";
    }
    return responses[Math.floor(Math.random() * responses.length)];
  }
}

// Singleton instance
let routerInstance: FunctionGemmaRouter | null = null;

export function getFunctionGemmaRouter(): FunctionGemmaRouter {
  if (!routerInstance) {
    routerInstance = new FunctionGemmaRouter();
  }
  return routerInstance;
}

export { FunctionGemmaRouter, TOOL_DEFINITIONS };
