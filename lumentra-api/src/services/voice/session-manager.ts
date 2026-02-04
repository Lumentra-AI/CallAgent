// Voice Session Manager
// Manages active call sessions and orchestrates the voice pipeline

import type { CallSession, ConversationMessage } from "../../types/voice.js";
import type { Tenant } from "../../types/database.js";

// Active sessions map
const activeSessions = new Map<string, CallSession>();

/**
 * Create a new call session
 */
export function createSession(
  callSid: string,
  tenant: Tenant,
  callerPhone?: string,
): CallSession {
  const session: CallSession = {
    callSid,
    tenantId: tenant.id,
    tenant,
    callerPhone,
    conversationHistory: [],
    isPlaying: false,
    isSpeaking: false,
    interruptRequested: false,
    startTime: new Date(),
    lastActivityTime: new Date(),
  };

  activeSessions.set(callSid, session);
  console.log(`[SESSION] Created session for call ${callSid}`);

  return session;
}

/**
 * Get an existing session
 */
export function getSession(callSid: string): CallSession | undefined {
  return activeSessions.get(callSid);
}

/**
 * Update session
 */
export function updateSession(
  callSid: string,
  updates: Partial<CallSession>,
): CallSession | undefined {
  const session = activeSessions.get(callSid);
  if (!session) {
    console.warn(`[SESSION] Session not found: ${callSid}`);
    return undefined;
  }

  Object.assign(session, updates, { lastActivityTime: new Date() });
  return session;
}

/**
 * Add message to conversation history
 */
export function addMessage(
  callSid: string,
  role: ConversationMessage["role"],
  content: string,
  options?: {
    toolCallId?: string;
    toolName?: string;
    toolResult?: string;
    toolCalls?: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }>;
  },
): void {
  const session = activeSessions.get(callSid);
  if (!session) {
    console.warn(`[SESSION] Cannot add message, session not found: ${callSid}`);
    return;
  }

  session.conversationHistory.push({
    role,
    content,
    timestamp: new Date(),
    ...options,
  });

  session.lastActivityTime = new Date();

  // Keep conversation history reasonable (last 20 turns)
  if (session.conversationHistory.length > 20) {
    // Keep system message if present, then trim oldest
    const systemMsg = session.conversationHistory.find(
      (m) => m.role === "system",
    );
    session.conversationHistory = session.conversationHistory.slice(-19);
    if (systemMsg && session.conversationHistory[0].role !== "system") {
      session.conversationHistory.unshift(systemMsg);
    }
  }
}

/**
 * Get conversation history for LLM
 */
export function getConversationHistory(callSid: string): ConversationMessage[] {
  const session = activeSessions.get(callSid);
  return session?.conversationHistory || [];
}

/**
 * Mark session as speaking (TTS playing)
 */
export function setPlaying(callSid: string, isPlaying: boolean): void {
  const session = activeSessions.get(callSid);
  if (session) {
    session.isPlaying = isPlaying;
    session.lastActivityTime = new Date();
  }
}

/**
 * Mark session as user speaking (STT active)
 */
export function setSpeaking(callSid: string, isSpeaking: boolean): void {
  const session = activeSessions.get(callSid);
  if (session) {
    session.isSpeaking = isSpeaking;
    session.lastActivityTime = new Date();
  }
}

/**
 * Request interrupt (user started speaking while TTS playing)
 */
export function requestInterrupt(callSid: string): void {
  const session = activeSessions.get(callSid);
  if (session && session.isPlaying) {
    session.interruptRequested = true;
    console.log(`[SESSION] Interrupt requested for ${callSid}`);
  }
}

/**
 * Clear interrupt flag
 */
export function clearInterrupt(callSid: string): void {
  const session = activeSessions.get(callSid);
  if (session) {
    session.interruptRequested = false;
  }
}

/**
 * End session and clean up
 */
export function endSession(callSid: string): CallSession | undefined {
  const session = activeSessions.get(callSid);
  if (!session) {
    return undefined;
  }

  activeSessions.delete(callSid);
  console.log(`[SESSION] Ended session for call ${callSid}`);

  const duration = (Date.now() - session.startTime.getTime()) / 1000;
  console.log(
    `[SESSION] Duration: ${duration.toFixed(1)}s, Turns: ${session.conversationHistory.length}`,
  );

  return session;
}

/**
 * Get all active sessions (for monitoring)
 */
export function getAllSessions(): CallSession[] {
  return Array.from(activeSessions.values());
}

/**
 * Get session count
 */
export function getSessionCount(): number {
  return activeSessions.size;
}

/**
 * Clean up stale sessions (called periodically)
 */
export function cleanupStaleSessions(maxAgeMinutes: number = 30): number {
  const now = Date.now();
  const maxAge = maxAgeMinutes * 60 * 1000;
  let cleaned = 0;

  for (const [callSid, session] of activeSessions.entries()) {
    const age = now - session.lastActivityTime.getTime();
    if (age > maxAge) {
      console.log(`[SESSION] Cleaning up stale session: ${callSid}`);
      activeSessions.delete(callSid);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[SESSION] Cleaned up ${cleaned} stale sessions`);
  }

  return cleaned;
}
