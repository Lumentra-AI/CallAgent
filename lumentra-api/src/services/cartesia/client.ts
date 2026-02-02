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
  // Female voices - young adult (mid-twenties)
  taylor: "abad7f2e-7eb3-4edb-b08e-d538401dfbad", // Clear, personable, warm & professional
  allie: "2747b6cf-fa34-460c-97db-267566918881", // Confident, approachable young adult
  mia: "1d3ba41a-96e6-44ad-aabb-9817c56caa68", // Firm, young female for support
  katie: "f786b574-daa5-4673-aa0c-cbe3e8534c02", // Enunciating young adult for support
  riley: "21b81c14-f85b-436d-aff5-43f2e788ecf8", // Casual, young female
  madison: "02fe5732-a072-4767-83e3-a91d41d274ca", // Enthusiastic young adult female

  // Female voices - mature
  hannah: "248be419-c632-4f23-adf1-5324ed7dbf1d", // Enunciating young female (Elizabeth)

  // Male voices
  james: "69267136-1bdc-412f-ad78-0caad210fb40", // Professional, authoritative
  michael: "d46abd1d-2f43-4e2b-86ee-e9b9e8f3a4e7", // Friendly, warm
} as const;

// Default configuration for phone calls (mu-law 8kHz)
export const defaultCartesiaConfig: CartesiaConfig = {
  modelId: "sonic-3", // Best quality - natural emotions, laughter
  voiceId: cartesiaVoices.katie, // Friendly fixer - natural sounding
  outputFormat: {
    container: "raw",
    encoding: "pcm_mulaw",
    sampleRate: 8000,
  },
};

// Voice controls matching Cartesia playground settings
export const voiceControls = {
  speed: "normal" as const,
  emotion: ["positivity:medium"] as const, // Moderate warmth - sounds human
};

// WebSocket URL for streaming TTS
export const cartesiaWsUrl = "wss://api.cartesia.ai/tts/websocket";

// REST API URL
export const cartesiaRestUrl = "https://api.cartesia.ai/tts/bytes";
