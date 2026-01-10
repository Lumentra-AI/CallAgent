// Conversation State Management
// Tracks state within a single conversation turn

export interface TurnState {
  // Transcript accumulator
  transcriptBuffer: string;
  interimTranscript: string;

  // Response state
  responseInProgress: boolean;
  responsePending: boolean;

  // Audio state
  audioQueue: Buffer[];
  currentPlaybackId: string | null;

  // Timing
  silenceStartTime: number | null;
  lastTranscriptTime: number;
}

/**
 * Create initial turn state
 */
export function createTurnState(): TurnState {
  return {
    transcriptBuffer: "",
    interimTranscript: "",
    responseInProgress: false,
    responsePending: false,
    audioQueue: [],
    currentPlaybackId: null,
    silenceStartTime: null,
    lastTranscriptTime: Date.now(),
  };
}

/**
 * Update transcript with new text
 */
export function updateTranscript(
  state: TurnState,
  text: string,
  isFinal: boolean,
): TurnState {
  if (isFinal) {
    // Append final transcript to buffer
    if (state.transcriptBuffer) {
      state.transcriptBuffer += " " + text;
    } else {
      state.transcriptBuffer = text;
    }
    state.interimTranscript = "";
  } else {
    // Update interim transcript
    state.interimTranscript = text;
  }

  state.lastTranscriptTime = Date.now();
  state.silenceStartTime = null;

  return state;
}

/**
 * Get complete transcript (final + interim)
 */
export function getCompleteTranscript(state: TurnState): string {
  if (state.interimTranscript) {
    return state.transcriptBuffer
      ? `${state.transcriptBuffer} ${state.interimTranscript}`
      : state.interimTranscript;
  }
  return state.transcriptBuffer;
}

/**
 * Clear transcript buffer (after processing)
 */
export function clearTranscript(state: TurnState): TurnState {
  state.transcriptBuffer = "";
  state.interimTranscript = "";
  return state;
}

/**
 * Mark silence started
 */
export function startSilence(state: TurnState): TurnState {
  if (!state.silenceStartTime) {
    state.silenceStartTime = Date.now();
  }
  return state;
}

/**
 * Check if silence duration exceeds threshold
 */
export function isSilenceLongEnough(
  state: TurnState,
  thresholdMs: number = 1000,
): boolean {
  if (!state.silenceStartTime) {
    return false;
  }
  return Date.now() - state.silenceStartTime >= thresholdMs;
}

/**
 * Queue audio for playback
 */
export function queueAudio(state: TurnState, audio: Buffer): TurnState {
  state.audioQueue.push(audio);
  return state;
}

/**
 * Get next audio chunk
 */
export function getNextAudio(state: TurnState): Buffer | null {
  return state.audioQueue.shift() || null;
}

/**
 * Clear audio queue (for interrupts)
 */
export function clearAudioQueue(state: TurnState): TurnState {
  state.audioQueue = [];
  state.currentPlaybackId = null;
  return state;
}

/**
 * Check if there's audio to play
 */
export function hasAudioQueued(state: TurnState): boolean {
  return state.audioQueue.length > 0;
}
