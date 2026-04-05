import { Hono } from "hono";

export const voiceRoutes = new Hono();

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const CARTESIA_API_URL = "https://api.cartesia.ai/tts/bytes";

/**
 * POST /api/voice/preview
 * Generates a TTS audio preview using Cartesia Sonic-3.
 * Returns WAV audio bytes.
 */
voiceRoutes.post("/preview", async (c) => {
  const body = await c.req.json<{
    voiceId?: string;
    sampleText?: string;
    speed?: number;
  }>();

  const voiceId = body.voiceId?.trim();
  const sampleText = body.sampleText?.trim();
  // Clamp speed to Cartesia's supported range
  const speed = Math.min(Math.max(body.speed ?? 1.0, 0.5), 2.0);

  if (!voiceId) {
    return c.json({ error: "voiceId is required" }, 400);
  }
  if (!sampleText) {
    return c.json({ error: "sampleText is required" }, 400);
  }
  if (sampleText.length > 500) {
    return c.json({ error: "sampleText must be under 500 characters" }, 400);
  }

  if (!CARTESIA_API_KEY) {
    console.error("[VOICE] CARTESIA_API_KEY not configured");
    return c.json({ error: "Voice preview not available" }, 503);
  }

  try {
    const response = await fetch(CARTESIA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cartesia-Version": "2024-06-10",
        "X-API-Key": CARTESIA_API_KEY,
      },
      body: JSON.stringify({
        model_id: "sonic-3",
        transcript: sampleText,
        voice: {
          mode: "id",
          id: voiceId,
        },
        output_format: {
          container: "wav",
          sample_rate: 24000,
          encoding: "pcm_s16le",
        },
        language: "en",
        generation_config: {
          speed,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      console.error(
        `[VOICE] Cartesia TTS error: ${response.status} ${errText}`,
      );
      return c.json({ error: "Voice preview generation failed" }, 502);
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(audioBuffer.byteLength),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[VOICE] Preview error:", error);
    return c.json({ error: "Voice preview generation failed" }, 500);
  }
});
