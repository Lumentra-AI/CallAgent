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
import { streamChatWithFallback } from "../llm/streaming-provider.js";
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
// import { checkUtteranceCompleteness } from "../gemini/intent-check.js"; // Replaced with fast rule-based check
import { createSentenceBuffer } from "./sentence-buffer.js";
import type { Tenant } from "../../types/database.js";
import type WebSocket from "ws";

// Configuration - BALANCED for natural conversation
// Trade-off: faster response vs waiting for complete thoughts
const SILENCE_THRESHOLD_MS = 400; // Wait after final transcript before processing
const INCOMPLETE_WAIT_MS = 600; // Extra wait for incomplete utterances
const MAX_ACCUMULATION_MS = 3000; // Max time to accumulate before forcing process
const MIN_TRANSCRIPT_LENGTH = 3; // Minimum characters before processing

/**
 * Utterance completeness check
 * Returns: 'complete' | 'incomplete' | 'maybe'
 * - complete: Process immediately
 * - incomplete: Wait for more input
 * - maybe: Wait a bit, then process
 */
function checkUtteranceCompleteness(
  text: string,
): "complete" | "incomplete" | "maybe" {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Very short - wait for more
  if (trimmed.length < 4) return "incomplete";

  // Ends with sentence-ending punctuation - complete!
  if (/[.!?]$/.test(trimmed)) return "complete";

  // Common complete short responses (exact matches)
  const definitelyComplete = [
    /^(yes|yeah|yep|yup|no|nope|nah|okay|ok|sure|thanks|thank you|bye|goodbye|hello|hi|hey)$/i,
    /^(that's all|that's it|nothing else|no thanks|yes please|no thank you)$/i,
    /^(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s*(night|nights|day|days|person|people|guest|guests)?$/i,
    /^(tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
    /^(just me|just one|for one|for two)$/i,
  ];
  if (definitelyComplete.some((p) => p.test(lower))) return "complete";

  // Definitely incomplete - user is mid-thought
  const definitelyIncomplete = [
    /\b(i want to|i need to|i'd like to|can you|could you|would you|let me|i'm going to)$/i,
    /\b(and|but|or|so|because|if|when|then|also)$/i,
    /\b(the|a|an|my|your|this|that|for|from|to|in|on|at|with)$/i,
    /\b(i|we|they|he|she|it|you)$/i, // Ends with pronoun alone
    /\b(um|uh|hmm|like|well|so)$/i, // Filler words
    /\b(some|any|few|more|less)$/i, // Quantifiers without object
  ];
  if (definitelyIncomplete.some((p) => p.test(lower))) return "incomplete";

  // Looks like a complete thought (4+ words, no trailing incomplete patterns)
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount >= 4) return "complete";

  // 2-3 words without punctuation - wait a bit
  return "maybe";
}

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

// Filler timing - DISABLED: Let LLM decide when to use natural pauses via Sonic-3 tags
// The LLM can use <break>, [laughter], etc. contextually via master voice prompt
const FILLER_DELAY_MIN_MS = 300; // Unused - fillers disabled
const FILLER_DELAY_MAX_MS = 500; // Unused - fillers disabled
const FILLER_SKIP_CHANCE = 1.0; // Skip all code-based fillers - LLM handles naturalness

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
  private escalationState: EscalationState;

  // For parallel completeness checking
  private pendingCompletenessCheck: Promise<{
    isComplete: boolean;
    latencyMs: number;
  }> | null = null;

  // Natural filler tracking
  private lastFillerUsed: string | null = null;
  private fillerTimer: NodeJS.Timeout | null = null;
  private fillerSpoken = false;

  // Barge-in debounce - only interrupt TTS once per playback
  private bargeInHandled = false;
  private ttsStartTime: number | null = null; // Track when TTS started playing

  // Race condition protection - prevents double processing of same transcript
  private processingLock = false;
  private pendingTranscript = false;

  // Utterance accumulation - tracks when we started collecting fragments
  private accumulationStartTime: number | null = null;

  // Cleanup guard - prevents duplicate cleanup execution
  private isCleanedUp = false;

  // Abort controller - cancels in-flight LLM requests on cleanup
  private abortController: AbortController | null = null;

  // Greeting protection - prevents interruption of initial greeting
  private greetingInProgress = false;

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
          console.log(
            `[TURN] Audio format: ${event.mediaFormat.encoding} @ ${event.mediaFormat.sampleRate}Hz`,
          );
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
      throw new Error(
        "TTS initialization failed - cannot proceed without voice output",
      );
    }
    console.log(`[TURN] TTS connected successfully`);

    if (sttResult.status === "rejected") {
      console.error(`[TURN] STT connection failed:`, sttResult.reason);
      console.error(`[TURN] CRITICAL: Caller speech will NOT be recognized!`);
      this.transcriber = null;
    } else {
      console.log(
        `[TURN] STT connected successfully - ready for speech recognition`,
      );
    }

    // Speak greeting and log it
    // CRITICAL: Mark greeting as in-progress to prevent interruption
    this.greetingInProgress = true;
    await this.speak(this.tenant.greeting_standard);
    this.greetingInProgress = false;

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
      console.log(
        `[TURN] Received ${this.audioChunkCount} audio chunks, STT active: ${!!this.transcriber}`,
      );
      this.lastAudioLogTime = now;
    }

    if (this.transcriber) {
      this.transcriber.sendAudio(audioBuffer);
    }
  }

  private handleTranscript(text: string, isFinal: boolean): void {
    this.state = updateTranscript(this.state, text, isFinal);

    if (isFinal) {
      console.log(`[TURN] Final transcript: "${text}"`);
      // Schedule processing - consolidated timer management
      this.scheduleProcessing();
    }
  }

  private handleSpeechStarted(): void {
    console.log(`[TURN] User started speaking`);
    sessionManager.setSpeaking(this.callSid, true);

    // Cancel any pending processing - user is still talking
    this.cancelScheduledProcessing();

    // Start accumulation timer if not already started
    if (!this.accumulationStartTime) {
      this.accumulationStartTime = Date.now();
    }

    // Check for barge-in (interrupt TTS) - only once per TTS playback
    const session = sessionManager.getSession(this.callSid);
    if (session?.isPlaying && !this.bargeInHandled) {
      // CRITICAL: Never interrupt the initial greeting
      if (this.greetingInProgress) {
        console.log(
          `[TURN] Ignoring speech during greeting - user must hear who they're talking to`,
        );
        return;
      }

      // BARGE-IN DELAY: Prevent false positives from echo/VAD sensitivity
      // Don't allow interruption for first 800ms of TTS playback
      const MIN_TTS_DURATION_MS = 800;
      const ttsDuration = this.ttsStartTime
        ? Date.now() - this.ttsStartTime
        : 999999;

      if (ttsDuration < MIN_TTS_DURATION_MS) {
        console.log(
          `[TURN] Ignoring potential false-positive barge-in (TTS played for ${ttsDuration}ms, need ${MIN_TTS_DURATION_MS}ms)`,
        );
        return;
      }

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

    // Schedule processing if not already scheduled
    this.scheduleProcessing();
  }

  /**
   * Consolidated timer management - only ONE place schedules processing
   * Prevents race conditions from multiple timers
   */
  private scheduleProcessing(): void {
    // Clear any existing timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      this.processUserTurn();
    }, SILENCE_THRESHOLD_MS);
  }

  /**
   * Cancel scheduled processing (e.g., when user starts speaking again)
   */
  private cancelScheduledProcessing(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /**
   * Process user turn with STREAMING LLM response
   * This is the core of the low-latency architecture
   */
  private async processUserTurn(): Promise<void> {
    // LOCK CHECK - Prevents race condition where two calls enter simultaneously
    // Must be the FIRST thing we check, before any transcript access
    if (this.processingLock) {
      console.log(`[TURN] Processing locked, marking pending`);
      this.pendingTranscript = true;
      return;
    }

    // ACQUIRE LOCK IMMEDIATELY - before any other operations
    this.processingLock = true;

    const transcript = getCompleteTranscript(this.state);
    if (transcript.length < MIN_TRANSCRIPT_LENGTH) {
      console.log(`[TURN] Transcript too short, ignoring: "${transcript}"`);
      this.processingLock = false;
      this.accumulationStartTime = null;
      return;
    }

    // Track when we started accumulating (for max wait timeout)
    if (!this.accumulationStartTime) {
      this.accumulationStartTime = Date.now();
    }

    // Check if we've been accumulating too long (force process)
    const accumulationTime = Date.now() - this.accumulationStartTime;
    const forceProcess = accumulationTime >= MAX_ACCUMULATION_MS;

    // Completeness check
    const completeness = checkUtteranceCompleteness(transcript);
    console.log(
      `[TURN] Completeness: "${transcript.substring(0, 40)}..." -> ${completeness} (accumulated: ${accumulationTime}ms)`,
    );

    // Decide whether to wait or process
    if (!forceProcess) {
      if (completeness === "incomplete") {
        console.log(`[TURN] Waiting for user to finish`);
        this.processingLock = false;
        this.silenceTimer = setTimeout(() => {
          this.silenceTimer = null;
          this.processUserTurn();
        }, INCOMPLETE_WAIT_MS);
        return;
      }

      if (completeness === "maybe") {
        console.log(`[TURN] Maybe complete, waiting a bit more`);
        this.processingLock = false;
        this.silenceTimer = setTimeout(() => {
          this.silenceTimer = null;
          this.processUserTurn();
        }, SILENCE_THRESHOLD_MS);
        return;
      }
    } else {
      console.log(`[TURN] Max accumulation time reached, forcing process`);
    }

    // COMPLETE - proceed with LLM call
    // Reset accumulation tracking
    this.accumulationStartTime = null;

    // Legacy LLM-based check (disabled by default - too slow)
    if (this.pendingCompletenessCheck) {
      this.pendingCompletenessCheck = null;
    }

    this.fillerSpoken = false;
    const startTime = Date.now();
    console.log(`[TURN] Processing: "${transcript}"`);

    // Create abort controller for this request
    this.abortController = new AbortController();

    // Clear transcript buffer
    this.state = clearTranscript(this.state);

    // Add to conversation history
    sessionManager.addMessage(this.callSid, "user", transcript);

    // Log user turn for training data
    addUserTurn(this.callSid, transcript).catch((err) =>
      console.error("[TRAINING] Failed to log user turn:", err),
    );

    try {
      const conversationHistory = sessionManager.getConversationHistory(
        this.callSid,
      );
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
        // Check if call was terminated
        if (!this.shouldContinueProcessing()) {
          console.log(`[TURN] Stopping stream processing for ${this.callSid}`);
          break;
        }

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

          // Add assistant message with tool_calls to history BEFORE executing tool
          // This is required for OpenAI's API - tool results must follow tool_calls
          sessionManager.addMessage(this.callSid, "assistant", "", {
            toolCalls: [{ id, name, args }],
          });

          // Speak filler IMMEDIATELY while tool executes
          const filler = TOOL_FILLERS[name] || TOOL_FILLERS.default;
          this.speakChunk(filler, false);

          // Check for transfer
          if (name === "transfer_to_human") {
            shouldEscalate = true;
          }

          // Execute tool
          const result = await executeTool(name, args, toolContext);

          // Save tool result to conversation history
          // This is required for OpenAI's API - tool results must follow tool_calls
          sessionManager.addMessage(this.callSid, "tool", "", {
            toolCallId: id,
            toolName: name,
            toolResult:
              typeof result === "string" ? result : JSON.stringify(result),
          });

          // Track booking completion
          if (
            name === "create_booking" &&
            (result as { success?: boolean })?.success
          ) {
            this.escalationState.taskCompleted = true;
          }

          // Get FRESH conversation history that includes the tool_calls and tool result we just added
          // CRITICAL: Using stale history causes OpenAI error "tool must follow tool_calls"
          const updatedHistory = sessionManager.getConversationHistory(
            this.callSid,
          );

          // Stream response based on tool results
          // Don't pass toolResults array - they're already in updatedHistory
          const toolResultStream = streamChatWithFallback({
            userMessage: "", // Continue from tool results in history
            conversationHistory: updatedHistory,
            systemPrompt: this.systemPrompt,
            tools: voiceAgentFunctions,
          });

          // Continue streaming from tool result
          let isFirstToolResultChunk = true;
          for await (const resultChunk of toolResultStream) {
            // Check if call was terminated
            if (!this.shouldContinueProcessing()) {
              console.log(
                `[TURN] Stopping tool result streaming for ${this.callSid}`,
              );
              break;
            }

            if (resultChunk.type === "text" && resultChunk.content) {
              fullResponse += resultChunk.content;

              // Buffer and speak sentences as they complete
              const sentences = sentenceBuffer.add(resultChunk.content);
              for (const sentence of sentences) {
                // First chunk starts fresh (filler is separate), subsequent chunks continue
                this.speakChunk(sentence, !isFirstToolResultChunk);
                isFirstToolResultChunk = false;
                isFirstChunk = false;
              }
            } else if (resultChunk.type === "done") {
              // Flush any remaining buffered text from tool result
              const remaining = sentenceBuffer.flush();
              if (remaining) {
                // Final chunk should use continue: false to properly close prosody
                this.speakChunk(remaining, false);
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
            console.log(
              `[TURN] Time to first token: ${ttft}ms (${currentProvider})`,
            );
          }

          // Buffer and speak sentences as they complete
          const sentences = sentenceBuffer.add(chunk.content);
          for (const sentence of sentences) {
            const ttfs = Date.now() - startTime;
            // If filler was spoken, continue from it; otherwise start fresh on first chunk
            const shouldContinue = this.fillerSpoken || !isFirstChunk;
            console.log(
              `[TURN] Speaking sentence (${ttfs}ms): "${sentence.substring(0, 40)}..." (continue: ${shouldContinue})`,
            );
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
            console.log(
              `[TURN] Flushing final (${ttfs}ms): "${remaining.substring(0, 40)}..." (continue: false)`,
            );
            this.speakChunk(remaining, false);
          }
        }
      }

      const totalLatency = Date.now() - startTime;
      console.log(
        `[TURN] Response complete: "${fullResponse.substring(0, 100)}..." ` +
          `(provider: ${currentProvider}, total: ${totalLatency}ms)`,
      );

      // Add assistant response to history (check session exists first)
      if (fullResponse && this.shouldContinueProcessing()) {
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
      const fallback =
        "I'm sorry, I'm having trouble processing that. Could you please repeat?";
      await this.speak(fallback);
    } finally {
      this.processingLock = false;

      // Check if new transcript arrived while we were processing
      if (this.pendingTranscript) {
        this.pendingTranscript = false;
        const pendingText = getCompleteTranscript(this.state);
        if (pendingText.length >= MIN_TRANSCRIPT_LENGTH) {
          console.log(
            `[TURN] Processing pending transcript: "${pendingText.substring(0, 30)}..."`,
          );
          // Use setTimeout to avoid stack overflow on rapid inputs
          setTimeout(() => this.processUserTurn(), 0);
        }
      }
    }
  }

  /**
   * Check if processing should continue (call not aborted)
   */
  private shouldContinueProcessing(): boolean {
    if (this.isCleanedUp) {
      console.log(
        `[TURN] Call ${this.callSid} cleaned up, stopping processing`,
      );
      return false;
    }
    if (this.abortController?.signal.aborted) {
      console.log(
        `[TURN] Request aborted for ${this.callSid}, stopping processing`,
      );
      return false;
    }
    return true;
  }

  /**
   * Speak a chunk of text using streaming TTS
   */
  private speakChunk(text: string, isContinuation: boolean): void {
    if (!this.tts || !text.trim()) return;

    // Check if session still exists (call may have ended)
    const session = sessionManager.getSession(this.callSid);
    if (!session) {
      console.log(
        `[TURN] Session ${this.callSid} no longer exists, skipping TTS`,
      );
      return;
    }

    sessionManager.setPlaying(this.callSid, true);
    this.bargeInHandled = false; // Reset barge-in flag for new TTS playback
    this.ttsStartTime = Date.now(); // Track when TTS started for barge-in delay
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

    // Check if session still exists (call may have ended)
    const session = sessionManager.getSession(this.callSid);
    if (!session) {
      console.log(
        `[TURN] Session ${this.callSid} no longer exists, skipping TTS`,
      );
      return;
    }

    sessionManager.setPlaying(this.callSid, true);
    this.bargeInHandled = false; // Reset barge-in flag for new TTS playback
    this.ttsStartTime = Date.now(); // Track when TTS started for barge-in delay
    this.tts.speak(text);
  }

  /**
   * Select a natural filler based on input context
   * Avoids repeating the same filler twice in a row
   */
  private selectFiller(userInput: string): string {
    // Categorize input to pick appropriate filler type
    const isQuestion =
      userInput.includes("?") ||
      /^(what|where|when|why|how|can|do|is|are|will|would|could)\b/i.test(
        userInput,
      );
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
    const available = pool.filter((f) => f !== this.lastFillerUsed);
    const selected =
      available[Math.floor(Math.random() * available.length)] || pool[0];

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
    const delay =
      FILLER_DELAY_MIN_MS +
      Math.random() * (FILLER_DELAY_MAX_MS - FILLER_DELAY_MIN_MS);

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
    if (this.isCleanedUp) {
      console.log(
        `[TURN] Already cleaned up ${this.callSid}, skipping duplicate cleanup`,
      );
      return;
    }
    this.isCleanedUp = true;

    console.log(`[TURN] Cleaning up turn manager for ${this.callSid}`);

    // Cancel any in-flight LLM requests FIRST
    if (this.abortController) {
      console.log(`[TURN] Aborting in-flight LLM request for ${this.callSid}`);
      this.abortController.abort();
      this.abortController = null;
    }

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
