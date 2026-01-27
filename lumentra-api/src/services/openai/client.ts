// OpenAI Client Setup
// GPT-4o mini for reliable fallback

import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn("[OPENAI] Warning: OPENAI_API_KEY not set");
}

// Create OpenAI client singleton
export const openaiClient = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

// Model configuration
// GPT-4o mini: Fast, cheap, good function calling
const MODEL_NAME = process.env.OPENAI_MODEL || "gpt-4o-mini";

console.log(`[OPENAI] Model: ${MODEL_NAME}`);

export const modelName = MODEL_NAME;
