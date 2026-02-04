// Audio Pipeline State Machine
// Proper state management for voice conversation pipeline

export enum PipelineState {
  IDLE = "IDLE", // Call not started
  GREETING = "GREETING", // Playing initial greeting (VAD disabled)
  LISTENING = "LISTENING", // Waiting for user speech (VAD active)
  PROCESSING = "PROCESSING", // STT->LLM processing (VAD blocked)
  SPEAKING = "SPEAKING", // TTS playing (VAD high threshold)
}

export interface StateTransition {
  from: PipelineState;
  to: PipelineState;
  timestamp: Date;
  reason?: string;
}

export class AudioPipelineStateMachine {
  private currentState: PipelineState = PipelineState.IDLE;
  private history: StateTransition[] = [];
  private callSid: string;

  // VAD behavior configuration per state
  private static readonly VAD_CONFIG = {
    [PipelineState.IDLE]: { enabled: false, threshold: 0 },
    [PipelineState.GREETING]: { enabled: false, threshold: 0 }, // Completely disable during greeting
    [PipelineState.LISTENING]: { enabled: true, threshold: 0.5 }, // Normal sensitivity
    [PipelineState.PROCESSING]: { enabled: true, threshold: 0.7 }, // Detect speech for greedy cancel
    [PipelineState.SPEAKING]: { enabled: true, threshold: 0.8 }, // High threshold for barge-in
  };

  // Valid state transitions (prevents invalid moves)
  private static readonly VALID_TRANSITIONS: Record<
    PipelineState,
    PipelineState[]
  > = {
    [PipelineState.IDLE]: [PipelineState.GREETING],
    [PipelineState.GREETING]: [PipelineState.LISTENING],
    [PipelineState.LISTENING]: [
      PipelineState.PROCESSING,
      PipelineState.SPEAKING,
    ],
    [PipelineState.PROCESSING]: [
      PipelineState.SPEAKING,
      PipelineState.LISTENING,
    ],
    [PipelineState.SPEAKING]: [
      PipelineState.LISTENING,
      PipelineState.PROCESSING,
    ],
  };

  constructor(callSid: string) {
    this.callSid = callSid;
  }

  /**
   * Transition to new state with validation
   */
  transition(
    newState: PipelineState,
    reason?: string,
  ): { success: boolean; error?: string } {
    // Check if transition is valid
    const validNextStates =
      AudioPipelineStateMachine.VALID_TRANSITIONS[this.currentState];
    if (!validNextStates.includes(newState)) {
      const error = `[STATE] Invalid transition: ${this.currentState} -> ${newState}`;
      console.error(error);
      return { success: false, error };
    }

    const transition: StateTransition = {
      from: this.currentState,
      to: newState,
      timestamp: new Date(),
      reason,
    };

    this.history.push(transition);
    this.currentState = newState;

    console.log(
      `[STATE] ${this.callSid}: ${transition.from} -> ${transition.to}${reason ? ` (${reason})` : ""}`,
    );

    return { success: true };
  }

  /**
   * Get current state
   */
  getState(): PipelineState {
    return this.currentState;
  }

  /**
   * Check if in specific state
   */
  is(state: PipelineState): boolean {
    return this.currentState === state;
  }

  /**
   * Check if VAD should process speech in current state
   */
  shouldProcessVAD(): boolean {
    return AudioPipelineStateMachine.VAD_CONFIG[this.currentState].enabled;
  }

  /**
   * Get VAD threshold for current state
   */
  getVADThreshold(): number {
    return AudioPipelineStateMachine.VAD_CONFIG[this.currentState].threshold;
  }

  /**
   * Check if barge-in is allowed in current state
   */
  canBargeIn(): boolean {
    // Only allow barge-in during SPEAKING state
    // GREETING and PROCESSING states block barge-in completely
    return this.currentState === PipelineState.SPEAKING;
  }

  /**
   * Get state history for debugging
   */
  getHistory(): StateTransition[] {
    return [...this.history];
  }

  /**
   * Get time spent in current state
   */
  getTimeInCurrentState(): number {
    if (this.history.length === 0) return 0;
    const lastTransition = this.history[this.history.length - 1];
    return Date.now() - lastTransition.timestamp.getTime();
  }
}
