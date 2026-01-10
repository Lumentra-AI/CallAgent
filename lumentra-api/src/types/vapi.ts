// Vapi Webhook Types
// Based on Vapi's webhook documentation

export interface VapiWebhookPayload {
  message?: {
    type:
      | "assistant-request"
      | "tool-calls"
      | "status-update"
      | "end-of-call-report"
      | "hang"
      | "speech-update"
      | "transcript";
    call?: VapiCall;
    customer?: VapiCustomer;
    phoneNumber?: VapiPhoneNumberConfig;
    timestamp?: string | number;
    toolCalls?: VapiToolCall[];
    toolCallList?: VapiToolCall[];
    endedReason?: string;
    transcript?: string;
    summary?: string;
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    cost?: number;
    analysis?: VapiCallAnalysis;
  };
}

export interface VapiPhoneNumberConfig {
  id: string;
  orgId: string;
  number: string;
  name?: string;
  provider?: string;
  status?: string;
  fallbackDestination?: {
    type: string;
    number: string;
  };
  server?: {
    url: string;
    timeoutSeconds?: number;
  };
}

export interface VapiCall {
  id: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
  type: "inboundPhoneCall" | "outboundPhoneCall" | "webCall";
  status: "queued" | "ringing" | "in-progress" | "forwarding" | "ended";
  endedReason?: string;
  phoneNumberId?: string;
  phoneNumber?: VapiPhoneNumber;
  customer?: VapiCustomer;
  assistantId?: string;
  squadId?: string;
}

export interface VapiPhoneNumber {
  id: string;
  number: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
}

export interface VapiCustomer {
  number?: string;
  name?: string;
  numberE164CheckEnabled?: boolean;
}

export interface VapiToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface VapiCallAnalysis {
  summary?: string;
  structuredData?: Record<string, unknown>;
  successEvaluation?: string;
}

// Assistant configuration for assistant-request response
export interface VapiAssistantConfig {
  name?: string;
  firstMessage?: string;
  firstMessageMode?: "assistant-speaks-first" | "assistant-waits-for-user";
  hipaaEnabled?: boolean;
  silenceTimeoutSeconds?: number;
  maxDurationSeconds?: number;
  backgroundSound?: "office" | "off";
  backchannelingEnabled?: boolean;
  backgroundDenoisingEnabled?: boolean;

  // Model configuration
  model?: VapiModelConfig;

  // Voice configuration (Cartesia for low latency)
  voice?: VapiVoiceConfig;

  // Transcriber configuration
  transcriber?: VapiTranscriberConfig;

  // Tools the assistant can use
  serverTools?: VapiServerTool[];
  tools?: VapiServerTool[];
}

export interface VapiModelConfig {
  provider: "openai" | "anthropic" | "together-ai" | "anyscale" | "groq";
  model: string;
  systemPrompt?: string;
  messages?: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
}

export interface VapiVoiceConfig {
  provider: "cartesia" | "openai" | "elevenlabs" | "deepgram" | "playht";
  voiceId: string;
  speed?: number;
  stability?: number;
  similarityBoost?: number;
}

export interface VapiTranscriberConfig {
  provider: "deepgram" | "gladia" | "talkscriber";
  model?: string;
  language?: string;
  keywords?: string[];
}

export interface VapiServerTool {
  type: "function";
  async?: boolean;
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, VapiToolParameter>;
      required?: string[];
    };
  };
  server?: {
    url: string;
    timeoutSeconds?: number;
  };
}

export interface VapiToolParameter {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: VapiToolParameter;
}

export interface VapiToolMessage {
  type: "request-start" | "request-complete" | "request-failed";
  content?: string;
  conditions?: Array<{
    param: string;
    value: string;
    operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte";
  }>;
}

// Tool call results
export interface VapiToolCallResult {
  results: Array<{
    toolCallId: string;
    result: string; // JSON string of the result
  }>;
}
