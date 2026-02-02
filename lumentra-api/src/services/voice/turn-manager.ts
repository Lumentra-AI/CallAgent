// Turn Manager
// Orchestrates the voice conversation flow with streaming LLM responses

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
  streamChatWithFallback,
  streamToolResults,
} from "../llm/streaming-provider.js";
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
import { createSentenceBuffer } from "./sentence-buffer.js";
import type { Tenant } from "../../types/database.js";
import type WebSocket from "ws";

// Configuration - REDUCED for lower latency
const SILENCE_THRESHOLD_MS = 100; // Was 300 - reduced for faster response
const INCOMPLETE_WAIT_MS = 400; // Was 1200 - reduced for faster response
const MIN_TRANSCRIPT_LENGTH = 3; // Minimum characters before processing

// Natural thinking fillers - short, human-like
// These fire if LLM takes > FILLER_DELAY_MS to respond
const THINKING_FILLERS = [
  "Hmm...",
  "Let me see...",
  "Okay...",
  "Alright...",
  "Um...",
];

// Acknowledgment fillers - for statements/longer input
const ACKNOWLEDGMENT_FILLERS = [
  "I see.",
  "Got it.",
  "Right.",
  "Okay.",
  "Mm-hmm.",
];

// Processing fillers - for complex questions
const PROCESSING_FILLERS = [
  "Let me think...",
  "Good question...",
  "One moment...",
  "Let me check...",
];

// Filler timing - speak filler quickly if LLM is slow
const FILLER_DELAY_MIN_MS = 500; // Reduced from 800ms for faster perceived response
const FILLER_DELAY_MAX_MS = 800; // Reduced from 1200ms
const FILLER_SKIP_CHANCE = 0.3; // 30% chance to skip filler (speak more often)

