// Voicemail Service
// Handles voicemail recording and storage when agent is unavailable

import { getSupabase } from "../database/client.js";

export interface VoicemailConfig {
  enabled: boolean;
  maxDurationSeconds: number;
  greetingMessage: string;
  afterHoursMessage: string;
  transcribeVoicemail: boolean;
}

export interface VoicemailRecord {
  id?: string;
  tenantId: string;
  callSid: string;
  callerPhone: string;
  callerName?: string;
  recordingUrl?: string;
  recordingSid?: string;
  durationSeconds?: number;
  transcript?: string;
  reason: VoicemailReason;
  status: "pending" | "reviewed" | "callback_scheduled" | "resolved";
  createdAt?: string;
}

export type VoicemailReason =
  | "after_hours"
  | "max_retries"
  | "no_agent_available"
  | "caller_requested"
  | "call_failed";

const DEFAULT_CONFIG: VoicemailConfig = {
  enabled: true,
  maxDurationSeconds: 120,
  greetingMessage:
    "We're sorry we couldn't assist you right now. Please leave a message after the tone, and we'll get back to you as soon as possible.",
  afterHoursMessage:
    "Thank you for calling. We're currently closed. Please leave a message and we'll return your call during business hours.",
  transcribeVoicemail: true,
};

/**
 * Check if voicemail should be triggered based on conditions
 */
export function shouldTriggerVoicemail(
  isAfterHours: boolean,
  retryCount: number,
  maxRetries: number,
  callerRequested: boolean,
): { trigger: boolean; reason: VoicemailReason | null } {
  if (callerRequested) {
    return { trigger: true, reason: "caller_requested" };
  }

  if (isAfterHours) {
    return { trigger: true, reason: "after_hours" };
  }

  if (retryCount >= maxRetries) {
    return { trigger: true, reason: "max_retries" };
  }

  return { trigger: false, reason: null };
}

/**
 * Get voicemail greeting based on reason
 */
export function getVoicemailGreeting(
  reason: VoicemailReason,
  config: Partial<VoicemailConfig> = {},
): string {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  switch (reason) {
    case "after_hours":
      return mergedConfig.afterHoursMessage;
    case "caller_requested":
      return "I'll transfer you to voicemail now. Please leave your message after the tone.";
    case "max_retries":
    case "no_agent_available":
    case "call_failed":
    default:
      return mergedConfig.greetingMessage;
  }
}

/**
 * Generate TwiML for voicemail recording
 */
export function generateVoicemailTwiML(
  greeting: string,
  callbackUrl: string,
  maxDuration: number = 120,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(greeting)}</Say>
  <Record
    maxLength="${maxDuration}"
    playBeep="true"
    action="${callbackUrl}"
    recordingStatusCallback="${callbackUrl.replace("/complete", "/status")}"
    transcribe="true"
    transcribeCallback="${callbackUrl.replace("/complete", "/transcribe")}"
  />
  <Say voice="Polly.Joanna">We did not receive a recording. Goodbye.</Say>
</Response>`;
}

/**
 * Save voicemail record to database
 */
export async function saveVoicemail(
  voicemail: VoicemailRecord,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const db = getSupabase();

  const { data, error } = await db
    .from("voicemails")
    .insert({
      tenant_id: voicemail.tenantId,
      call_sid: voicemail.callSid,
      caller_phone: voicemail.callerPhone,
      caller_name: voicemail.callerName,
      recording_url: voicemail.recordingUrl,
      recording_sid: voicemail.recordingSid,
      duration_seconds: voicemail.durationSeconds,
      transcript: voicemail.transcript,
      reason: voicemail.reason,
      status: voicemail.status || "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[VOICEMAIL] Save error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, id: data.id };
}

/**
 * Update voicemail with recording details
 */
export async function updateVoicemailRecording(
  callSid: string,
  recordingUrl: string,
  recordingSid: string,
  durationSeconds: number,
): Promise<boolean> {
  const db = getSupabase();

  const { error } = await db
    .from("voicemails")
    .update({
      recording_url: recordingUrl,
      recording_sid: recordingSid,
      duration_seconds: durationSeconds,
    })
    .eq("call_sid", callSid);

  if (error) {
    console.error("[VOICEMAIL] Update recording error:", error);
    return false;
  }

  return true;
}

/**
 * Update voicemail transcript
 */
export async function updateVoicemailTranscript(
  callSid: string,
  transcript: string,
): Promise<boolean> {
  const db = getSupabase();

  const { error } = await db
    .from("voicemails")
    .update({ transcript })
    .eq("call_sid", callSid);

  if (error) {
    console.error("[VOICEMAIL] Update transcript error:", error);
    return false;
  }

  return true;
}

/**
 * Get voicemails for a tenant
 */
export async function getVoicemails(
  tenantId: string,
  options: { status?: string; limit?: number; offset?: number } = {},
): Promise<{ voicemails: VoicemailRecord[]; total: number }> {
  const db = getSupabase();
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  let query = db
    .from("voicemails")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("[VOICEMAIL] Get error:", error);
    return { voicemails: [], total: 0 };
  }

  return {
    voicemails: (data || []).map(mapDbToVoicemail),
    total: count || 0,
  };
}

/**
 * Update voicemail status
 */
export async function updateVoicemailStatus(
  id: string,
  status: VoicemailRecord["status"],
): Promise<boolean> {
  const db = getSupabase();

  const { error } = await db.from("voicemails").update({ status }).eq("id", id);

  if (error) {
    console.error("[VOICEMAIL] Update status error:", error);
    return false;
  }

  return true;
}

// Helper functions
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function mapDbToVoicemail(row: Record<string, unknown>): VoicemailRecord {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    callSid: row.call_sid as string,
    callerPhone: row.caller_phone as string,
    callerName: row.caller_name as string | undefined,
    recordingUrl: row.recording_url as string | undefined,
    recordingSid: row.recording_sid as string | undefined,
    durationSeconds: row.duration_seconds as number | undefined,
    transcript: row.transcript as string | undefined,
    reason: row.reason as VoicemailReason,
    status: row.status as VoicemailRecord["status"],
    createdAt: row.created_at as string,
  };
}
