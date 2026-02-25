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
import {
  AudioPipelineStateMachine,
  PipelineState,
} from "./audio-pipeline-state.js";
import { buildSystemPrompt, cleanupCall } from "../gemini/chat.js";
import { streamChatWithFallback } from "../llm/streaming-provider.js";
import { voiceAgentFunctions, executeTool } from "../gemini/tools.js";
import {
  createTranscriber,
  type DeepgramTranscriber,
} from "../deepgram/transcriber.js";
import {
  createTTS,
  type CartesiaTTS,
  type WordTimestamp,
} from "../cartesia/tts.js";
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

// === Vapi-inspired layered endpointing configuration ===
// Layer 1: Context-aware (assistant asked for structured data)
const STRUCTURED_DATA_WAIT_MS = 1400; // Name, phone, address, email - still allow thinking time
const DATE_COLLECTION_WAIT_MS = 1000; // Date/time collection

// Layer 2: Filler detection
const FILLER_WAIT_MS = 1000; // Caller is thinking (umm, uh, etc.)

// Layer 3: Transcription heuristics (Vapi-style punctuation/number/no-punctuation)
const ON_PUNCTUATION_MS = 180; // Text ends with .!? - likely complete
const ON_NUMBER_MS = 450; // Text ends with a number - might be part of longer sequence
const ON_NO_PUNCTUATION_MS = 520; // No punctuation - user may still be talking

// General
const INCOMPLETE_WAIT_MS = 550; // Structurally incomplete (ends with "the", "for", etc.)
const MAX_ACCUMULATION_MS = 3000; // Max time per speech burst before forcing process
const MAX_INCOMPLETE_ACCUMULATION_MS = 5500; // Extra time for obviously unfinished speech
const ACTIVE_SPEECH_RECHECK_MS = 220; // Recheck timer while STT still reports active speaking
const MAX_ACTIVE_SPEECH_WAIT_MS = 7000; // Safety cap if STT speaking flag gets stuck true
const MIN_TRANSCRIPT_LENGTH = 3; // Minimum characters before processing
const INTERIM_FINALIZATION_WAIT_MS = 120; // Briefly wait for Deepgram final to replace interim text
const BARGE_IN_TRANSCRIPT_WAIT_MS = 220; // Wait for transcript before deciding barge-in
const GREEDY_CANCEL_CONFIRM_MS = 250; // Wait for transcript before aborting LLM (Vapi/Retell pattern)
const SPEECH_STARTED_DEBOUNCE_MS = 200; // Ignore rapid-fire duplicate SpeechStarted events
const MIN_BARGE_IN_INTERIM_CHARS = 8; // Require meaningful interim speech before interrupting TTS
const FINAL_TRANSCRIPT_DEDUPE_MS = 1500; // Ignore duplicate final transcripts emitted in quick succession

// Acknowledgement phrases - these should NOT trigger barge-in during TTS
// Vapi pattern: user says "yeah" or "uh-huh" while listening, not interrupting
const ACKNOWLEDGEMENT_PHRASES = new Set([
  "yeah",
  "yes",
  "yep",
  "yup",
  "okay",
  "ok",
  "right",
  "uh-huh",
  "uh huh",
  "mm-hmm",
  "mm hmm",
  "mmhmm",
  "mhm",
  "got it",
  "sure",
  "alright",
  "correct",
  "that's right",
]);

/**
 * Utterance completeness check
 * Returns: 'complete' | 'incomplete' | 'filler' | 'maybe'
 * - complete: Process immediately
 * - incomplete: Wait for more input (INCOMPLETE_WAIT_MS)
 * - filler: Caller is thinking - wait extra long (FILLER_WAIT_MS)
 * - maybe: Wait a bit, then process (SILENCE_THRESHOLD_MS)
 */
