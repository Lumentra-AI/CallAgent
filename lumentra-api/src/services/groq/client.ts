// Groq LLM Client Setup
// Fast inference for voice conversations

import Groq from "groq-sdk";
import type { GroqConfig } from "../../types/voice.js";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.warn("[GROQ] Warning: GROQ_API_KEY not set");
}

// Create Groq client singleton
export const groqClient = GROQ_API_KEY
  ? new Groq({ apiKey: GROQ_API_KEY })
  : null;

// Model options for Groq inference
// Groq is an INFERENCE platform - cannot fine-tune models directly
// To use a fine-tuned model: fine-tune elsewhere (Together AI, Modal) then switch provider
//
// Available models (Jan 2026):
// 1. llama-3.1-8b-instant    - $0.05/$0.08, 840 TPS (fast, weak tool calling)
// 2. llama-3.3-70b-versatile - $0.59/$0.79, 275 TPS (best for function calling)
// 3. llama-3.1-70b-versatile - $0.59/$0.79, similar quality
// 4. qwen-qwq-32b            - $0.29/$0.39, good reasoning
// 5. deepseek-r1-distill-llama-70b - $0.75/$0.99, strong reasoning

// Use 70B for tools (better function calling), 8B for simple chat
const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "llama-3.1-8b-instant";
const TOOL_MODEL = process.env.GROQ_TOOL_MODEL || "llama-3.3-70b-versatile";

console.log(`[GROQ] Chat model: ${CHAT_MODEL}, Tool model: ${TOOL_MODEL}`);

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
