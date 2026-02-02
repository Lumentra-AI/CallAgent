// Cartesia Streaming TTS
// WebSocket-based streaming for low-latency text-to-speech

import WebSocket from "ws";

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const CARTESIA_WS_URL = "wss://api.cartesia.ai/tts/websocket";

export interface StreamingTTSConfig {
  voiceId: string;
  modelId?: string;
  sampleRate?: number;
}

export interface CartesiaStreamingTTS {
  connect(): Promise<void>;
  disconnect(): void;
  queueText(text: string): void;
  onAudioChunk: (chunk: Buffer) => void;
  onError: (error: Error) => void;
  onDone: () => void;
  isConnected(): boolean;
}

export function createStreamingTTS(
  config: StreamingTTSConfig,
  callbacks: {
    onAudioChunk: (chunk: Buffer) => void;
    onError: (error: Error) => void;
    onDone: () => void;
  },
): CartesiaStreamingTTS {
  let ws: WebSocket | null = null;
  let contextId = crypto.randomUUID();
  let textBuffer: string[] = [];
  let isProcessing = false;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const connect = async (): Promise<void> => {
    if (!CARTESIA_API_KEY) {
      throw new Error("CARTESIA_API_KEY not set");
    }

    return new Promise((resolve, reject) => {
      const url = `${CARTESIA_WS_URL}?api_key=${CARTESIA_API_KEY}&cartesia_version=2024-06-10`;
      ws = new WebSocket(url);

      ws.on("open", () => {
        console.log("[CARTESIA] WebSocket connected");
        startHeartbeat();
        resolve();
      });

      ws.on("message", (data) => {
        try {
          const response = JSON.parse(data.toString());

          if (response.type === "chunk" && response.data) {
            // Decode base64 audio and send to callback
            const audioBuffer = Buffer.from(response.data, "base64");
            callbacks.onAudioChunk(audioBuffer);
          } else if (response.type === "done") {
            callbacks.onDone();
          } else if (response.type === "error") {
            callbacks.onError(new Error(response.message || "Cartesia error"));
          }
        } catch (err) {
          console.error("[CARTESIA] Failed to parse message:", err);
        }
      });

      ws.on("error", (err) => {
        console.error("[CARTESIA] WebSocket error:", err);
        callbacks.onError(err);
        reject(err);
      });

      ws.on("close", () => {
        console.log("[CARTESIA] WebSocket closed");
        stopHeartbeat();
        ws = null;
      });
    });
  };

  const disconnect = (): void => {
    stopHeartbeat();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    ws = null;
  };

  const startHeartbeat = (): void => {
    // Keep WebSocket alive to avoid reconnection latency
    heartbeatInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 15000);
  };

  const stopHeartbeat = (): void => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };

  const queueText = (text: string): void => {
    textBuffer.push(text);
    if (!isProcessing) {
      processBuffer();
    }
  };

  const processBuffer = async (): Promise<void> => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[CARTESIA] WebSocket not connected, cannot send text");
      return;
    }

    isProcessing = true;

    while (textBuffer.length > 0) {
      const text = textBuffer.shift()!;

      // Stream to Cartesia with context for consistent voice
      const message = {
        model_id: config.modelId || "sonic-3",
        transcript: text,
        voice: { mode: "id", id: config.voiceId },
        context_id: contextId,
        output_format: {
          container: "raw",
          encoding: "pcm_s16le", // 16-bit Linear PCM (high quality)
          sample_rate: config.sampleRate || 24000, // 24kHz for SignalWire L16@24000h
        },
        continue: textBuffer.length > 0,
      };

      ws.send(JSON.stringify(message));
    }

    isProcessing = false;
  };

  const isConnected = (): boolean => {
    return ws !== null && ws.readyState === WebSocket.OPEN;
  };

  return {
    connect,
    disconnect,
    queueText,
    onAudioChunk: callbacks.onAudioChunk,
    onError: callbacks.onError,
    onDone: callbacks.onDone,
    isConnected,
  };
}

// Reset context ID for new conversation
export function resetContext(): string {
  return crypto.randomUUID();
}