function checkUtteranceCompleteness(
  text: string,
): "complete" | "incomplete" | "filler" | "maybe" {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const lowerSansTrailingPunct = lower.replace(/[.!?]+$/g, "").trim();

  // Empty
  if (!trimmed) return "incomplete";

  // Check for filler words FIRST - caller is thinking, give them time
  // Matches: um, umm, ummm, uh, uhh, hmm, hmmm, mm, mmm, ah, ahh, er, err
  const fillerPattern = /\b(u+m+|u+h+|h+m+|m+m+|a+h+|e+r+|you know)\s*$/i;
  if (fillerPattern.test(lower)) return "filler";

  // Also check if the ONLY content is filler words (e.g. "umm yeah umm")
  const allFillers =
    /^(\s*(u+m+|u+h+|h+m+|m+m+|a+h+|e+r+|you know|like|well|so|yeah|ok)\s*)+$/i;
  if (allFillers.test(lower)) return "filler";

  // Bridge words are usually mid-thought even if STT inserts punctuation ("Okay. So.").
  if (/\b(and|but|or|so|because|if|when|then|also)[.!?]?$/i.test(lower)) {
    return "incomplete";
  }

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
  if (
    definitelyComplete.some(
      (p) => p.test(lower) || p.test(lowerSansTrailingPunct),
    )
  ) {
    return "complete";
  }

  // Very short and no explicit completion signal - wait for more
  if (trimmed.length < 4) return "incomplete";

  // Definitely incomplete - user is mid-thought
  const definitelyIncomplete = [
    /\b(i want to|i need to|i'd like to|can you|could you|would you|let me|i'm going to)$/i,
    /\b(and|but|or|so|because|if|when|then|also)$/i,
    /\b(the|a|an|my|your|this|that|for|from|to|in|on|at|with)$/i,
    /\b(i|we|they|he|she|it|you)$/i, // Ends with pronoun alone
    /\b(like|well)$/i, // Filler words used mid-sentence
    /\b(some|any|few|more|less)$/i, // Quantifiers without object
  ];
  if (definitelyIncomplete.some((p) => p.test(lower))) return "incomplete";

  // Check total word count
  const wordCount = trimmed.split(/\s+/).length;

  // 4+ words - but check if the LAST fragment (after final punctuation) is incomplete
  // e.g. "Three days. For three" -> last fragment "For three" is mid-sentence
  if (wordCount >= 4) {
    const lastSentenceEnd = Math.max(
      trimmed.lastIndexOf("."),
      trimmed.lastIndexOf("!"),
      trimmed.lastIndexOf("?"),
    );
    if (lastSentenceEnd > 0 && lastSentenceEnd < trimmed.length - 1) {
      const lastFragment = trimmed.substring(lastSentenceEnd + 1).trim();
      if (lastFragment.length > 0 && lastFragment.split(/\s+/).length <= 3) {
        // Trailing fragment is short without punctuation - user likely mid-sentence
        return "maybe";
      }
    }
    return "complete";
  }

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
const TOOL_FILLERS: Record<string, string[]> = {
  check_availability: [
    "Let me check that for you.",
    "One second, checking now.",
    "Give me a moment to look that up.",
  ],
  create_booking: [
    "Perfect, I'll lock that in now.",
    "One moment while I book that.",
    "Got it, booking that now.",
  ],
  get_business_hours: [
    "Let me pull that up.",
    "One sec, checking hours now.",
    "I'll look that up right now.",
  ],
  transfer_to_human: [
    "I'll connect you with someone right away.",
    "Alright, transferring you now.",
    "Sure, putting you through now.",
  ],
  default: ["One moment please.", "One sec.", "Got it, give me a moment."],
};

const RECOVERY_RESPONSES = [
  "Sorry, could you say that one more time?",
  "I missed that. Can you repeat it quickly?",
  "Sorry, say that again for me.",
];

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

  // Barge-in debounce - only interrupt TTS once per response
  private bargeInHandled = false;
  private ttsStartTime: number | null = null; // Track when first TTS chunk started for this response

  // Deferred barge-in - wait for transcript to check acknowledgement phrases
  private pendingBargeIn = false;
  private bargeInTimer: NodeJS.Timeout | null = null;

  // Greedy cancel - save transcript for restore on abort
  private lastProcessedTranscript: string | null = null;

  // Deferred greedy cancel - require transcript confirmation before aborting LLM
  // Vapi/Retell pattern: raw SpeechStarted events are often noise/echo, not real speech
  private pendingGreedyCancel = false;
  private greedyCancelTimer: ReturnType<typeof setTimeout> | null = null;

  // SpeechStarted debounce - filter rapid-fire duplicate events from Deepgram
  private lastSpeechStartedTime = 0;

  // Final transcript dedupe - prevents duplicate Deepgram finals from double-processing turns
  private lastFinalTranscriptNormalized: string | null = null;
  private lastFinalTranscriptAt = 0;

  // Word-level TTS timestamps - track what the user heard before barge-in
  // Vapi pattern: reconstruct exactly which words were spoken before interruption
  private currentResponseWordTimestamps: WordTimestamp[] = [];

  // Race condition protection - prevents double processing of same transcript
  private processingLock = false;
  private pendingTranscript = false;

  // Utterance accumulation - tracks when we started collecting fragments
  private accumulationStartTime: number | null = null;

  // Cleanup guard - prevents duplicate cleanup execution
  private isCleanedUp = false;

  // Abort controller - cancels in-flight LLM requests on cleanup
  private abortController: AbortController | null = null;

  // Audio pipeline state machine - proper state management
  private pipelineState: AudioPipelineStateMachine;

  // Multi-chunk TTS tracking - know when FULL response is complete
  private pendingTTSChunks = 0;
  private responseStreamComplete = false;
  private ttsFinalizeRequested = false;

  constructor(
    callSid: string,
    tenant: Tenant,
    callerPhone: string | undefined,
    callbacks: TurnManagerCallbacks,
  ) {
    this.callSid = callSid;
    this.tenant = tenant;
    this.callbacks = callbacks;

    // Initialize audio pipeline state machine
    this.pipelineState = new AudioPipelineStateMachine(callSid);

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
          // Treat pending TTS as one active playback session (not per sentence chunk).
          // Cartesia done events are completion boundaries, not guaranteed one-per-chunk.
          if (this.pendingTTSChunks > 0) {
            this.pendingTTSChunks = 0;
            this.ttsFinalizeRequested = false;
            console.log(`[TURN] TTS playback complete`);
          }

          // Only transition state when ALL chunks are done AND stream is complete
          const allChunksComplete =
            this.pendingTTSChunks === 0 && this.responseStreamComplete;

          if (allChunksComplete) {
            sessionManager.setPlaying(this.callSid, false);

            // Handle state transition when TTS completes
            if (this.pipelineState.is(PipelineState.GREETING)) {
              // Greeting complete - now ready to listen
              this.pipelineState.transition(
                PipelineState.LISTENING,
                "Greeting TTS complete",
              );
            } else if (this.pipelineState.is(PipelineState.SPEAKING)) {
              // Response complete - ready for next user input
              this.pipelineState.transition(
                PipelineState.LISTENING,
                "Response TTS complete",
              );
            }

            // Reset flags for next response
            this.responseStreamComplete = false;

            this.checkForPendingResponse();
          }
        },
        onWordTimestamps: (timestamps) => {
          this.currentResponseWordTimestamps.push(...timestamps);
        },
        onError: (error) => {
          console.error(`[TURN] TTS error:`, error);
          sessionManager.setPlaying(this.callSid, false);

          // On error, return to listening state
          if (
            this.pipelineState.is(PipelineState.GREETING) ||
            this.pipelineState.is(PipelineState.SPEAKING)
          ) {
            this.pipelineState.transition(PipelineState.LISTENING, "TTS error");
          }
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
    // CRITICAL: Transition to GREETING state - VAD will be disabled
    // State will automatically transition to LISTENING when TTS onDone fires
    this.pipelineState.transition(PipelineState.GREETING, "Starting greeting");
    await this.speak(this.tenant.greeting_standard);
    // Note: Don't set state to LISTENING here - TTS onDone callback handles it

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
    if (isFinal) {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      if (this.isDuplicateFinalTranscript(trimmed)) {
        console.log(
          `[TURN] Ignoring duplicate final transcript: "${trimmed.substring(0, 40)}..."`,
        );
        return;
      }
    }

    this.state = updateTranscript(this.state, text, isFinal);

    // Fast path: interim transcript can confirm real user interruption while processing.
    // This avoids waiting for a final transcript before canceling stale LLM output.
    if (this.pendingGreedyCancel && !isFinal) {
      const interim = text.trim();
      if (interim.length >= 8 && /[a-z]/i.test(interim)) {
        console.log(
          `[TURN] Greedy cancel confirmed by interim transcript ("${interim.substring(0, 40)}...")`,
        );
        this.cancelPendingGreedyCancel();
        this.abortCurrentProcessing();
      }
    }

    // Fast path for barge-in: only interrupt when interim transcript shows meaningful speech.
    // This prevents timer-only interruptions from echo/noise while TTS is playing.
    if (this.pendingBargeIn && !isFinal) {
      const interim = text.trim();
      if (
        interim.length >= MIN_BARGE_IN_INTERIM_CHARS &&
        /[a-z]/i.test(interim)
      ) {
        if (this.isAcknowledgement(interim)) {
          console.log(
            `[TURN] Interim acknowledgement detected ("${interim}"), cancelling barge-in`,
          );
          this.cancelPendingBargeIn();
        } else {
          console.log(
            `[TURN] Interim speech confirms barge-in ("${interim.substring(0, 40)}..."), interrupting`,
          );
          this.executeBargeIn();
        }
      }
    }

    if (isFinal) {
      console.log(`[TURN] Final transcript: "${text}"`);

      // === DEFERRED GREEDY CANCEL CONFIRMATION ===
      // If we have a pending greedy cancel and got a real transcript, execute it now.
      // If transcript is too short (noise artifact), cancel the pending greedy cancel.
      if (this.pendingGreedyCancel) {
        const trimmed = text.trim();
        if (trimmed.length > 2) {
          // Real speech confirmed - execute greedy cancel
          console.log(
            `[TURN] Greedy cancel confirmed by transcript ("${trimmed}") - aborting LLM`,
          );
          this.cancelPendingGreedyCancel();
          this.abortCurrentProcessing();
        } else {
          // Too short - likely noise artifact, not real speech
          console.log(
            `[TURN] Greedy cancel dismissed (transcript too short: "${trimmed}")`,
          );
          this.cancelPendingGreedyCancel();
        }
      }

      // Check if we have a pending barge-in waiting for transcript
      if (this.pendingBargeIn) {
        if (this.isAcknowledgement(text)) {
          // User said "yeah", "uh-huh", etc. - NOT an interruption
          console.log(
            `[TURN] Acknowledgement detected ("${text}"), cancelling barge-in`,
          );
          this.cancelPendingBargeIn();
          return; // Don't schedule processing for acknowledgements
        } else {
          // Real interruption - execute barge-in immediately
          console.log(
            `[TURN] Non-acknowledgement during barge-in ("${text}"), interrupting`,
          );
          this.executeBargeIn();
        }
      }

      // Schedule processing only when user is no longer actively speaking.
      // Final transcript chunks can arrive mid-utterance.
      const session = sessionManager.getSession(this.callSid);
      if (session?.isSpeaking) {
        console.log(
          `[TURN] Final transcript received while user still speaking - deferring schedule`,
        );
      } else {
        this.scheduleProcessing();
      }
    }
  }

  private handleSpeechStarted(): void {
    // === DEBOUNCE: Filter rapid-fire duplicate SpeechStarted events from Deepgram ===
    const now = Date.now();
    if (now - this.lastSpeechStartedTime < SPEECH_STARTED_DEBOUNCE_MS) {
      return; // Ignore duplicate within debounce window
    }
    this.lastSpeechStartedTime = now;

    const existingSession = sessionManager.getSession(this.callSid);
    if (existingSession?.isSpeaking) {
      // Duplicate SpeechStarted still means caller is actively talking.
      // Cancel any pending process timer to avoid mid-utterance triggering.
      this.cancelScheduledProcessing();
      return; // Duplicate SpeechStarted while already in a speaking segment
    }

    console.log(`[TURN] User started speaking`);
    sessionManager.setSpeaking(this.callSid, true);

    // === DEFERRED GREEDY CANCEL: User speaks during PROCESSING ===
    // Vapi/Retell pattern: don't abort LLM on raw SpeechStarted (often noise/echo).
    // Instead, set a pending flag and wait for a confirmed final transcript.
    // LLM continues processing during the confirmation window.
    if (this.pipelineState.is(PipelineState.PROCESSING)) {
      if (!this.pendingGreedyCancel) {
        console.log(
          `[TURN] Speech detected during PROCESSING - deferring greedy cancel (waiting ${GREEDY_CANCEL_CONFIRM_MS}ms for transcript)`,
        );
        this.pendingGreedyCancel = true;

        // Safety: if no transcript confirms within the window, it was noise - ignore it
        this.greedyCancelTimer = setTimeout(() => {
          if (this.pendingGreedyCancel) {
            console.log(
              `[TURN] Pending greedy cancel expired (no transcript) - was noise, continuing LLM`,
            );
            this.pendingGreedyCancel = false;
          }
        }, GREEDY_CANCEL_CONFIRM_MS);
      }
      // Don't return - fall through to set up accumulation timer
    }

    // Check if VAD should be processed in current state
    // (GREETING state still blocks VAD)
    if (
      !this.pipelineState.shouldProcessVAD() &&
      !this.pipelineState.is(PipelineState.LISTENING)
    ) {
      const state = this.pipelineState.getState();
      console.log(`[TURN] Ignoring speech in ${state} state - VAD disabled`);
      return;
    }

    // Cancel any pending processing - user is still talking
    this.cancelScheduledProcessing();

    // Set accumulation timer once per turn (avoid extending turns from duplicate VAD events)
    if (!this.accumulationStartTime) {
      this.accumulationStartTime = Date.now();
    }

    // === DEFERRED BARGE-IN: Wait for transcript to check acknowledgement phrases ===
    // Vapi pattern: "yeah" / "uh-huh" during TTS = acknowledgement, not interruption
    const session = sessionManager.getSession(this.callSid);
    if (session?.isPlaying && !this.bargeInHandled) {
      if (!this.pipelineState.canBargeIn()) {
        const state = this.pipelineState.getState();
        console.log(`[TURN] Barge-in not allowed in ${state} state`);
        return;
      }

      // Prevent false positives from echo during earliest TTS frames
      const MIN_TTS_DURATION_MS = 700;
      const ttsDuration = this.ttsStartTime
        ? Date.now() - this.ttsStartTime
        : 999999;

      if (ttsDuration < MIN_TTS_DURATION_MS) {
        console.log(
          `[TURN] Ignoring potential false-positive barge-in (TTS played for ${ttsDuration}ms, need ${MIN_TTS_DURATION_MS}ms)`,
        );
        return;
      }

      // DEFERRED: Wait for transcript to check if it's an acknowledgement
      // If user is just saying "yeah" or "uh-huh", don't interrupt
      console.log(
        `[TURN] Potential barge-in, waiting for transcript to verify`,
      );
      this.pendingBargeIn = true;
      this.bargeInHandled = true; // Prevent repeated triggers

      // Safety: if no transcript arrives, treat SpeechStarted as likely noise/echo and ignore.
      // Real interruptions should produce interim/final transcript and will interrupt there.
      this.bargeInTimer = setTimeout(() => {
        if (this.pendingBargeIn) {
          console.log(
            `[TURN] Barge-in timer expired with no transcript, cancelling pending barge-in`,
          );
          this.cancelPendingBargeIn();
        }
      }, BARGE_IN_TRANSCRIPT_WAIT_MS);
    }
  }

  /**
   * Execute barge-in: stop TTS and abort LLM stream
   * Vapi pattern: full pipeline cancel, not just TTS stop
   */
  private executeBargeIn(): void {
    this.pendingBargeIn = false;
    if (this.bargeInTimer) {
      clearTimeout(this.bargeInTimer);
      this.bargeInTimer = null;
    }

    console.log(`[TURN] Barge-in executing - stopping TTS and aborting LLM`);

    // Use word-level timestamps to determine what the user actually heard
    // Vapi pattern: include partial response context so LLM knows what was communicated
    if (this.currentResponseWordTimestamps.length > 0 && this.ttsStartTime) {
      const elapsedMs = Date.now() - this.ttsStartTime;
      // Convert elapsed real time to TTS timeline (timestamps are in seconds)
      const elapsedSec = elapsedMs / 1000;
      const spokenWords = this.currentResponseWordTimestamps
        .filter((wt) => wt.end <= elapsedSec)
        .map((wt) => wt.word);

      if (spokenWords.length > 0) {
        const partialResponse = spokenWords.join(" ");
        console.log(
          `[TURN] User heard before interruption: "${partialResponse.substring(0, 60)}..."`,
        );
        // Add context to conversation history so LLM knows what was communicated
        sessionManager.addMessage(
          this.callSid,
          "assistant",
          `[interrupted after saying: "${partialResponse}"]`,
        );
      }
    }
    this.currentResponseWordTimestamps = [];

    sessionManager.requestInterrupt(this.callSid);
    this.tts?.cancel();
    this.mediaHandler?.clearAudio();
    this.state = clearAudioQueue(this.state);

    // Also abort the LLM stream - the response is stale since user interrupted
    if (this.abortController) {
      this.abortController.abort();
    }
    this.cancelFillerTimer();
    this.pendingTTSChunks = 0;
    this.responseStreamComplete = false;
    this.ttsFinalizeRequested = false;

    // Transition to LISTENING so new speech is processed
    if (this.pipelineState.is(PipelineState.SPEAKING)) {
      this.pipelineState.transition(
        PipelineState.LISTENING,
        "Barge-in - user interrupted",
      );
    }
    sessionManager.setPlaying(this.callSid, false);
    this.accumulationStartTime = Date.now();
  }

  /**
   * Cancel a pending barge-in (user said acknowledgement phrase)
   */
  private cancelPendingBargeIn(): void {
    this.pendingBargeIn = false;
    this.bargeInHandled = false; // Allow future barge-ins
    if (this.bargeInTimer) {
      clearTimeout(this.bargeInTimer);
      this.bargeInTimer = null;
    }
  }

  private isAcknowledgement(text: string): boolean {
    const normalized = text
      .trim()
      .toLowerCase()
      .replace(/[.,!?]+$/g, "");
    return ACKNOWLEDGEMENT_PHRASES.has(normalized);
  }

  private isDuplicateFinalTranscript(text: string): boolean {
    const normalized = text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const now = Date.now();

    const isDuplicate =
      normalized.length > 0 &&
      normalized === this.lastFinalTranscriptNormalized &&
      now - this.lastFinalTranscriptAt < FINAL_TRANSCRIPT_DEDUPE_MS;

    this.lastFinalTranscriptNormalized = normalized || null;
    this.lastFinalTranscriptAt = now;

    return isDuplicate;
  }

  /**
   * Cancel a pending greedy cancel (no transcript confirmed it was real speech)
   */
  private cancelPendingGreedyCancel(): void {
    this.pendingGreedyCancel = false;
    if (this.greedyCancelTimer) {
      clearTimeout(this.greedyCancelTimer);
      this.greedyCancelTimer = null;
    }
  }

  /**
   * GREEDY CANCEL: Abort current LLM processing when user resumes speaking
   * Vapi pattern: speculative inference is cancelled, user never hears stale response
   */
  private abortCurrentProcessing(): void {
    console.log(`[TURN] Greedy cancel - aborting LLM and restoring transcript`);

    // Abort the LLM stream
    if (this.abortController) {
      this.abortController.abort();
    }
    this.cancelFillerTimer();

    // Cancel any TTS that started
    this.tts?.cancel();
    this.mediaHandler?.clearAudio();
    this.state = clearAudioQueue(this.state);
    this.pendingTTSChunks = 0;
    this.responseStreamComplete = false;
    this.ttsFinalizeRequested = false;
    sessionManager.setPlaying(this.callSid, false);

    // Restore the transcript that was cleared when processing started
    // so new speech appends to it, giving the LLM the full context
    if (this.lastProcessedTranscript) {
      this.state.transcriptBuffer = this.lastProcessedTranscript;
      // Remove the user message we added to history - we'll re-send the full text
      sessionManager.popLastUserMessage(this.callSid);
      console.log(
        `[TURN] Restored transcript: "${this.lastProcessedTranscript.substring(0, 30)}..."`,
      );
      this.lastProcessedTranscript = null;
    }

    // Transition to LISTENING
    this.pipelineState.transition(
      PipelineState.LISTENING,
      "Greedy cancel - user resumed speaking",
    );
    // NOTE: Do NOT reset accumulationStartTime here.
    // Preserving the original start time ensures MAX_ACCUMULATION_MS is enforced
    // even across greedy cancel cycles (prevents the 24s+ accumulation death loop).
  }

  /**
   * Layered endpointing: compute context-aware wait time
   * Vapi pattern: different timeouts for punctuation / numbers / no-punctuation / structured data
   */
  private getEndpointingTimeout(transcript: string): number {
    const trimmed = transcript.trim();
    const lower = trimmed.toLowerCase();

    // Layer 1: Context-aware rules (highest priority)
    // If assistant just asked for structured data, give caller more time
    const lastAssistant = sessionManager.getLastAssistantMessage(this.callSid);
    if (lastAssistant) {
      if (/(name|spell|spelling)/i.test(lastAssistant)) {
        return STRUCTURED_DATA_WAIT_MS;
      }
      if (/(phone|number|address|zip|email)/i.test(lastAssistant)) {
        return STRUCTURED_DATA_WAIT_MS;
      }
      if (/(date|when|check.?in|check.?out)/i.test(lastAssistant)) {
        return DATE_COLLECTION_WAIT_MS;
      }
    }

    // Layer 2: Filler detection
    const fillerPattern = /\b(u+m+|u+h+|h+m+|m+m+|a+h+|e+r+|you know)\s*$/i;
    if (fillerPattern.test(lower)) {
      return FILLER_WAIT_MS;
    }

    // Layer 3: Transcription heuristics
    // Ends with punctuation - short wait, likely a complete thought
    if (/[.!?]$/.test(trimmed)) {
      return ON_PUNCTUATION_MS;
    }

    // Ends with a number - medium wait, might be part of longer sequence
    if (
      /\d$/.test(trimmed) ||
      /\b(one|two|three|four|five|six|seven|eight|nine|ten)$/i.test(lower)
    ) {
      return ON_NUMBER_MS;
    }

    // No punctuation - longest wait
    return ON_NO_PUNCTUATION_MS;
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

    // Prefer finalized transcript for endpointing. Interim text is noisy and should
    // not dominate timing once we already have a final chunk.
    const transcript =
      this.state.transcriptBuffer.trim() || getCompleteTranscript(this.state);
    const waitMs = this.getEndpointingTimeout(transcript);

    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      this.processUserTurn();
    }, waitMs);
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

    // Avoid starting a new turn while assistant audio is still playing.
    // Buffered final transcript will be handled when playback completes.
    if (this.pipelineState.is(PipelineState.SPEAKING)) {
      console.log(`[TURN] Deferring processing while assistant is speaking`);
      this.processingLock = false;
      return;
    }

    const finalizedTranscript = this.state.transcriptBuffer.trim();
    const interimTranscript = this.state.interimTranscript.trim();
    const transcript = finalizedTranscript || interimTranscript;
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

    const accumulationTime = Date.now() - this.accumulationStartTime;

    // Never process while caller is still actively speaking unless STT state appears stale.
    const session = sessionManager.getSession(this.callSid);
    if (session?.isSpeaking && accumulationTime < MAX_ACTIVE_SPEECH_WAIT_MS) {
      console.log(
        `[TURN] User still speaking, delaying processing (${accumulationTime}ms accumulated)`,
      );
      this.processingLock = false;
      this.silenceTimer = setTimeout(() => {
        this.silenceTimer = null;
        this.processUserTurn();
      }, ACTIVE_SPEECH_RECHECK_MS);
      return;
    }

    if (session?.isSpeaking) {
      console.warn(
        `[TURN] STT speaking flag appears stale after ${accumulationTime}ms; continuing processing`,
      );
    }

    // Prefer finalized transcript before deciding completeness.
    // Processing interim text can split one utterance into multiple turns.
    if (!finalizedTranscript && interimTranscript.length > 0) {
      console.log(
        `[TURN] Interim transcript active, waiting ${INTERIM_FINALIZATION_WAIT_MS}ms for final`,
      );
      this.processingLock = false;
      this.silenceTimer = setTimeout(() => {
        this.silenceTimer = null;
        this.processUserTurn();
      }, INTERIM_FINALIZATION_WAIT_MS);
      return;
    }

    // Completeness check
    const completeness = checkUtteranceCompleteness(transcript);
    const maxAccumulationMs =
      completeness === "incomplete" || completeness === "filler"
        ? MAX_INCOMPLETE_ACCUMULATION_MS
        : MAX_ACCUMULATION_MS;
    const forceProcess = accumulationTime >= maxAccumulationMs;
    console.log(
      `[TURN] Completeness: "${transcript.substring(0, 40)}..." -> ${completeness} (accumulated: ${accumulationTime}ms)`,
    );

    // Decide whether to wait or process
    if (!forceProcess) {
      if (completeness === "filler") {
        console.log(
          `[TURN] Caller is thinking (filler detected), waiting ${FILLER_WAIT_MS}ms`,
        );
        this.processingLock = false;
        this.silenceTimer = setTimeout(() => {
          this.silenceTimer = null;
          this.processUserTurn();
        }, FILLER_WAIT_MS);
        return;
      }

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
        const waitMs = this.getEndpointingTimeout(transcript);
        console.log(`[TURN] Maybe complete, waiting ${waitMs}ms`);
        this.processingLock = false;
        this.silenceTimer = setTimeout(() => {
          this.silenceTimer = null;
          this.processUserTurn();
        }, waitMs);
        return;
      }
    } else {
      console.log(
        `[TURN] Max accumulation time reached (${maxAccumulationMs}ms), forcing process`,
      );
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

    // Reset TTS tracking for new response
    this.pendingTTSChunks = 0;
    this.responseStreamComplete = false;
    this.ttsFinalizeRequested = false;

    // Transition to PROCESSING state - blocks VAD during LLM generation
    this.pipelineState.transition(
      PipelineState.PROCESSING,
      "Starting LLM processing",
    );

    // Create abort controller for this request
    this.abortController = new AbortController();

    // Save transcript for greedy cancel restore (before clearing)
    this.lastProcessedTranscript = transcript;

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
        abortSignal: this.abortController.signal,
      });

      const sentenceBuffer = createSentenceBuffer();
      let fullResponse = "";
      let isFirstChunk = true;
      let sentenceCount = 0;
      let currentProvider = "unknown";
      let shouldEscalate = false;
      const providerErrors: string[] = [];

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
          if (chunk.error) {
            providerErrors.push(chunk.error);
          }
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
          const filler = this.selectToolFiller(name);
          this.speakChunk(filler, false);

          // Execute tool
          const result = await executeTool(name, args, toolContext);

          // For custom SignalWire stack, tool executes transfer directly.
          // Keep callback-based escalation only for Vapi compatibility paths.
          if (name === "transfer_to_human") {
            const transferResult = result as { transferred?: boolean };
            const voiceProvider = process.env.VOICE_PROVIDER || "custom";
            shouldEscalate =
              voiceProvider === "vapi" && !!transferResult.transferred;
          }

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
            abortSignal: this.abortController.signal,
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
                // Continue from previous chunks if any were spoken
                this.speakChunk(remaining, !isFirstToolResultChunk);
              }
              this.responseStreamComplete = true;
              this.requestTtsFinalize("tool-result stream done");
            } else if (resultChunk.type === "error") {
              console.error(
                `[TURN] Tool-result stream error: ${resultChunk.error}`,
              );
              if (resultChunk.error) {
                providerErrors.push(resultChunk.error);
              }
            }
          }

          continue;
        }

        // Handle text chunks
        if (chunk.type === "text" && chunk.content) {
          fullResponse += chunk.content;

          // Log first token latency and cancel filler timer ONCE per response
          // (before sentence loop to avoid duplicate TTFT logs per yielded sentence)
          if (isFirstChunk) {
            this.cancelFillerTimer(); // LLM responded fast, no filler needed
            const ttft = Date.now() - startTime;
            console.log(
              `[TURN] Time to first token: ${ttft}ms (${currentProvider})`,
            );
            isFirstChunk = false;
          }

          // Buffer and speak sentences as they complete
          const sentences = sentenceBuffer.add(chunk.content);
          for (const sentence of sentences) {
            const ttfs = Date.now() - startTime;
            // If filler was spoken, continue from it; otherwise start fresh on first sentence
            const shouldContinue = this.fillerSpoken || sentenceCount > 0;
            console.log(
              `[TURN] Speaking sentence (${ttfs}ms): "${sentence.substring(0, 40)}..." (continue: ${shouldContinue})`,
            );
            this.speakChunk(sentence, shouldContinue);
            sentenceCount++;
          }
        }

        // Handle stream completion
        if (chunk.type === "done") {
          // Flush any remaining buffered text
          const remaining = sentenceBuffer.flush();
          if (remaining) {
            const ttfs = Date.now() - startTime;
            // Continue from previous chunks if any were spoken; start fresh only if this is the sole chunk
            const shouldContinue = sentenceCount > 0;
            console.log(
              `[TURN] Flushing final (${ttfs}ms): "${remaining.substring(0, 40)}..." (continue: ${shouldContinue})`,
            );
            this.speakChunk(remaining, shouldContinue);
          }

          // Mark that LLM stream is complete - TTS can transition state once all chunks finish
          this.responseStreamComplete = true;
          this.requestTtsFinalize("llm stream done");
          console.log(
            `[TURN] LLM stream complete, waiting for ${this.pendingTTSChunks} TTS chunks to finish`,
          );
        }
      }

      const totalLatency = Date.now() - startTime;
      console.log(
        `[TURN] Response complete: "${fullResponse.substring(0, 100)}..." ` +
          `(provider: ${currentProvider}, total: ${totalLatency}ms)`,
      );

      if (!fullResponse.trim() && providerErrors.length > 0) {
        const recovery = this.selectRecoveryResponse();
        console.warn(
          `[TURN] Empty response after provider errors (${providerErrors.length}), using recovery prompt`,
        );
        await this.speak(recovery);
      }

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
      const fallback = this.selectRecoveryResponse();
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

    // CRITICAL: Transition to SPEAKING state from ANY state (PROCESSING or LISTENING)
    // This handles the case where previous TTS chunk completed and transitioned to LISTENING
    if (
      this.pipelineState.is(PipelineState.PROCESSING) ||
      this.pipelineState.is(PipelineState.LISTENING)
    ) {
      this.pipelineState.transition(
        PipelineState.SPEAKING,
        "Starting TTS playback",
      );
    }

    sessionManager.setPlaying(this.callSid, true);

    // Only reset barge-in tracking on the FIRST chunk of a response.
    // For multi-chunk responses, resetting per-chunk creates false-positive barge-in windows
    // between chunks where background noise or echo can trigger interruption.
    if (!isContinuation) {
      this.bargeInHandled = false;
      this.ttsStartTime = Date.now();
      this.currentResponseWordTimestamps = []; // Reset for new response
    }

    // Track active TTS playback session (single active response chain)
    if (this.pendingTTSChunks === 0) {
      this.pendingTTSChunks = 1;
    }
    console.log(
      `[TURN] Sending TTS chunk (${this.pendingTTSChunks} pending): "${text.substring(0, 40)}..."`,
    );

    this.tts.speakChunk(text, isContinuation);
  }

  private requestTtsFinalize(reason: string): void {
    if (!this.tts || this.pendingTTSChunks === 0 || this.ttsFinalizeRequested) {
      return;
    }
    this.ttsFinalizeRequested = true;
    console.log(`[TURN] Requesting TTS finalize (${reason})`);
    this.tts.finalizeStream();
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

    // Track pending TTS (single chunk for full speak)
    this.pendingTTSChunks = 1;
    this.responseStreamComplete = true; // Full speak is always complete immediately

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
   * Pick a short tool filler phrase with light variation to avoid repetitive speech.
   */
  private selectToolFiller(toolName: string): string {
    const pool = TOOL_FILLERS[toolName] || TOOL_FILLERS.default;
    const available = pool.filter((p) => p !== this.lastFillerUsed);
    const selected =
      available[Math.floor(Math.random() * available.length)] || pool[0];
    this.lastFillerUsed = selected;
    return selected;
  }

  private selectRecoveryResponse(): string {
    return (
      RECOVERY_RESPONSES[
        Math.floor(Math.random() * RECOVERY_RESPONSES.length)
      ] || RECOVERY_RESPONSES[0]
    );
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
    const finalizedTranscript = this.state.transcriptBuffer.trim();
    const interimTranscript = this.state.interimTranscript.trim();

    // If user is actively speaking and we only have interim text, wait.
    // But if we already have finalized text, allow processing to avoid
    // long stalls when Deepgram emits noisy repeated SpeechStarted events.
    if (session?.isSpeaking && finalizedTranscript.length === 0) {
      return;
    }

    // Interim-only text can still change and causes duplicate turns.
    if (!finalizedTranscript && interimTranscript.length > 0) {
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.silenceTimer = null;
          this.processUserTurn();
        }, INTERIM_FINALIZATION_WAIT_MS);
      }
      return;
    }

    if (finalizedTranscript.length >= MIN_TRANSCRIPT_LENGTH) {
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
    this.cancelPendingGreedyCancel();

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
