// Turn Manager
// Orchestrates the voice conversation flow

import {
  createTurnState,
  updateTranscript,
  getCompleteTranscript,
  clearTranscript,
  startSilence,
  clearAudioQueue,
} from "./conversation-state.js";
import * as sessionManager from "./session-manager.js";
import {
  chat,
  chatWithFallback,
  buildSystemPrompt,
  cleanupCall,
} from "../groq/chat.js";
import {
  createTranscriber,
  type DeepgramTranscriber,
} from "../deepgram/transcriber.js";
import { createTTS, type CartesiaTTS } from "../cartesia/tts.js";
import {
  createMediaStreamHandler,
  type MediaStreamHandler,
} from "../signalwire/media-stream.js";
import {
  createEscalationState,
  type EscalationState,
} from "../escalation/escalation-manager.js";
import type { Tenant } from "../../types/database.js";
import type WebSocket from "ws";

// Feature flag: use FunctionGemma routing (set to false to use legacy chat)
const USE_FALLBACK_CHAIN = process.env.USE_FALLBACK_CHAIN !== "false";

// Configuration
const SILENCE_THRESHOLD_MS = 1200; // Wait for user to stop speaking
const MIN_TRANSCRIPT_LENGTH = 3; // Minimum characters before processing

export interface TurnManagerCallbacks {
  onResponse: (text: string) => void;
  onTransferRequested: (phoneNumber: string) => void;
  onCallEnd: (reason: string) => void;
}

export class TurnManager {
  private callSid: string;
  private tenant: Tenant;
  private callbacks: TurnManagerCallbacks;

  private state = createTurnState();
  private transcriber: DeepgramTranscriber | null = null;
  private tts: CartesiaTTS | null = null;
  private mediaHandler: MediaStreamHandler | null = null;

  private systemPrompt: string;
  private silenceTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private escalationState: EscalationState;

  constructor(
    callSid: string,
    tenant: Tenant,
    callerPhone: string | undefined,
    callbacks: TurnManagerCallbacks,
  ) {
    this.callSid = callSid;
    this.tenant = tenant;
    this.callbacks = callbacks;

    // Create session
    sessionManager.createSession(callSid, tenant, callerPhone);

    // Initialize escalation state for smart transfer handling
    this.escalationState = createEscalationState();

    // Build system prompt from tenant config
    this.systemPrompt = buildSystemPrompt(
      tenant.agent_name,
      tenant.business_name,
      tenant.industry,
      tenant.agent_personality,
    );

    console.log(
      `[TURN] Initialized for ${callSid}, fallback chain: ${USE_FALLBACK_CHAIN}`,
    );
  }

  async initialize(ws: WebSocket): Promise<void> {
    console.log(`[TURN] Initializing turn manager for ${this.callSid}`);

    // Set up media stream handler
    this.mediaHandler = createMediaStreamHandler(ws, {
      onStart: (event) => {
        console.log(`[TURN] Media stream started for ${this.callSid}`);
        sessionManager.updateSession(this.callSid, {
          streamSid: event.streamSid,
        });
      },
      onAudio: (audioBuffer) => {
        this.handleIncomingAudio(audioBuffer);
      },
      onStop: () => {
        console.log(`[TURN] Media stream stopped for ${this.callSid}`);
        this.cleanup();
      },
      onError: (error) => {
        console.error(`[TURN] Media stream error:`, error);
      },
    });

    // Set up TTS
    this.tts = createTTS(
      {
        onAudioChunk: (audioData) => {
          this.mediaHandler?.sendAudio(audioData);
        },
        onDone: () => {
          sessionManager.setPlaying(this.callSid, false);
          this.checkForPendingResponse();
        },
        onError: (error) => {
          console.error(`[TURN] TTS error:`, error);
          sessionManager.setPlaying(this.callSid, false);
        },
      },
      { voiceId: this.tenant.voice_config.voice_id },
    );

    // Set up STT
    this.transcriber = createTranscriber({
      onTranscript: (text, isFinal) => {
        this.handleTranscript(text, isFinal);
      },
      onSpeechStarted: () => {
        this.handleSpeechStarted();
      },
      onSpeechEnded: () => {
        this.handleSpeechEnded();
      },
      onError: (error) => {
        console.error(`[TURN] STT error:`, error);
      },
      onClose: () => {
        console.log(`[TURN] STT connection closed`);
      },
    });

    // Connect services
    await Promise.all([this.tts.connect(), this.transcriber.start()]);

    // Speak greeting
    await this.speak(this.tenant.greeting_standard);
  }

  private handleIncomingAudio(audioBuffer: Buffer): void {
    // Forward audio to STT
    this.transcriber?.sendAudio(audioBuffer);
  }

