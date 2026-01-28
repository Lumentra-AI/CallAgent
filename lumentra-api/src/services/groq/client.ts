// Groq LLM Client Setup
// Fast inference for voice conversations

import Groq from "groq-sdk";
import type { GroqConfig } from "../../types/voice.js";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Create Groq client singleton
export const groqClient = GROQ_API_KEY
  ? new Groq({ apiKey: GROQ_API_KEY })
  : null;

// Use 70B for tools (better function calling), 8B for simple chat
const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "llama-3.1-8b-instant";
const TOOL_MODEL = process.env.GROQ_TOOL_MODEL || "llama-3.3-70b-versatile";

if (groqClient) {
  console.log(`[GROQ] Initialized - Chat: ${CHAT_MODEL}, Tool: ${TOOL_MODEL}`);
} else {
  console.error("[GROQ] NOT INITIALIZED - GROQ_API_KEY is missing or empty");
}

// Configuration for chat (no tools needed) - faster, cheaper
export const chatConfig: GroqConfig = {
  model: CHAT_MODEL,
  temperature: 0.7,
  maxTokens: 150,
  stream: false,
};

// Configuration for tool calling - more deterministic, better model
export const toolConfig: GroqConfig = {
  model: TOOL_MODEL,
  temperature: 0.1, // Lower = more deterministic tool selection
  maxTokens: 600, // More tokens for complex tool arguments
  stream: false,
};
