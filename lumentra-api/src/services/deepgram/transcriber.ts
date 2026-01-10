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

export class DeepgramTranscriber {
  private connection: LiveClient | null = null;
  private callbacks: TranscriberCallbacks;
  private config: DeepgramConfig;
  private isOpen = false;
  private keepAliveInterval: NodeJS.Timeout | null = null;

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
      this.callbacks.onClose();
    });
  }

  sendAudio(audioData: Buffer): void {
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
