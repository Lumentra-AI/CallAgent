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
        this.callbacks.onStop();
        break;
    }
  }

  // Send audio back to the caller
  sendAudio(audioBuffer: Buffer): void {
    if (!this.isActive || !this.streamSid) {
      return;
    }

    const message: SignalWireOutboundMedia = {
      event: "media",
      streamSid: this.streamSid,
      media: {
        payload: audioBuffer.toString("base64"),
      },
    };

    this.ws.send(JSON.stringify(message));
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
