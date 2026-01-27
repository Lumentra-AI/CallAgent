// Deepgram Client Setup
// Real-time speech-to-text using Nova-2

import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import type { DeepgramConfig, DeepgramTranscript } from "../../types/voice.js";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

if (!DEEPGRAM_API_KEY) {
  console.warn("[DEEPGRAM] Warning: DEEPGRAM_API_KEY not set");
}

// Create Deepgram client singleton
export const deepgramClient = DEEPGRAM_API_KEY
  ? createClient(DEEPGRAM_API_KEY)
  : null;

// Default configuration for phone calls
export const defaultDeepgramConfig: DeepgramConfig = {
  model: "nova-2-phonecall",
  language: "en-US",
  punctuate: true,
  interimResults: true,
  utteranceEndMs: 500, // Detect end of speech faster
  vadEvents: true,
  encoding: "mulaw",
  sampleRate: 8000,
  channels: 1,
  endpointing: 200, // Smart sentence-end detection (200ms)
};

export { LiveTranscriptionEvents };
export type { DeepgramTranscript };
