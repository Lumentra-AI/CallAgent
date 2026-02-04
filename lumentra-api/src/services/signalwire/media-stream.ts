// SignalWire Media Stream Handler
// WebSocket handler for real-time audio streaming

import type WebSocket from "ws";
import type {
  SignalWireMediaEvent,
  SignalWireStartEvent,
  SignalWireOutboundMedia,
} from "../../types/voice.js";

export interface MediaStreamCallbacks {
  onStart: (event: SignalWireStartEvent) => void;
  onAudio: (audioBuffer: Buffer) => void;
  onStop: () => void;
  onError: (error: Error) => void;
}

export class MediaStreamHandler {
  private ws: WebSocket;
  private callbacks: MediaStreamCallbacks;
  private streamSid: string | null = null;
  private isActive = false;
  private lastAudioSentTime: number = Date.now();
  private silenceInjectionInterval: NodeJS.Timeout | null = null;

  // Generate silence frames (20ms of mulaw silence = 160 bytes of 0xFF)
  private static readonly SILENCE_FRAME = Buffer.alloc(160, 0xff);
  private static readonly SILENCE_INJECTION_INTERVAL_MS = 20;
  private static readonly MAX_SILENCE_GAP_MS = 100;

  constructor(ws: WebSocket, callbacks: MediaStreamCallbacks) {
    this.ws = ws;
    this.callbacks = callbacks;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.ws.on("message", (data: WebSocket.Data) => {
      try {
        const event = JSON.parse(data.toString()) as SignalWireMediaEvent;
        this.handleEvent(event);
      } catch (error) {
        console.error("[MEDIA-STREAM] Error parsing message:", error);
        this.callbacks.onError(error as Error);
      }
    });

    this.ws.on("close", () => {
      console.log("[MEDIA-STREAM] WebSocket closed");
      this.isActive = false;
      this.stopSilenceInjection();
      this.callbacks.onStop();
    });

    this.ws.on("error", (error) => {
      console.error("[MEDIA-STREAM] WebSocket error:", error);
      this.callbacks.onError(error as Error);
    });
  }

  private handleEvent(event: SignalWireMediaEvent): void {
    switch (event.event) {
      case "connected":
        console.log("[MEDIA-STREAM] Connected to SignalWire");
        break;

      case "start":
        if (event.start) {
          this.streamSid = event.start.streamSid;
          this.isActive = true;
          console.log(`[MEDIA-STREAM] Stream started: ${this.streamSid}`);
          console.log(`[MEDIA-STREAM] Call SID: ${event.start.callSid}`);
          console.log(
            `[MEDIA-STREAM] Format: ${JSON.stringify(event.start.mediaFormat)}`,
          );

          // Start silence injection to prevent buffer underruns
          this.startSilenceInjection();

          this.callbacks.onStart(event.start);
        }
        break;

      case "media":
        if (event.media?.payload) {
          // Decode base64 audio
          const audioBuffer = Buffer.from(event.media.payload, "base64");
          this.callbacks.onAudio(audioBuffer);
        }
        break;

      case "mark":
        console.log(`[MEDIA-STREAM] Mark received: ${event.mark?.name}`);
        break;

      case "stop":
        console.log("[MEDIA-STREAM] Stream stopped");
        this.isActive = false;
        this.stopSilenceInjection();
        this.callbacks.onStop();
        break;
    }
  }

  // Send audio back to the caller
  sendAudio(audioBuffer: Buffer): void {
    if (!this.isActive || !this.streamSid) {
      return;
    }

    // Track last audio send time for silence injection
    this.lastAudioSentTime = Date.now();

    const message: SignalWireOutboundMedia = {
      event: "media",
      streamSid: this.streamSid,
      media: {
        payload: audioBuffer.toString("base64"),
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Start injecting silence frames to prevent buffer underrun
   * Runs periodically and injects silence if no audio sent recently
   */
  private startSilenceInjection(): void {
    this.stopSilenceInjection(); // Clear any existing interval

    this.silenceInjectionInterval = setInterval(() => {
      const timeSinceLastAudio = Date.now() - this.lastAudioSentTime;

      // If we haven't sent audio in a while, inject silence to prevent underrun
      if (timeSinceLastAudio > MediaStreamHandler.MAX_SILENCE_GAP_MS) {
        this.sendSilence();
      }
    }, MediaStreamHandler.SILENCE_INJECTION_INTERVAL_MS);
  }

  /**
   * Stop silence injection
   */
  private stopSilenceInjection(): void {
    if (this.silenceInjectionInterval) {
      clearInterval(this.silenceInjectionInterval);
      this.silenceInjectionInterval = null;
    }
  }

  /**
   * Send silence frame to maintain RTP stream continuity
   */
  private sendSilence(): void {
    if (!this.isActive || !this.streamSid) {
      return;
    }

    const message: SignalWireOutboundMedia = {
      event: "media",
      streamSid: this.streamSid,
      media: {
        payload: MediaStreamHandler.SILENCE_FRAME.toString("base64"),
      },
    };

    this.ws.send(JSON.stringify(message));
    this.lastAudioSentTime = Date.now();
  }

  // Send a mark to track audio playback position
  sendMark(name: string): void {
    if (!this.isActive || !this.streamSid) {
      return;
    }

    const message: SignalWireOutboundMedia = {
      event: "mark",
      streamSid: this.streamSid,
      mark: { name },
    };

    this.ws.send(JSON.stringify(message));
  }

  // Clear any queued audio (for interruptions)
  clearAudio(): void {
    if (!this.isActive || !this.streamSid) {
      return;
    }

    const message: SignalWireOutboundMedia = {
      event: "clear",
      streamSid: this.streamSid,
    };

    this.ws.send(JSON.stringify(message));
  }

  getStreamSid(): string | null {
    return this.streamSid;
  }

  isStreamActive(): boolean {
    return this.isActive;
  }

  close(): void {
    console.log("[MEDIA-STREAM] Closing connection");
    this.isActive = false;
    this.stopSilenceInjection();
    this.ws.close();
  }
}

// Factory function
export function createMediaStreamHandler(
  ws: WebSocket,
  callbacks: MediaStreamCallbacks,
): MediaStreamHandler {
  return new MediaStreamHandler(ws, callbacks);
}
