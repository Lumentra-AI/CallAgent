// Cartesia TTS Service
// Streaming text-to-speech with WebSocket

import WebSocket from "ws";
import {
  cartesiaApiKey,
  cartesiaWsUrl,
  defaultCartesiaConfig,
  voiceControls,
} from "./client.js";
import type { CartesiaConfig, CartesiaStreamChunk } from "../../types/voice.js";

export interface TTSCallbacks {
  onAudioChunk: (audioData: Buffer) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export class CartesiaTTS {
  private ws: WebSocket | null = null;
  private callbacks: TTSCallbacks;
  private config: CartesiaConfig;
  private isConnected = false;
  private messageQueue: string[] = [];
  private contextId: string;

  constructor(callbacks: TTSCallbacks, config?: Partial<CartesiaConfig>) {
    this.callbacks = callbacks;
    this.config = { ...defaultCartesiaConfig, ...config };
    this.contextId = `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async connect(): Promise<void> {
    if (!cartesiaApiKey) {
      throw new Error("Cartesia API key not set");
    }

    if (this.ws) {
      console.warn("[TTS] Already connected, closing existing connection");
      await this.disconnect();
    }

    console.log("[TTS] Connecting to Cartesia...");

    return new Promise((resolve, reject) => {
      const wsUrl = `${cartesiaWsUrl}?api_key=${cartesiaApiKey}&cartesia_version=2024-06-10`;
      this.ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        reject(new Error("Cartesia connection timeout"));
      }, 5000);

      this.ws.on("open", () => {
        clearTimeout(timeout);
        this.isConnected = true;
        console.log("[TTS] Connected to Cartesia");

        // Process any queued messages
        while (this.messageQueue.length > 0) {
          const text = this.messageQueue.shift()!;
          this.sendText(text);
        }

        resolve();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as CartesiaStreamChunk;
          this.handleMessage(message);
        } catch (error) {
          console.error("[TTS] Error parsing message:", error);
        }
      });

      this.ws.on("error", (error) => {
        console.error("[TTS] WebSocket error:", error);
        clearTimeout(timeout);
        this.callbacks.onError(error as Error);
        reject(error);
      });

      this.ws.on("close", () => {
        console.log("[TTS] Connection closed");
        this.isConnected = false;
      });
    });
  }

  private handleMessage(message: CartesiaStreamChunk): void {
    switch (message.type) {
      case "chunk":
        if (message.data) {
          const audioBuffer = Buffer.from(message.data, "base64");
          this.callbacks.onAudioChunk(audioBuffer);
        }
        break;

      case "done":
        console.log("[TTS] Stream complete");
        this.callbacks.onDone();
        break;

      case "timestamps":
        // Word timestamps for potential future use (lip sync, etc.)
        break;
    }
  }

  speak(text: string): void {
    if (!this.isConnected) {
      console.log("[TTS] Queueing text (not connected yet)");
      this.messageQueue.push(text);
      return;
    }

    this.sendText(text);
  }

  private sendText(text: string): void {
    if (!this.ws || !this.isConnected) {
      console.error("[TTS] Cannot send: not connected");
      return;
    }

    console.log(`[TTS] Sending: "${text.substring(0, 50)}..."`);

    const request = {
      model_id: this.config.modelId,
      transcript: text,
      voice: {
        mode: "id",
        id: this.config.voiceId,
        __experimental_controls: voiceControls,
      },
      output_format: {
        container: this.config.outputFormat.container,
        encoding: this.config.outputFormat.encoding,
        sample_rate: this.config.outputFormat.sampleRate,
      },
      context_id: this.contextId,
      continue: false,
    };

    this.ws.send(JSON.stringify(request));
  }

  // For streaming long responses in chunks
  speakChunk(text: string, isContinuation: boolean): void {
    if (!this.ws || !this.isConnected) {
      console.error("[TTS] Cannot send: not connected");
      return;
    }

    console.log(
      `[TTS] Chunk: "${text.substring(0, 40)}${text.length > 40 ? "..." : ""}" (continue: ${isContinuation})`,
    );

    const request = {
      model_id: this.config.modelId,
      transcript: text,
      voice: {
        mode: "id",
        id: this.config.voiceId,
        __experimental_controls: voiceControls,
      },
      output_format: {
        container: this.config.outputFormat.container,
        encoding: this.config.outputFormat.encoding,
        sample_rate: this.config.outputFormat.sampleRate,
      },
      context_id: this.contextId,
      continue: isContinuation,
    };

    this.ws.send(JSON.stringify(request));
  }

  // Cancel current speech and clear queue
  cancel(): void {
    this.messageQueue = [];
    // Cartesia doesn't have a cancel command, but we can stop processing
    // audio chunks on the receiving end
    console.log("[TTS] Speech cancelled");
  }

  async disconnect(): Promise<void> {
    console.log("[TTS] Disconnecting...");

    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        console.error("[TTS] Error closing connection:", error);
      }
      this.ws = null;
    }

    this.isConnected = false;
    this.messageQueue = [];
  }

  isReady(): boolean {
    return this.isConnected;
  }
}

// Factory function
export function createTTS(
  callbacks: TTSCallbacks,
  config?: Partial<CartesiaConfig>,
): CartesiaTTS {
  return new CartesiaTTS(callbacks, config);
}

// Simple one-shot TTS (for shorter messages)
export async function synthesize(
  text: string,
  config?: Partial<CartesiaConfig>,
): Promise<Buffer> {
  if (!cartesiaApiKey) {
    throw new Error("Cartesia API key not set");
  }

  const cfg = { ...defaultCartesiaConfig, ...config };

  const response = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "X-API-Key": cartesiaApiKey,
      "Cartesia-Version": "2024-06-10",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: cfg.modelId,
      transcript: text,
      voice: {
        mode: "id",
        id: cfg.voiceId,
      },
      output_format: {
        container: cfg.outputFormat.container,
        encoding: cfg.outputFormat.encoding,
        sample_rate: cfg.outputFormat.sampleRate,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Cartesia API error: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
