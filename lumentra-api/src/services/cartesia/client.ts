// Cartesia TTS Client Setup
// Ultra-low latency text-to-speech (40ms)

import type { CartesiaConfig } from "../../types/voice.js";

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;

if (!CARTESIA_API_KEY) {
  console.warn("[CARTESIA] Warning: CARTESIA_API_KEY not set");
}

export const cartesiaApiKey = CARTESIA_API_KEY;

// Default voice IDs from Cartesia
export const cartesiaVoices = {
  // Female voices
  hannah: "248be419-c632-4f23-adf1-5324ed7dbf1d", // Warm, professional
  sarah: "a0e99841-438c-4a64-b679-ae501e7d6091", // Friendly, conversational
  emma: "98a34ef2-2140-4c28-9c71-663dc4dd7022", // Clear, energetic

  // Male voices
  james: "69267136-1bdc-412f-ad78-0caad210fb40", // Professional, authoritative
  michael: "d46abd1d-2f43-4e2b-86ee-e9b9e8f3a4e7", // Friendly, warm
} as const;

// Default configuration for phone calls (mu-law 8kHz)
export const defaultCartesiaConfig: CartesiaConfig = {
  modelId: "sonic-english",
  voiceId: cartesiaVoices.hannah,
  outputFormat: {
    container: "raw",
    encoding: "pcm_mulaw",
    sampleRate: 8000,
  },
};

// WebSocket URL for streaming TTS
export const cartesiaWsUrl = "wss://api.cartesia.ai/tts/websocket";

// REST API URL
export const cartesiaRestUrl = "https://api.cartesia.ai/tts/bytes";
