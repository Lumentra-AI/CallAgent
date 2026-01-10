// Groq LLM Client Setup
// Fast inference with Llama models for voice conversations

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

// Configuration for chat (no tools needed)
export const chatConfig: GroqConfig = {
  model: "llama-3.1-8b-instant",
  temperature: 0.7,
  maxTokens: 150,
  stream: false,
};

// Configuration for tool calling
export const toolConfig: GroqConfig = {
  model: "llama-3-groq-8b-tool-use",
  temperature: 0.3,
  maxTokens: 500,
  stream: false,
};
