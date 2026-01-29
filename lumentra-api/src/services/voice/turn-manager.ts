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
import { buildSystemPrompt, cleanupCall } from "../gemini/chat.js";
import {
  chatWithFallback as multiProviderChat,
  sendToolResults,
  type LLMResponse,
} from "../llm/multi-provider.js";
import { voiceAgentFunctions, executeTool } from "../gemini/tools.js";
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
import {
  conversationLogger,
  startConversationLog,
  addUserTurn,
  addAssistantTurn,
  endConversationLog,
} from "../training/conversation-logger.js";
import { saveCallRecord } from "../calls/call-logger.js";
import { checkUtteranceCompleteness } from "../gemini/intent-check.js";
import type { Tenant } from "../../types/database.js";
import type WebSocket from "ws";

// Configuration
const SILENCE_THRESHOLD_MS = 300; // Small buffer after Deepgram's utterance end
const INCOMPLETE_WAIT_MS = 1200; // Wait longer when LLM detects incomplete thought
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

    // Start conversation logging for training data
    this.initializeTrainingLog(callerPhone);

    console.log(`[TURN] Initialized for ${callSid}`);
  }

  private async initializeTrainingLog(
    _callerPhone: string | undefined,
  ): Promise<void> {
    try {
      await startConversationLog({
        tenantId: this.tenant.id,
        sessionId: this.callSid,
        industry: this.tenant.industry,
        scenarioType: "general", // Will be updated based on conversation
      });

      // Log the system prompt
      await conversationLogger.addSystemMessage(
        this.callSid,
        this.systemPrompt,
      );

      console.log(`[TRAINING] Started logging for call ${this.callSid}`);
    } catch (error) {
      console.error(`[TRAINING] Failed to start logging:`, error);
    }
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

    // Speak greeting and log it
    await this.speak(this.tenant.greeting_standard);
    addAssistantTurn(this.callSid, this.tenant.greeting_standard).catch((err) =>
      console.error("[TRAINING] Failed to log greeting:", err),
    );
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

      // Start silence timer - the actual completeness check happens in processUserTurn
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

    // Process turn after short silence buffer
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

    // Use LLM to check if user's utterance is complete
    // This catches things like "I want to book for..." where user is still thinking
    const completeness = await checkUtteranceCompleteness(transcript);

    if (!completeness.isComplete) {
      console.log(
        `[TURN] Utterance incomplete, waiting for more: "${transcript}"`,
      );
      // Wait longer for user to finish their thought
      this.silenceTimer = setTimeout(() => {
        this.processUserTurn();
      }, INCOMPLETE_WAIT_MS);
      return;
    }

    this.isProcessing = true;
    console.log(`[TURN] Processing complete utterance: "${transcript}"`);

    // Clear transcript buffer
    this.state = clearTranscript(this.state);

    // Add to conversation history
    sessionManager.addMessage(this.callSid, "user", transcript);

    // Log user turn for training data
    addUserTurn(this.callSid, transcript).catch((err) =>
      console.error("[TRAINING] Failed to log user turn:", err),
    );

    try {
      // Generate response using multi-provider LLM with fallback (Gemini -> OpenAI -> Groq)
      const conversationHistory = sessionManager.getConversationHistory(
        this.callSid,
      );

      const toolContext = {
        tenantId: this.tenant.id,
        callSid: this.callSid,
        callerPhone: sessionManager.getSession(this.callSid)?.callerPhone,
        escalationPhone: this.tenant.escalation_phone,
      };

      const startTime = Date.now();

      // Use multi-provider fallback for resilience
      let llmResponse: LLMResponse = await multiProviderChat({
        userMessage: transcript,
        conversationHistory,
        systemPrompt: this.systemPrompt,
        tools: voiceAgentFunctions,
      });

      console.log(`[TURN] LLM response from ${llmResponse.provider}`);

      // Handle tool calls if present
      let responseText = llmResponse.text;
      let shouldEscalate = false;
      let escalationReason: string | undefined;

      if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
        console.log(
          `[TURN] Executing ${llmResponse.toolCalls.length} tool calls`,
        );

        const toolResults: Array<{
          id: string;
          name: string;
          result: unknown;
        }> = [];

        for (const tc of llmResponse.toolCalls) {
          console.log(`[TURN] Executing tool: ${tc.name}`, tc.args);

          // Check for transfer request
          if (tc.name === "transfer_to_human") {
            shouldEscalate = true;
            escalationReason = "user_requested_transfer";
          }

          const result = await executeTool(tc.name, tc.args, toolContext);
          toolResults.push({
            id: tc.id,
            name: tc.name,
            result,
          });

          // Check if booking was completed for escalation state
          if (
            tc.name === "create_booking" &&
            (result as { success?: boolean })?.success
          ) {
            // Mark task completed in escalation state
            this.escalationState.taskCompleted = true;
          }
        }

        // Send tool results back to get final response
        const options = {
          userMessage: transcript,
          conversationHistory,
          systemPrompt: this.systemPrompt,
          tools: voiceAgentFunctions,
        };

        const finalResponse = await sendToolResults(
          llmResponse.provider,
          options,
          toolResults,
        );

        responseText = finalResponse.text;
        console.log(`[TURN] Final response from ${finalResponse.provider}`);
      }

      const latencyMs = Date.now() - startTime;
      console.log(
        `[TURN] Response: "${responseText.substring(0, 100)}..." ` +
          `(provider: ${llmResponse.provider}, latency: ${latencyMs}ms)`,
      );

      // Add assistant response to history
      sessionManager.addMessage(this.callSid, "assistant", responseText);

      // Log assistant turn for training data
      addAssistantTurn(this.callSid, responseText).catch((err) =>
        console.error("[TRAINING] Failed to log assistant turn:", err),
      );

      // Handle escalation/transfer
      if (shouldEscalate) {
        console.log(`[TURN] Escalation triggered: ${escalationReason}`);
        if (this.tenant.escalation_phone) {
          this.callbacks.onTransferRequested(this.tenant.escalation_phone);
        }
      }

      // Speak response
      await this.speak(responseText);
      this.callbacks.onResponse(responseText);
    } catch (error) {
      console.error(`[TURN] Error processing turn:`, error);

      // Fallback response - only reached if ALL providers fail
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

  async cleanup(endReason: string = "completed"): Promise<void> {
    console.log(`[TURN] Cleaning up turn manager for ${this.callSid}`);

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    await Promise.all([this.transcriber?.stop(), this.tts?.disconnect()]);

    // Get session before ending it
    const session = sessionManager.getSession(this.callSid);

    // Save call record to database for analytics and review
    if (session) {
      saveCallRecord(session, endReason).catch((err) =>
        console.error("[CALL-LOGGER] Failed to save call record:", err),
      );
    }

    // End conversation logging with final metadata
    const duration = session
      ? Math.floor((Date.now() - session.startTime.getTime()) / 1000)
      : 0;

    endConversationLog(this.callSid, {
      durationSeconds: duration,
      outcomeSuccess: true, // Can be updated based on call outcome
    }).catch((err) =>
      console.error("[TRAINING] Failed to end conversation log:", err),
    );

    // Cleanup call state (retry counters, etc.)
    cleanupCall(this.callSid);
    sessionManager.endSession(this.callSid);
    this.callbacks.onCallEnd(endReason);
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
