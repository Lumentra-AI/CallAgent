// Gemini LLM Client Setup
// Using Gemini 2.5 Flash for voice AI with native function calling

import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("[GEMINI] Warning: GEMINI_API_KEY not set");
}

// Create Gemini client singleton
export const genAI = GEMINI_API_KEY
  ? new GoogleGenerativeAI(GEMINI_API_KEY)
  : null;

// Model configuration
// Gemini 2.5 Flash: Good balance of speed (503ms TTFT) and intelligence (score 53)
// - Native function calling
// - 1M token context
// - Better at handling off-script conversations than Flash-Lite
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

console.log(`[GEMINI] Model: ${MODEL_NAME}`);

// Get the generative model with function calling capabilities
export function getModel() {
  if (!genAI) {
    throw new Error("Gemini client not initialized - missing API key");
  }

  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.4, // Balanced for conversation + tool calling
      maxOutputTokens: 500,
      // Disable thinking for lower latency in voice AI
      // thinkingConfig: { thinkingBudget: 0 },
    },
  });
}

// Export model name for logging
export const modelName = MODEL_NAME;
