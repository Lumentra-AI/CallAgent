// Deepgram Real-time Transcriber
// Handles streaming audio transcription with VAD

import {
  deepgramClient,
  defaultDeepgramConfig,
  LiveTranscriptionEvents,
} from "./client.js";
import type { DeepgramConfig, DeepgramTranscript } from "../../types/voice.js";
import type { LiveClient } from "@deepgram/sdk";

export interface TranscriberCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onSpeechStarted: () => void;
  onSpeechEnded: () => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

// Reconnection configuration
const RECONNECT_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
};

export class DeepgramTranscriber {
  private connection: LiveClient | null = null;
  private callbacks: TranscriberCallbacks;
  private config: DeepgramConfig;
  private isOpen = false;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isReconnecting = false;
  private isStopped = false;
  private audioBuffer: Buffer[] = []; // Buffer audio during reconnection

  constructor(
    callbacks: TranscriberCallbacks,
    config?: Partial<DeepgramConfig>,
  ) {
    this.callbacks = callbacks;
    this.config = { ...defaultDeepgramConfig, ...config };
  }

  async start(): Promise<void> {
    if (!deepgramClient) {
      throw new Error("Deepgram client not initialized - missing API key");
    }

    if (this.connection) {
      console.warn(
        "[TRANSCRIBER] Already connected, closing existing connection",
      );
      await this.stop();
    }

    console.log("[TRANSCRIBER] Starting Deepgram connection...");

    try {
      this.connection = deepgramClient.listen.live({
        model: this.config.model,
        language: this.config.language,
        punctuate: this.config.punctuate,
        interim_results: this.config.interimResults,
        utterance_end_ms: this.config.utteranceEndMs,
        vad_events: this.config.vadEvents,
        encoding: this.config.encoding,
        sample_rate: this.config.sampleRate,
        channels: this.config.channels,
        endpointing: this.config.endpointing,
      });

      this.setupEventHandlers();

      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Deepgram connection timeout"));
        }, 5000);

        this.connection!.on(LiveTranscriptionEvents.Open, () => {
          clearTimeout(timeout);
          this.isOpen = true;
          console.log("[TRANSCRIBER] Deepgram connection opened");
          resolve();
        });

        this.connection!.on(LiveTranscriptionEvents.Error, (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Start keep-alive ping
      this.keepAliveInterval = setInterval(() => {
        if (this.connection && this.isOpen) {
          this.connection.keepAlive();
        }
      }, 10000);
    } catch (error) {
      console.error("[TRANSCRIBER] Failed to start:", error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.connection) return;

    this.connection.on(
      LiveTranscriptionEvents.Transcript,
      (data: DeepgramTranscript) => {
        if (data.type === "Results" && data.channel?.alternatives?.[0]) {
          const transcript = data.channel.alternatives[0].transcript;
          const isFinal = data.is_final || false;

          if (transcript) {
            this.callbacks.onTranscript(transcript, isFinal);
          }
        }
      },
    );

    this.connection.on(LiveTranscriptionEvents.SpeechStarted, () => {
      console.log("[TRANSCRIBER] Speech started");
      this.callbacks.onSpeechStarted();
    });

    this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      console.log("[TRANSCRIBER] Utterance ended");
      this.callbacks.onSpeechEnded();
    });

    this.connection.on(LiveTranscriptionEvents.Error, (error: Error) => {
      console.error("[TRANSCRIBER] Error:", error);
      this.callbacks.onError(error);
    });

    this.connection.on(LiveTranscriptionEvents.Close, () => {
      console.log("[TRANSCRIBER] Connection closed");
      this.isOpen = false;

      // Attempt reconnection if not intentionally stopped
      if (!this.isStopped && !this.isReconnecting) {
        this.attemptReconnect();
      } else {
        this.callbacks.onClose();
      }
    });
  }

  private async attemptReconnect(): Promise<void> {
    if (
      this.isStopped ||
      this.isReconnecting ||
      this.reconnectAttempts >= RECONNECT_CONFIG.maxRetries
    ) {
      console.log(
        `[TRANSCRIBER] Max reconnect attempts reached or stopped, calling onClose`,
      );
      this.callbacks.onClose();
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Exponential backoff
    const delay = Math.min(
      RECONNECT_CONFIG.baseDelayMs * Math.pow(2, this.reconnectAttempts - 1),
      RECONNECT_CONFIG.maxDelayMs,
    );

    console.log(
      `[TRANSCRIBER] Attempting reconnect ${this.reconnectAttempts}/${RECONNECT_CONFIG.maxRetries} in ${delay}ms`,
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    if (this.isStopped) {
      this.isReconnecting = false;
      return;
    }

    try {
      await this.start();
      console.log(`[TRANSCRIBER] Reconnected successfully`);
      this.reconnectAttempts = 0;

      // Flush buffered audio
      if (this.audioBuffer.length > 0) {
        console.log(
          `[TRANSCRIBER] Flushing ${this.audioBuffer.length} buffered audio chunks`,
        );
        for (const chunk of this.audioBuffer) {
          this.sendAudio(chunk);
        }
        this.audioBuffer = [];
      }
    } catch (error) {
      console.error(`[TRANSCRIBER] Reconnect attempt failed:`, error);
      this.attemptReconnect(); // Try again
    } finally {
      this.isReconnecting = false;
    }
  }

  sendAudio(audioData: Buffer): void {
    // Buffer audio during reconnection
    if (this.isReconnecting) {
      this.audioBuffer.push(audioData);
      // Limit buffer size to prevent memory issues (keep last 50 chunks ~1 second)
      if (this.audioBuffer.length > 50) {
        this.audioBuffer.shift();
      }
      return;
    }

    if (!this.connection || !this.isOpen) {
      return;
    }
    // Convert Buffer to ArrayBuffer for Deepgram SDK
    const arrayBuffer = audioData.buffer.slice(
      audioData.byteOffset,
      audioData.byteOffset + audioData.byteLength,
    );
    this.connection.send(arrayBuffer);
  }

  async stop(): Promise<void> {
    console.log("[TRANSCRIBER] Stopping...");
    this.isStopped = true; // Prevent reconnection attempts

    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    if (this.connection) {
      try {
        this.connection.requestClose();
      } catch (error) {
        console.error("[TRANSCRIBER] Error closing connection:", error);
      }
      this.connection = null;
    }

    this.isOpen = false;
    this.audioBuffer = [];
  }

  isConnected(): boolean {
    return this.isOpen;
  }
}

// Factory function for creating transcribers
export function createTranscriber(
  callbacks: TranscriberCallbacks,
  config?: Partial<DeepgramConfig>,
): DeepgramTranscriber {
  return new DeepgramTranscriber(callbacks, config);
}