// Filler responses for tool calls - spoken immediately while tool executes
const TOOL_FILLERS: Record<string, string> = {
  check_availability: "Let me check that for you.",
  create_booking: "One moment while I book that.",
  get_business_hours: "Let me look that up.",
  transfer_to_human: "I'll connect you with someone right away.",
  default: "One moment please.",
};

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

  // For parallel completeness checking
  private pendingCompletenessCheck: Promise<{ isComplete: boolean; latencyMs: number }> | null = null;

  // Natural filler tracking
  private lastFillerUsed: string | null = null;
  private fillerTimer: NodeJS.Timeout | null = null;
  private fillerSpoken = false;

  // Barge-in debounce - only interrupt TTS once per playback
  private bargeInHandled = false;

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
        scenarioType: "general",
      });

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
        // Log the actual audio format SignalWire is sending
        if (event.mediaFormat) {
          console.log(`[TURN] Audio format: ${event.mediaFormat.encoding} @ ${event.mediaFormat.sampleRate}Hz`);
        }
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
    console.log(`[TURN] Connecting TTS and STT services...`);
    const [ttsResult, sttResult] = await Promise.allSettled([
      this.tts.connect(),
      this.transcriber.start(),
    ]);

    if (ttsResult.status === "rejected") {
      console.error(`[TURN] TTS connection failed:`, ttsResult.reason);
      throw new Error("TTS initialization failed - cannot proceed without voice output");
    }
    console.log(`[TURN] TTS connected successfully`);

    if (sttResult.status === "rejected") {
      console.error(`[TURN] STT connection failed:`, sttResult.reason);
      console.error(`[TURN] CRITICAL: Caller speech will NOT be recognized!`);
      this.transcriber = null;
    } else {
      console.log(`[TURN] STT connected successfully - ready for speech recognition`);
    }

    // Speak greeting and log it
    await this.speak(this.tenant.greeting_standard);
    addAssistantTurn(this.callSid, this.tenant.greeting_standard).catch((err) =>
      console.error("[TRAINING] Failed to log greeting:", err),
    );
  }

  private audioChunkCount = 0;
  private lastAudioLogTime = 0;

  private handleIncomingAudio(audioBuffer: Buffer): void {
    this.audioChunkCount++;

    const now = Date.now();
    if (now - this.lastAudioLogTime > 2000) {
      console.log(`[TURN] Received ${this.audioChunkCount} audio chunks, STT active: ${!!this.transcriber}`);
      this.lastAudioLogTime = now;
    }

    if (this.transcriber) {
      this.transcriber.sendAudio(audioBuffer);
    }
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

      // Start completeness check in parallel (don't await)
      // This runs while we wait for the silence threshold
      this.pendingCompletenessCheck = checkUtteranceCompleteness(text);

      // Start silence timer
      this.silenceTimer = setTimeout(() => {
        this.processUserTurn();
      }, SILENCE_THRESHOLD_MS);
    }
  }

  private handleSpeechStarted(): void {
    console.log(`[TURN] User started speaking`);
    sessionManager.setSpeaking(this.callSid, true);

    // Check for barge-in (interrupt TTS) - only once per TTS playback
    const session = sessionManager.getSession(this.callSid);
    if (session?.isPlaying && !this.bargeInHandled) {
      console.log(`[TURN] Barge-in detected, interrupting TTS`);
      this.bargeInHandled = true; // Prevent repeated interrupts
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

  /**
   * Process user turn with STREAMING LLM response
   * This is the core of the low-latency architecture
   */
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

    // Use the parallel completeness check result if available
    if (this.pendingCompletenessCheck) {
      try {
        const completeness = await this.pendingCompletenessCheck;
        if (!completeness.isComplete) {
          console.log(`[TURN] Utterance incomplete, waiting: "${transcript}"`);
          this.silenceTimer = setTimeout(() => {
            this.pendingCompletenessCheck = null; // Don't check again
            this.processUserTurn();
          }, INCOMPLETE_WAIT_MS);
          return;
        }
      } catch (error) {
        console.error(`[TURN] Completeness check failed, proceeding:`, error);
      }
      this.pendingCompletenessCheck = null;
    }

    this.isProcessing = true;
    this.fillerSpoken = false; // Reset for this turn
    const startTime = Date.now();
    console.log(`[TURN] Processing with streaming: "${transcript}"`);

    // Clear transcript buffer
    this.state = clearTranscript(this.state);

    // Add to conversation history
    sessionManager.addMessage(this.callSid, "user", transcript);

    // Log user turn for training data
    addUserTurn(this.callSid, transcript).catch((err) =>
      console.error("[TRAINING] Failed to log user turn:", err),
    );

    try {
      const conversationHistory = sessionManager.getConversationHistory(this.callSid);
      const toolContext = {
        tenantId: this.tenant.id,
        callSid: this.callSid,
        callerPhone: sessionManager.getSession(this.callSid)?.callerPhone,
        escalationPhone: this.tenant.escalation_phone,
      };

      // Stream the response
      const stream = streamChatWithFallback({
        userMessage: transcript,
        conversationHistory,
        systemPrompt: this.systemPrompt,
        tools: voiceAgentFunctions,
      });

      const sentenceBuffer = createSentenceBuffer();
      let fullResponse = "";
      let isFirstChunk = true;
      let currentProvider = "unknown";
      let shouldEscalate = false;

      // Start filler timer - will speak natural filler if LLM is slow
      this.startFillerTimer(transcript);

      for await (const chunk of stream) {
        // Handle errors
        if (chunk.type === "error") {
          console.error(`[TURN] Stream error: ${chunk.error}`);
          continue;
        }

        // Track provider
        if (chunk.provider) {
          currentProvider = chunk.provider;
        }

        // Handle tool calls - speak filler immediately
        if (chunk.type === "tool_call" && chunk.toolCall) {
          this.cancelFillerTimer(); // Cancel thinking filler, tool has its own
          const { id, name, args } = chunk.toolCall;
          console.log(`[TURN] Tool call: ${name}`, args);

          // Speak filler IMMEDIATELY while tool executes
          const filler = TOOL_FILLERS[name] || TOOL_FILLERS.default;
          this.speakChunk(filler, false);

          // Check for transfer
          if (name === "transfer_to_human") {
            shouldEscalate = true;
          }

          // Execute tool
          const result = await executeTool(name, args, toolContext);

          // Track booking completion
          if (name === "create_booking" && (result as { success?: boolean })?.success) {
            this.escalationState.taskCompleted = true;
          }

          // Stream tool result response
          const toolResultStream = streamToolResults(
            currentProvider,
            {
              userMessage: transcript,
              conversationHistory,
              systemPrompt: this.systemPrompt,
              tools: voiceAgentFunctions,
            },
            [{ id, name, result }],
          );

          // Continue streaming from tool result (tool filler already spoken, so continue)
          for await (const resultChunk of toolResultStream) {
            if (resultChunk.type === "text" && resultChunk.content) {
              fullResponse += resultChunk.content;

              // Buffer and speak sentences as they complete
              const sentences = sentenceBuffer.add(resultChunk.content);
              for (const sentence of sentences) {
                // Tool filler was spoken, so always continue
                this.speakChunk(sentence, true);
                isFirstChunk = false;
              }
            }
          }

          continue;
        }

        // Handle text chunks
        if (chunk.type === "text" && chunk.content) {
          fullResponse += chunk.content;

          // Log first token latency and cancel filler timer
          if (isFirstChunk) {
            this.cancelFillerTimer(); // LLM responded fast, no filler needed
            const ttft = Date.now() - startTime;
            console.log(`[TURN] Time to first token: ${ttft}ms (${currentProvider})`);
          }

          // Buffer and speak sentences as they complete
          const sentences = sentenceBuffer.add(chunk.content);
          for (const sentence of sentences) {
            const ttfs = Date.now() - startTime;
            // If filler was spoken, continue from it; otherwise start fresh on first chunk
            const shouldContinue = this.fillerSpoken || !isFirstChunk;
            console.log(`[TURN] Speaking sentence (${ttfs}ms): "${sentence.substring(0, 40)}..." (continue: ${shouldContinue})`);
            this.speakChunk(sentence, shouldContinue);
            isFirstChunk = false;
          }
        }

        // Handle stream completion
        if (chunk.type === "done") {
          // Flush any remaining buffered text
          const remaining = sentenceBuffer.flush();
          if (remaining) {
            const ttfs = Date.now() - startTime;
            // Final chunk should NEVER continue - this closes the prosody properly
            console.log(`[TURN] Flushing final (${ttfs}ms): "${remaining.substring(0, 40)}..." (continue: false)`);
            this.speakChunk(remaining, false);
          }
        }
      }

      const totalLatency = Date.now() - startTime;
      console.log(
        `[TURN] Response complete: "${fullResponse.substring(0, 100)}..." ` +
          `(provider: ${currentProvider}, total: ${totalLatency}ms)`,
      );

      // Add assistant response to history
      if (fullResponse) {
        sessionManager.addMessage(this.callSid, "assistant", fullResponse);

        // Log assistant turn for training data
        addAssistantTurn(this.callSid, fullResponse).catch((err) =>
          console.error("[TRAINING] Failed to log assistant turn:", err),
        );

        this.callbacks.onResponse(fullResponse);
      }

      // Handle escalation/transfer
      if (shouldEscalate && this.tenant.escalation_phone) {
        console.log(`[TURN] Escalation triggered`);
        this.callbacks.onTransferRequested(this.tenant.escalation_phone);
      }

    } catch (error) {
      console.error(`[TURN] Error processing turn:`, error);

      // Fallback response
      const fallback = "I'm sorry, I'm having trouble processing that. Could you please repeat?";
      await this.speak(fallback);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Speak a chunk of text using streaming TTS
   */
  private speakChunk(text: string, isContinuation: boolean): void {
    if (!this.tts || !text.trim()) return;

    sessionManager.setPlaying(this.callSid, true);
    this.bargeInHandled = false; // Reset barge-in flag for new TTS playback
    this.tts.speakChunk(text, isContinuation);
  }

  /**
   * Speak full text (for greetings, etc.)
   */
  private async speak(text: string): Promise<void> {
    if (!this.tts) {
      console.warn(`[TURN] TTS not initialized`);
      return;
    }

    sessionManager.setPlaying(this.callSid, true);
    this.bargeInHandled = false; // Reset barge-in flag for new TTS playback
    this.tts.speak(text);
  }

  /**
   * Select a natural filler based on input context
   * Avoids repeating the same filler twice in a row
   */
  private selectFiller(userInput: string): string {
    // Categorize input to pick appropriate filler type
    const isQuestion = userInput.includes("?") ||
      /^(what|where|when|why|how|can|do|is|are|will|would|could)\b/i.test(userInput);
    const isLong = userInput.length > 30;

    let pool: string[];
    if (isQuestion && isLong) {
      pool = PROCESSING_FILLERS;
    } else if (isQuestion) {
      pool = THINKING_FILLERS;
    } else if (isLong) {
      pool = ACKNOWLEDGMENT_FILLERS;
    } else {
      pool = THINKING_FILLERS;
    }

    // Filter out last used filler to avoid repetition
    const available = pool.filter(f => f !== this.lastFillerUsed);
    const selected = available[Math.floor(Math.random() * available.length)] || pool[0];

    this.lastFillerUsed = selected;
    return selected;
  }

  /**
   * Start filler timer - will speak a natural filler if LLM is slow
   */
  private startFillerTimer(userInput: string): void {
    // Random chance to skip filler (natural variation)
    if (Math.random() < FILLER_SKIP_CHANCE) {
      return;
    }

    // Randomize delay for naturalness
    const delay = FILLER_DELAY_MIN_MS + Math.random() * (FILLER_DELAY_MAX_MS - FILLER_DELAY_MIN_MS);

    this.fillerSpoken = false;
    this.fillerTimer = setTimeout(() => {
      if (!this.fillerSpoken) {
        const filler = this.selectFiller(userInput);
        console.log(`[TURN] Speaking filler: "${filler}"`);
        this.speakChunk(filler, false);
        this.fillerSpoken = true;
      }
    }, delay);
  }

  /**
   * Cancel filler timer (called when LLM responds quickly)
   */
  private cancelFillerTimer(): void {
    if (this.fillerTimer) {
      clearTimeout(this.fillerTimer);
      this.fillerTimer = null;
    }
  }

  private checkForPendingResponse(): void {
    const session = sessionManager.getSession(this.callSid);
    if (session?.isSpeaking) {
      return;
    }

    const transcript = getCompleteTranscript(this.state);
    if (transcript.length >= MIN_TRANSCRIPT_LENGTH) {
      this.processUserTurn();
    }
  }

  async cleanup(endReason: string = "completed"): Promise<void> {
    console.log(`[TURN] Cleaning up turn manager for ${this.callSid}`);

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    this.cancelFillerTimer();

    await Promise.all([this.transcriber?.stop(), this.tts?.disconnect()]);

    const session = sessionManager.getSession(this.callSid);

    if (session) {
      saveCallRecord(session, endReason).catch((err) =>
        console.error("[CALL-LOGGER] Failed to save call record:", err),
      );
    }

    const duration = session
      ? Math.floor((Date.now() - session.startTime.getTime()) / 1000)
      : 0;

    endConversationLog(this.callSid, {
      durationSeconds: duration,
      outcomeSuccess: true,
    }).catch((err) =>
      console.error("[TRAINING] Failed to end conversation log:", err),
    );

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
