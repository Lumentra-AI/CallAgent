// Voice Pipeline Types
// Custom voice stack: SignalWire + Deepgram + Groq + Cartesia

import type { Tenant, Booking } from "./database.js";

// ============================================
// Call Session State
// ============================================

export interface CallSession {
  // Identifiers
  callSid: string;
  streamSid?: string;
  tenantId: string;
  tenant?: Tenant;

  // Caller info
  callerPhone?: string;
  callerName?: string;

  // Conversation state
  conversationHistory: ConversationMessage[];
  currentIntent?: string;
  bookingDraft?: Partial<Booking>;

  // Audio state
  isPlaying: boolean;
  isSpeaking: boolean;
  interruptRequested: boolean;

  // Timing
  startTime: Date;
  lastActivityTime: Date;

  // Connections
  deepgramConnection?: unknown;
  cartesiaConnection?: unknown;
}

export interface ConversationMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  timestamp: Date;
  toolCallId?: string;
  toolName?: string;
  toolResult?: string;
}

// ============================================
// SignalWire Media Streams
// ============================================

export interface SignalWireMediaEvent {
  event: "connected" | "start" | "media" | "stop" | "mark";
  sequenceNumber?: number;
  streamSid?: string;
  start?: SignalWireStartEvent;
  media?: SignalWireMediaPayload;
  mark?: SignalWireMarkEvent;
}

export interface SignalWireStartEvent {
  streamSid: string;
  accountSid: string;
  callSid: string;
  tracks: string[];
  customParameters: Record<string, string>;
  mediaFormat: {
    encoding: string;
    sampleRate: number;
    channels: number;
  };
}

export interface SignalWireMediaPayload {
  track: "inbound" | "outbound";
  chunk: string;
  timestamp: string;
  payload: string; // Base64 encoded audio
}

export interface SignalWireMarkEvent {
  name: string;
}

// Outbound message to SignalWire
export interface SignalWireOutboundMedia {
  event: "media" | "mark" | "clear";
  streamSid: string;
  media?: {
    payload: string; // Base64 encoded audio
  };
  mark?: {
    name: string;
  };
}

// ============================================
// Deepgram STT Types
// ============================================

export interface DeepgramConfig {
  model: "nova-2" | "nova-2-general" | "nova-2-meeting" | "nova-2-phonecall";
  language: string;
  punctuate: boolean;
  interimResults: boolean;
  utteranceEndMs: number;
  vadEvents: boolean;
  encoding: "mulaw" | "linear16";
  sampleRate: number;
  channels: number;
  endpointing: number;
}

export interface DeepgramTranscript {
  type: "Results" | "UtteranceEnd" | "SpeechStarted";
  channel_index?: [number, number];
  duration?: number;
  start?: number;
  is_final?: boolean;
  speech_final?: boolean;
  channel?: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words?: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
      }>;
    }>;
  };
}

// ============================================
// Groq LLM Types
// ============================================

export interface GroqConfig {
  model:
    | "llama-3.1-8b-instant"
    | "llama-3-groq-8b-tool-use"
    | "llama-3-groq-70b-tool-use";
  temperature: number;
  maxTokens: number;
  stream: boolean;
}

export interface GroqMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
}

export interface GroqToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface GroqTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, GroqToolParameter>;
      required?: string[];
    };
  };
}

export interface GroqToolParameter {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
}

export interface GroqResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: GroqMessage;
    finish_reason: "stop" | "tool_calls" | "length";
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================
// Cartesia TTS Types
// ============================================

export interface CartesiaConfig {
  modelId: "sonic-english" | "sonic-multilingual";
  voiceId: string;
  outputFormat: {
    container: "raw";
    encoding: "pcm_mulaw";
    sampleRate: 8000;
  };
}

export interface CartesiaStreamRequest {
  model_id: string;
  transcript: string;
  voice: {
    mode: "id";
    id: string;
  };
  output_format: {
    container: string;
    encoding: string;
    sample_rate: number;
  };
  language?: string;
}

export interface CartesiaStreamChunk {
  type: "chunk" | "timestamps" | "done";
  data?: string; // Base64 encoded audio
  step_time?: number;
  word_timestamps?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

// ============================================
// Voice Pipeline Events
// ============================================

export type VoicePipelineEvent =
  | { type: "call_started"; callSid: string; callerPhone?: string }
  | { type: "call_ended"; callSid: string; duration: number }
  | { type: "speech_started"; callSid: string }
  | { type: "speech_ended"; callSid: string }
  | { type: "transcript"; callSid: string; text: string; isFinal: boolean }
  | { type: "response_start"; callSid: string }
  | { type: "response_chunk"; callSid: string; text: string }
  | { type: "response_end"; callSid: string }
  | {
      type: "tool_call";
      callSid: string;
      name: string;
      args: Record<string, unknown>;
    }
  | { type: "tool_result"; callSid: string; name: string; result: unknown }
  | { type: "error"; callSid: string; error: string };

// ============================================
// Tool Execution Types
// ============================================

export interface ToolExecutionContext {
  tenantId: string;
  callSid: string;
  callerPhone?: string;
}

export interface CheckAvailabilityArgs {
  date: string;
  service_type?: string;
}

export interface CheckAvailabilityResult {
  available: boolean;
  slots?: string[];
  message: string;
}

export interface CreateBookingArgs {
  customer_name: string;
  customer_phone: string;
  date: string;
  time: string;
  service_type?: string;
  notes?: string;
}

export interface CreateBookingResult {
  success: boolean;
  booking_id?: string;
  confirmation_code?: string;
  message: string;
}

export interface TransferToHumanArgs {
  reason: string;
}

export interface TransferToHumanResult {
  transferred: boolean;
  message: string;
}
