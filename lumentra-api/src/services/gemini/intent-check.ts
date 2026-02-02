// Intent Completeness Checker
// Uses Gemini to determine if user's utterance is complete or if they're still thinking

import { genAI } from "./client.js";

// Lightweight model for quick checks (lower latency than main model)
const QUICK_MODEL = "gemini-2.0-flash-lite";

// Maximum time to wait for intent check before assuming complete
const INTENT_TIMEOUT_MS = 500;

const COMPLETENESS_PROMPT = `You are analyzing a phone call transcript. Determine if the caller has finished their thought or is still thinking/speaking.

RESPOND WITH ONLY ONE WORD: "complete" or "incomplete"

Examples of INCOMPLETE utterances:
- "I want to book a room for..." (trailing off, missing date)
- "hmm let me think" (explicitly thinking)
- "so the thing is" (starting a thought)
- "I need, uh," (mid-sentence pause)
- "what about" (incomplete question)

Examples of COMPLETE utterances:
- "I want to book a room for Friday" (has all info)
- "What time is checkout?" (complete question)
- "Yes please" (complete response)
- "No, that's all" (complete response)
- "Can you tell me about your rates?" (complete question)

Caller said: "{utterance}"

Is this complete or incomplete?`;

interface CompletenessResult {
  isComplete: boolean;
  latencyMs: number;
}

/**
 * Check if user's utterance appears complete or if they're still thinking
 * Uses a fast, lightweight LLM check
 */
export async function checkUtteranceCompleteness(
  utterance: string,
): Promise<CompletenessResult> {
  const startTime = Date.now();

  // Quick checks that don't need LLM
  const trimmed = utterance.trim();

  // Very short utterances - wait for more
  if (trimmed.length < 5) {
    return { isComplete: false, latencyMs: 0 };
  }

  // Obvious complete patterns (questions, confirmations)
  if (
    /\?$/.test(trimmed) ||
    /^(yes|no|okay|sure|thanks|thank you|bye|goodbye)$/i.test(trimmed)
  ) {
    return { isComplete: true, latencyMs: 0 };
  }

  // Use LLM for nuanced cases
  if (!genAI) {
    // Fallback: assume complete if no LLM available
    return { isComplete: true, latencyMs: 0 };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: QUICK_MODEL,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 10,
      },
    });

    const prompt = COMPLETENESS_PROMPT.replace("{utterance}", trimmed);

    // Race between LLM call and timeout - don't block on slow API
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), INTENT_TIMEOUT_MS)
    );

    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise,
    ]);

    const latencyMs = Date.now() - startTime;

    // If timeout hit, assume complete to avoid blocking
    if (result === null) {
      console.log(`[INTENT] "${trimmed.substring(0, 30)}..." -> TIMEOUT (${latencyMs}ms), assuming complete`);
      return { isComplete: true, latencyMs };
    }

    const response = result.response.text().toLowerCase().trim();
    const isComplete =
      response.includes("complete") && !response.includes("incomplete");

    console.log(
      `[INTENT] "${trimmed.substring(0, 30)}..." -> ${isComplete ? "complete" : "incomplete"} (${latencyMs}ms)`,
    );

    return { isComplete, latencyMs };
  } catch (error) {
    console.error("[INTENT] Check failed:", error);
    // On error, assume complete to avoid blocking
    return { isComplete: true, latencyMs: Date.now() - startTime };
  }
}
