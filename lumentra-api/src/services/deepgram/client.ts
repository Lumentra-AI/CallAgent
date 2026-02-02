// Deepgram Client Setup
// Real-time speech-to-text using Nova-2

import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import type { DeepgramConfig, DeepgramTranscript } from "../../types/voice.js";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

if (!DEEPGRAM_API_KEY) {
  console.error("[DEEPGRAM] CRITICAL: DEEPGRAM_API_KEY not set - STT will not work");
}

// Validate API key format (should be 40 char hex or longer for newer keys)
function validateApiKey(key: string): boolean {
  if (!key || key.length < 32) {
    console.error("[DEEPGRAM] API key appears invalid (too short)");
    return false;
  }
  return true;
}

// Create Deepgram client singleton
export const deepgramClient = DEEPGRAM_API_KEY && validateApiKey(DEEPGRAM_API_KEY)
  ? createClient(DEEPGRAM_API_KEY)
  : null;

// Verify API key by making a test request
export async function verifyDeepgramApiKey(): Promise<{ valid: boolean; error?: string }> {
  if (!DEEPGRAM_API_KEY) {
    return { valid: false, error: "DEEPGRAM_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.deepgram.com/v1/projects", {
      method: "GET",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401 || response.status === 403) {
      const body = await response.text();
      console.error("[DEEPGRAM] API key validation failed:", response.status, body);
      return { valid: false, error: `Invalid API key (HTTP ${response.status})` };
    }

    if (!response.ok) {
      return { valid: false, error: `API error: HTTP ${response.status}` };
    }

    console.log("[DEEPGRAM] API key verified successfully");
    return { valid: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[DEEPGRAM] API key verification network error:", msg);
    return { valid: false, error: `Network error: ${msg}` };
  }
}

// Default configuration for phone calls - OPTIMIZED FOR LOW LATENCY
export const defaultDeepgramConfig: DeepgramConfig = {
  model: "nova-2-phonecall",
  language: "en-US",
  punctuate: true,
  interimResults: true,
  utteranceEndMs: 1000, // Minimum allowed value (Deepgram rejects <1000)
  vadEvents: true,
  encoding: "mulaw", // Standard telephony codec
  sampleRate: 8000, // 8kHz - standard for phone calls
  channels: 1,
  endpointing: 500, // Silence detection - 500ms balances responsiveness vs cutting off speech
};

export { LiveTranscriptionEvents };
export type { DeepgramTranscript };
