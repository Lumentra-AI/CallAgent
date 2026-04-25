// Call summarizer
// Replaces the agent-side regex template ("32 conversation turns, 319s.
// Topics: ...") with a real LLM-generated 2-3 sentence summary that an
// operator can read at a glance from the calendar drawer.
//
// Runs async after /internal/calls/log inserts the calls row. Failure is
// non-fatal: the row keeps the agent's stub summary if the LLM call falls
// over.

import { openaiClient } from "../openai/client.js";
import { query } from "../database/client.js";

// gpt-4.1-mini is fine for a 2-3 sentence summary at ~$0.0001 per call.
// We use a separate model var so we can swap to Haiku 4.5 (Phase 2) without
// touching the rest of the LLM stack.
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || "gpt-4.1-mini";
const MAX_TRANSCRIPT_CHARS = 12_000; // ~3K tokens, plenty for a 5-min call

const SYSTEM_PROMPT = `You write 2-3 sentence summaries of phone calls between an AI receptionist and a customer.

Write for a busy small-business operator who needs to scan dozens of these. Lead with the customer's intent and outcome. If a booking was made, say what for and when. If the caller hit a problem, say what. If they were transferred or left a callback, say so. Skip filler ("the customer called", "the agent greeted them"). No markdown, no bullets, no preamble.`;

interface SummarizeArgs {
  callId: string;
  transcript: string;
  outcomeType?: string | null;
  durationSeconds?: number | null;
}

export async function summarizeCallAsync(args: SummarizeArgs): Promise<void> {
  if (!openaiClient) {
    console.warn("[SUMMARIZER] OpenAI client not configured, skipping");
    return;
  }
  if (!args.transcript || args.transcript.trim().length < 40) {
    // Too short to summarize meaningfully -- leave whatever the agent
    // wrote in place.
    return;
  }

  const transcript = args.transcript.slice(0, MAX_TRANSCRIPT_CHARS);
  const contextLine =
    args.outcomeType || args.durationSeconds
      ? `Call metadata: outcome=${args.outcomeType || "unknown"}, duration=${args.durationSeconds || "?"}s.\n\n`
      : "";

  try {
    const response = await openaiClient.chat.completions.create({
      model: SUMMARY_MODEL,
      temperature: 0.3,
      max_tokens: 180,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${contextLine}Transcript:\n${transcript}`,
        },
      ],
    });

    const summary = response.choices[0]?.message?.content?.trim();
    if (!summary) {
      console.warn(`[SUMMARIZER] Empty response for call ${args.callId}`);
      return;
    }

    await query(`UPDATE calls SET summary = $1 WHERE id = $2`, [
      summary,
      args.callId,
    ]);

    console.log(
      `[SUMMARIZER] Summary written for call ${args.callId} (${summary.length} chars)`,
    );
  } catch (err) {
    console.error(
      `[SUMMARIZER] Failed for call ${args.callId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