  private handleTranscript(text: string, isFinal: boolean): void {
    this.state = updateTranscript(this.state, text, isFinal);

    // Reset silence timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (isFinal) {
      console.log(`[TURN] Final transcript: "${text}"`);

      // Start silence timer to detect end of turn
      this.silenceTimer = setTimeout(() => {
        this.processUserTurn();
      }, SILENCE_THRESHOLD_MS);
    }
  }

  private handleSpeechStarted(): void {
    console.log(`[TURN] User started speaking`);
    sessionManager.setSpeaking(this.callSid, true);

    // Check for barge-in (interrupt TTS)
    const session = sessionManager.getSession(this.callSid);
    if (session?.isPlaying) {
      console.log(`[TURN] Barge-in detected, interrupting TTS`);
      sessionManager.requestInterrupt(this.callSid);
      this.tts?.cancel();
      this.mediaHandler?.clearAudio();
      this.state = clearAudioQueue(this.state);
    }
  }

  private handleSpeechEnded(): void {
    console.log(`[TURN] User stopped speaking`);
    sessionManager.setSpeaking(this.callSid, false);
    this.state = startSilence(this.state);

    // Process turn after silence
    if (!this.silenceTimer) {
      this.silenceTimer = setTimeout(() => {
        this.processUserTurn();
      }, SILENCE_THRESHOLD_MS);
    }
  }

  private async processUserTurn(): Promise<void> {
    if (this.isProcessing) {
      console.log(`[TURN] Already processing, skipping`);
      return;
    }

    const transcript = getCompleteTranscript(this.state);
    if (transcript.length < MIN_TRANSCRIPT_LENGTH) {
      console.log(`[TURN] Transcript too short, ignoring: "${transcript}"`);
      return;
    }

    this.isProcessing = true;
    console.log(`[TURN] Processing user turn: "${transcript}"`);

    // Clear transcript buffer
    this.state = clearTranscript(this.state);

    // Add to conversation history
    sessionManager.addMessage(this.callSid, "user", transcript);

    try {
      // Generate response
      const conversationHistory = sessionManager.getConversationHistory(
        this.callSid,
      );

      const toolContext = {
        tenantId: this.tenant.id,
        callSid: this.callSid,
        callerPhone: sessionManager.getSession(this.callSid)?.callerPhone,
      };

      if (USE_FALLBACK_CHAIN) {
        // Use FunctionGemma routing + Llama 3.1 8B fallback chain
        const response = await chatWithFallback(
          transcript,
          conversationHistory,
          this.systemPrompt,
          toolContext,
          this.escalationState,
        );

        console.log(
          `[TURN] Chain response: "${response.text.substring(0, 100)}..." ` +
            `(action: ${response.action}, latency: ${response.metrics.totalLatencyMs}ms)`,
        );

        // Add assistant response to history
        sessionManager.addMessage(this.callSid, "assistant", response.text);

        // Handle escalation
        if (response.action === "escalate") {
          console.log(
            `[TURN] Escalation triggered: ${response.escalationReason}`,
          );
          if (this.tenant.escalation_phone) {
            this.callbacks.onTransferRequested(this.tenant.escalation_phone);
          }
        }

        // Check for transfer tool call (legacy behavior)
        if (response.toolCalls?.some((tc) => tc.name === "transfer_to_human")) {
          if (this.tenant.escalation_phone) {
            this.callbacks.onTransferRequested(this.tenant.escalation_phone);
          }
        }

        // Speak response
        await this.speak(response.text);
        this.callbacks.onResponse(response.text);
      } else {
        // Legacy: direct LLM chat without FunctionGemma routing
        const response = await chat(
          transcript,
          conversationHistory,
          this.systemPrompt,
          toolContext,
        );

        console.log(
          `[TURN] Generated response: "${response.text.substring(0, 100)}..."`,
        );

        // Add assistant response to history
        sessionManager.addMessage(this.callSid, "assistant", response.text);

        // Check for transfer
        if (response.toolCalls?.some((tc) => tc.name === "transfer_to_human")) {
          if (this.tenant.escalation_phone) {
            this.callbacks.onTransferRequested(this.tenant.escalation_phone);
          }
        }

        // Speak response
        await this.speak(response.text);
        this.callbacks.onResponse(response.text);
      }
    } catch (error) {
      console.error(`[TURN] Error processing turn:`, error);

      // Fallback response
      const fallback =
        "I'm sorry, I'm having trouble processing that. Could you please repeat?";
      await this.speak(fallback);
    } finally {
      this.isProcessing = false;
    }
  }

  private async speak(text: string): Promise<void> {
    if (!this.tts) {
      console.warn(`[TURN] TTS not initialized`);
      return;
    }

    sessionManager.setPlaying(this.callSid, true);
    this.tts.speak(text);
  }

  private checkForPendingResponse(): void {
    // Check if we need to process another turn
    const session = sessionManager.getSession(this.callSid);
    if (session?.isSpeaking) {
      // User is speaking, wait
      return;
    }

    const transcript = getCompleteTranscript(this.state);
    if (transcript.length >= MIN_TRANSCRIPT_LENGTH) {
      // Process pending transcript
      this.processUserTurn();
    }
  }

  async cleanup(): Promise<void> {
    console.log(`[TURN] Cleaning up turn manager for ${this.callSid}`);

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    await Promise.all([this.transcriber?.stop(), this.tts?.disconnect()]);

    // Cleanup call state (retry counters, etc.)
    cleanupCall(this.callSid);
    sessionManager.endSession(this.callSid);
    this.callbacks.onCallEnd("cleanup");
  }
}

// Factory function
export function createTurnManager(
  callSid: string,
  tenant: Tenant,
  callerPhone: string | undefined,
  callbacks: TurnManagerCallbacks,
): TurnManager {
  return new TurnManager(callSid, tenant, callerPhone, callbacks);
}
