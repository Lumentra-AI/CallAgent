# Vapi Human-Like Voice Quality: Complete Configuration Guide (2026)

> Research date: 2026-03-22
> Sources: Vapi official docs, community forums, AssemblyAI blog, ElevenLabs docs, Cartesia docs, third-party reviews

---

## Table of Contents

1. [Voice Provider Ranking (Quality vs Latency)](#1-voice-provider-ranking)
2. [Voice Configuration by Provider](#2-voice-configuration-by-provider)
3. [Turn Detection / Endpointing](#3-turn-detection--endpointing)
4. [Backchanneling](#4-backchanneling)
5. [Filler Words / Thinking Sounds](#5-filler-words--thinking-sounds)
6. [Latency Optimization](#6-latency-optimization)
7. [Interruption Handling](#7-interruption-handling)
8. [Background Noise Handling](#8-background-noise-handling)
9. [Silence Detection & Timeout](#9-silence-detection--timeout)
10. [Emotional Tone & Personality](#10-emotional-tone--personality)
11. [First Message / Greeting](#11-first-message--greeting)
12. [Voice Speed & Pacing](#12-voice-speed--pacing)
13. [Complete Recommended Configuration](#13-complete-recommended-configuration)

---

## 1. Voice Provider Ranking

### Quality Tier List (for phone calls / conversational AI)

| Rank | Provider                    | Quality                                    | Latency (TTFB)        | Cost/min | Best For                        |
| ---- | --------------------------- | ------------------------------------------ | --------------------- | -------- | ------------------------------- |
| 1    | **ElevenLabs** (Turbo v2.5) | Best emotional range, most human-like      | ~200ms                | $0.036   | Max quality, emotional delivery |
| 2    | **ElevenLabs** (Flash v2.5) | Slightly below Turbo, still excellent      | ~75ms                 | $0.018   | Quality + speed sweet spot      |
| 3    | **Cartesia Sonic-3**        | Natural prosody, supports laughter/emotion | ~40ms (Turbo) / ~90ms | $0.007   | Ultra-low latency, good quality |
| 4    | **Vapi Native Voices**      | Curated high-quality, 10 voices            | Optimized             | $0.0216  | Simplest setup, good default    |
| 5    | **Deepgram Aura-2**         | Clear, professional                        | ~90-200ms             | ~$0.011  | Cost-effective, enterprise      |
| 6    | **OpenAI TTS**              | Good quality, limited voices               | ~150ms                | $0.0108  | Simple setup, decent quality    |
| 7    | **PlayHT**                  | Large library (829 voices, 142 langs)      | ~300ms+               | $0.065   | Multilingual coverage           |

### Recommendation

- **Quality-first (no latency concern):** ElevenLabs Turbo v2.5 (`eleven_turbo_v2_5`)
- **Quality + speed balance:** ElevenLabs Flash v2.5 (`eleven_flash_v2_5`) -- 75ms TTFB, near-Turbo quality
- **Speed-first (sub-500ms E2E target):** Cartesia Sonic-3 -- 40ms TTFB, natural prosody, emotion support
- **Budget-conscious:** Deepgram Aura-2 or Vapi native voices

### ElevenLabs Model Comparison

| Model               | ID                       | Quality | Latency | Cost             | Languages | Use Case               |
| ------------------- | ------------------------ | ------- | ------- | ---------------- | --------- | ---------------------- |
| **Flash v2.5**      | `eleven_flash_v2_5`      | High    | ~75ms   | 0.5 credits/char | 32        | Real-time voice agents |
| **Turbo v2.5**      | `eleven_turbo_v2_5`      | Higher  | ~200ms  | 0.5 credits/char | 32        | Quality-first agents   |
| **Multilingual v2** | `eleven_multilingual_v2` | Highest | ~400ms+ | 1 credit/char    | 29        | Audiobooks, voiceovers |

Flash v2.5 and Turbo v2.5 are functionally equivalent except Flash has lower latency on average. For phone calls, **Flash v2.5 is the recommended default** -- the quality difference is marginal and the latency gain is significant.

---

## 2. Voice Configuration by Provider

### ElevenLabs Configuration

```json
{
  "voice": {
    "provider": "11labs",
    "voiceId": "<voice-id>",
    "model": "eleven_flash_v2_5",
    "stability": 0.5,
    "similarityBoost": 0.75,
    "style": 0,
    "useSpeakerBoost": false,
    "speed": 1.0,
    "optimizeStreamingLatency": 4
  }
}
```

**Parameter Details:**

| Field                      | Type    | Range   | Default | Recommended         | Notes                                                        |
| -------------------------- | ------- | ------- | ------- | ------------------- | ------------------------------------------------------------ |
| `stability`                | number  | 0.0-1.0 | 0.5     | **0.4-0.5**         | Lower = more emotional range, more human. Too low = unstable |
| `similarityBoost`          | number  | 0.0-1.0 | 0.75    | **0.7-0.8**         | Higher = clearer voice. Very high can distort                |
| `style`                    | number  | 0.0-1.0 | 0       | **0**               | Style exaggeration. Adds latency. Keep at 0 for real-time    |
| `useSpeakerBoost`          | boolean | -       | false   | **false**           | Adds latency for minimal quality gain                        |
| `speed`                    | number  | 0.7-1.2 | 1.0     | **0.95-1.05**       | Natural conversation range                                   |
| `optimizeStreamingLatency` | number  | 0-4     | -       | **4**               | Max speed priority (0=quality, 4=speed)                      |
| `model`                    | string  | -       | -       | `eleven_flash_v2_5` | Best quality/latency ratio                                   |

**Recommended for max human-like quality:**

- `stability`: 0.45 (allows natural emotional variation)
- `similarityBoost`: 0.75
- `style`: 0
- `speed`: 1.0
- `optimizeStreamingLatency`: 4

### Cartesia Sonic-3 Configuration

```json
{
  "voice": {
    "provider": "cartesia",
    "voiceId": "<voice-id>",
    "experimentalControls": {
      "speed": "normal",
      "emotion": [
        { "name": "positivity", "level": "medium" },
        { "name": "curiosity", "level": "medium" }
      ]
    }
  }
}
```

**Parameters:**

| Field                          | Type             | Values                                                        | Notes                                                                                         |
| ------------------------------ | ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `experimentalControls.speed`   | string or number | "slowest", "slow", "normal", "fast", "fastest" or -1.0 to 1.0 | 0 = default speed                                                                             |
| `experimentalControls.emotion` | array            | Objects with `name` and `level`                               | Names: positivity, negativity, curiosity, surprise, anger, sadness. Levels: low, medium, high |

**WARNING:** As of mid-2025, Cartesia experimentalControls through Vapi have been reported as unreliable. The settings may appear in API responses but not produce observable effects. Test thoroughly. Cartesia's direct API works fine -- the issue is in Vapi's integration layer.

### OpenAI TTS Configuration

```json
{
  "voice": {
    "provider": "openai",
    "voiceId": "alloy",
    "speed": 1.0
  }
}
```

| Field     | Type   | Range                              | Notes                                  |
| --------- | ------ | ---------------------------------- | -------------------------------------- |
| `voiceId` | string | alloy, echo, shimmer, marin, cedar | marin and cedar are realtime-exclusive |
| `speed`   | number | 0.25-4.0                           | 1.0 = normal                           |

### PlayHT Configuration

```json
{
  "voice": {
    "provider": "playht",
    "voiceId": "<voice-id>",
    "temperature": 1.0,
    "emotion": "friendly",
    "voiceGuidance": 2,
    "styleGuidance": 15,
    "speed": 1.0
  }
}
```

| Field           | Type   | Notes                             |
| --------------- | ------ | --------------------------------- |
| `temperature`   | number | Controls randomness/creativity    |
| `emotion`       | string | Emotion tag for delivery          |
| `voiceGuidance` | number | How closely to follow the voice   |
| `styleGuidance` | number | Numeric value (not nested object) |
| `speed`         | number | Speech rate                       |

### Vapi Native Voices (Simplest Setup)

```json
{
  "voice": {
    "provider": "vapi",
    "voiceId": "Elliot"
  }
}
```

Available voices (as of March 2026):

- **Elliot** (Canadian M, 20s): realistic, friendly, professional, soothing
- **Emma** (Asian American F, 20s): realistic, warm, conversational
- **Clara** (American F, 30s): realistic, warm, professional
- **Kai** (American M, 30s): realistic, friendly, relaxed, approachable
- **Nico** (American M, 20s): realistic, young, casual, natural
- **Rohan** (Indian American M, 20s): realistic, bright, energetic
- **Savannah** (American Southern F, 20s): realistic, straightforward
- **Sagar** (Indian American M, 20s): realistic, steady, professional
- **Godfrey** (American M, 20s): realistic, young, energetic
- **Neil** (Indian American M, 20s): realistic, clear, professional

---

## 3. Turn Detection / Endpointing

This is the **single most important factor** for natural-sounding conversations. Bad endpointing = AI cuts off callers or has unnaturally long pauses.

### Smart Endpointing Providers

| Provider          | Type        | Best For                  | How It Works                                                                     |
| ----------------- | ----------- | ------------------------- | -------------------------------------------------------------------------------- |
| **Krisp**         | Audio-based | Non-English, universal    | Analyzes intonation, pitch, rhythm. Always fires, even for brief acknowledgments |
| **Deepgram Flux** | Audio+text  | English with Deepgram STT | Built-in EOT detection, Nova-3 accuracy                                          |
| **Assembly**      | Audio+text  | English with Assembly STT | Neural network confidence scoring                                                |
| **LiveKit**       | Text-based  | English without Deepgram  | Confidence-to-wait-time mapping function                                         |
| **Vapi**          | Text-based  | General fallback          | Basic text-based detection                                                       |
| **Off**           | Text-based  | Manual control only       | Uses only transcriptionEndpointingPlan                                           |

### Recommended Configuration: Quality-First

```json
{
  "startSpeakingPlan": {
    "waitSeconds": 0.4,
    "smartEndpointingPlan": {
      "provider": "deepgram-flux"
    },
    "transcriptionEndpointingPlan": {
      "onPunctuationSeconds": 0.1,
      "onNoPunctuationSeconds": 1.5,
      "onNumberSeconds": 0.5
    }
  }
}
```

### Recommended Configuration: Prevent Cutting Off Callers

For use cases where callers give long answers (addresses, account numbers, detailed descriptions):

```json
{
  "startSpeakingPlan": {
    "waitSeconds": 1.5,
    "smartEndpointingPlan": {
      "provider": "deepgram-flux"
    },
    "transcriptionEndpointingPlan": {
      "onPunctuationSeconds": 4.0,
      "onNoPunctuationSeconds": 5.0,
      "onNumberSeconds": 4.0
    }
  }
}
```

### Recommended Configuration: Minimum Latency

```json
{
  "startSpeakingPlan": {
    "waitSeconds": 0.2,
    "smartEndpointingPlan": {
      "provider": "deepgram-flux"
    },
    "transcriptionEndpointingPlan": {
      "onPunctuationSeconds": 0.05,
      "onNoPunctuationSeconds": 0.8,
      "onNumberSeconds": 0.3
    }
  }
}
```

### Custom Endpointing Rules

Override defaults for specific patterns (highest priority):

```json
{
  "startSpeakingPlan": {
    "customEndpointingRules": [
      {
        "type": "user",
        "regex": "\\d{4,}",
        "timeoutSeconds": 3.0
      },
      {
        "type": "user",
        "regex": "(address|street|avenue|boulevard)",
        "timeoutSeconds": 4.0
      }
    ]
  }
}
```

### Parameter Reference

| Field                                     | Type   | Range | Default | Description                                 |
| ----------------------------------------- | ------ | ----- | ------- | ------------------------------------------- |
| `waitSeconds`                             | number | 0-5   | 0.4     | Final audio delay before assistant responds |
| `onPunctuationSeconds`                    | number | -     | 0.1     | Delay after punctuation detected            |
| `onNoPunctuationSeconds`                  | number | -     | 1.5     | Delay when no punctuation present           |
| `onNumberSeconds`                         | number | -     | 0.5     | Delay after number detection                |
| `customEndpointingRules[].regex`          | string | -     | -       | Pattern to match (highest priority)         |
| `customEndpointingRules[].timeoutSeconds` | number | -     | -       | Custom wait when pattern matches            |

### Transcriber-Level Endpointing (Deepgram Flux)

| Field          | Type   | Default | Description                            |
| -------------- | ------ | ------- | -------------------------------------- |
| `eotThreshold` | number | 0.7     | End-of-turn confidence threshold (0-1) |
| `eotTimeoutMs` | number | 5000    | Max wait before forcing turn end       |

### Transcriber-Level Endpointing (Assembly)

| Field                              | Type   | Default | Description                                   |
| ---------------------------------- | ------ | ------- | --------------------------------------------- |
| `endOfTurnConfidenceThreshold`     | number | 0.4     | Neural network confidence for turn completion |
| `minEndOfTurnSilenceWhenConfident` | number | 160ms   | Min silence when confident                    |
| `maxTurnSilence`                   | number | 400ms   | Max silence before forcing turn end           |

### LiveKit waitFunction

When using LiveKit smart endpointing:

```json
{
  "smartEndpointingPlan": {
    "provider": "livekit",
    "waitFunction": "200 + 8000 * x"
  }
}
```

Where `x` is probability (0=confident user stopped, 1=confident user still speaking). Default creates 200ms-8200ms wait range.

---

## 4. Backchanneling

Backchanneling adds affirmations like "yeah", "uh-huh", "got it", "I see", "right", "OK" at natural moments during caller speech. This is NOT an interruption -- it signals the AI is listening and understanding.

### How It Works

Vapi uses a **proprietary fusion audio-text model** to:

1. Determine the best moment to backchannel
2. Decide which backchannel cue is most appropriate (context-dependent)

### Configuration

```json
{
  "backchannelingEnabled": true
}
```

| Field                   | Type    | Default | Description                   |
| ----------------------- | ------- | ------- | ----------------------------- |
| `backchannelingEnabled` | boolean | false   | Enable/disable backchanneling |

**NOTE:** As of October 2024, `backchannelingEnabled` was reported as removed from the create/update Assistant API. However, it still appears in current API docs. Test your specific API version. If the field is not accepted, Vapi may have moved this to automatic behavior or a different configuration path.

### Interaction with Stop Speaking Plan

The `stopSpeakingPlan.acknowledgementPhrases` array lets you define phrases the assistant should IGNORE when it is speaking (not treat as interruptions):

```json
{
  "stopSpeakingPlan": {
    "acknowledgementPhrases": [
      "yeah",
      "uh-huh",
      "ok",
      "got it",
      "right",
      "sure",
      "mm-hmm"
    ]
  }
}
```

This prevents the assistant from stopping mid-sentence when the caller says "yeah" or "uh-huh" while listening.

---

## 5. Filler Words / Thinking Sounds

Filler injection adds natural conversational fillers like "um", "like", "so", "well" to assistant responses, making them sound less robotic and masking processing latency.

### Configuration

```json
{
  "fillerInjectionEnabled": true
}
```

| Field                    | Type    | Default | Description                  |
| ------------------------ | ------- | ------- | ---------------------------- |
| `fillerInjectionEnabled` | boolean | false   | Enable filler word injection |

### How It Works

Vapi uses a **custom model** that converts streaming LLM output and makes it sound conversational in real-time. The model inserts appropriate fillers based on context.

### Prompt-Level Filler Techniques

Even without `fillerInjectionEnabled`, you can instruct the LLM to include natural speech patterns in the system prompt:

```
Voice Realism Rules:
- Use natural fillers: "um", "uh", "well", "so", "let me see"
- Use hesitations: "I... I think", "that's... that's a great question"
- Use ellipsis for pauses: "Let me check on that..."
- Stutter occasionally for realism: "I-I can help with that"
```

### Best Practice

Enable `fillerInjectionEnabled` AND add filler instructions in the prompt. The automated system handles real-time injection, while prompt instructions shape the LLM's natural output patterns.

---

## 6. Latency Optimization

### Achievable Targets

| Scenario                 | Target E2E Latency |
| ------------------------ | ------------------ |
| Web calls (best case)    | ~465ms             |
| Phone calls (typical)    | ~965ms+            |
| Phone calls (acceptable) | <1500ms            |

### Lowest-Latency Stack (465ms target)

| Component          | Provider   | Model                              | Latency          |
| ------------------ | ---------- | ---------------------------------- | ---------------- |
| STT                | AssemblyAI | Universal-Streaming                | ~90ms            |
| LLM                | Groq       | Llama 4 Maverick 17B 128e Instruct | ~200ms           |
| TTS                | ElevenLabs | Flash v2.5                         | ~75ms            |
| **Pipeline total** |            |                                    | **~365ms**       |
| + Network overhead |            |                                    | **~465ms (web)** |

### Quality-Optimized Stack (sub-1s target)

| Component          | Provider   | Model        | Latency    |
| ------------------ | ---------- | ------------ | ---------- |
| STT                | Deepgram   | Nova-3       | ~150ms     |
| LLM                | OpenAI     | GPT-4.1-mini | ~300ms     |
| TTS                | ElevenLabs | Flash v2.5   | ~75ms      |
| **Pipeline total** |            |              | **~525ms** |

### What Adds Latency and How to Reduce It

| Factor                         | Impact                      | Fix                                           |
| ------------------------------ | --------------------------- | --------------------------------------------- |
| **Turn detection defaults**    | +1500ms (biggest offender!) | Reduce `onNoPunctuationSeconds` from 1.5s     |
| **STT formatting**             | +50-100ms                   | Set `formatTurns: false` on transcriber       |
| **ElevenLabs style > 0**       | +100-200ms                  | Keep `style: 0`                               |
| **ElevenLabs useSpeakerBoost** | +50ms                       | Set to `false`                                |
| **LLM max tokens**             | Variable                    | Limit `maxTokens` to 150-200                  |
| **Long system prompts**        | +50-200ms per call          | Keep prompts concise                          |
| **TTS model choice**           | 75ms vs 400ms               | Use Flash v2.5 not Multilingual v2            |
| **Server region**              | +20-100ms                   | Choose server closest to users                |
| **Audio caching disabled**     | Re-generates common phrases | Enable caching for greetings/common responses |

### Critical Optimization: Turn Detection

Default Vapi settings add **1.5 seconds** of unnecessary delay via `onNoPunctuationSeconds`. This single change can 4x your perceived speed:

```json
{
  "startSpeakingPlan": {
    "waitSeconds": 0.3,
    "transcriptionEndpointingPlan": {
      "onPunctuationSeconds": 0.08,
      "onNoPunctuationSeconds": 0.8,
      "onNumberSeconds": 0.4
    }
  }
}
```

### LLM Optimization

- Keep `maxTokens` at 150-200 for voice (shorter = faster generation)
- Stream tokens (Vapi does this by default)
- Instruct the model to be concise: "Keep responses under 2 sentences. Be direct."
- Trim prompt history / limit conversation context window

---

## 7. Interruption Handling

### Stop Speaking Plan Configuration

```json
{
  "stopSpeakingPlan": {
    "numWords": 0,
    "voiceSeconds": 0.2,
    "backoffSeconds": 1.0,
    "acknowledgementPhrases": [
      "yeah",
      "uh-huh",
      "ok",
      "mm-hmm",
      "right",
      "sure",
      "got it"
    ],
    "interruptionPhrases": ["stop", "wait", "hold on", "actually", "no no"]
  }
}
```

### Parameter Details

| Field                    | Type   | Range | Default | Description                                                                                        |
| ------------------------ | ------ | ----- | ------- | -------------------------------------------------------------------------------------------------- |
| `numWords`               | number | 0-10  | 0       | Words required to trigger interruption. **0 = use VAD** (recommended for natural feel)             |
| `voiceSeconds`           | number | 0-0.5 | 0.2     | VAD duration threshold (when numWords=0). How long caller must speak to be considered interrupting |
| `backoffSeconds`         | number | 0-10  | 1.0     | Audio blocking period after interruption. Prevents the assistant from immediately resuming         |
| `acknowledgementPhrases` | array  | -     | []      | Phrases to IGNORE during assistant speech (not treated as interruptions)                           |
| `interruptionPhrases`    | array  | -     | []      | Phrases that trigger INSTANT pipeline clear (immediate stop)                                       |

### How Interruption Works Internally

1. VAD detects caller speech start
2. If `numWords` > 0: waits for N words before treating as interruption
3. If `numWords` = 0: uses `voiceSeconds` threshold (0.2s = very responsive)
4. On interruption: LLM request aborted, TTS stops, audio buffers cleared (all in <100ms)
5. System uses word-level TTS timestamps to know exactly what the caller heard
6. `backoffSeconds` prevents immediate resume (avoids rapid back-and-forth)

### Recommended Settings

**For natural conversation (default):**

- `numWords`: 0 (use VAD)
- `voiceSeconds`: 0.2
- `backoffSeconds`: 1.0
- Add common acknowledgement phrases to prevent false interruptions

**For patient listening (medical, support):**

- `numWords`: 2-3 (require actual words, not just sounds)
- `voiceSeconds`: 0.3
- `backoffSeconds`: 1.5

---

## 8. Background Noise Handling

### Smart Denoising (Krisp) -- RECOMMENDED

```json
{
  "backgroundDenoisingEnabled": true
}
```

Or via the detailed plan:

```json
{
  "smartDenoisingPlan": {
    "enabled": true
  }
}
```

Uses Krisp's AI-powered technology. Handles most common noise scenarios without additional configuration. **This is the recommended default for all production deployments.**

### Fourier Denoising (Experimental -- Advanced)

For environments with persistent background media (TV, radio, music):

```json
{
  "fourierDenoisingPlan": {
    "enabled": true,
    "mediaDetectionEnabled": true,
    "staticThreshold": -35,
    "baselineOffsetDb": -15,
    "windowSizeMs": 3000,
    "baselinePercentile": 85
  }
}
```

| Field                   | Type    | Range      | Default | Description                                                 |
| ----------------------- | ------- | ---------- | ------- | ----------------------------------------------------------- |
| `enabled`               | boolean | -          | false   | Enable Fourier denoising                                    |
| `mediaDetectionEnabled` | boolean | -          | true    | Auto-detect TV/music/radio                                  |
| `staticThreshold`       | number  | -80 to 0   | -35     | Fallback threshold (dB) when no baseline                    |
| `baselineOffsetDb`      | number  | -30 to -5  | -15     | Filtering intensity. Lower = more aggressive                |
| `windowSizeMs`          | number  | 1000-30000 | 3000    | Baseline computation window                                 |
| `baselinePercentile`    | number  | 1-99       | 85      | Percentile for baseline (higher = prioritize louder speech) |

**IMPORTANT:** Never use Fourier denoising alone. It is designed to complement Smart Denoising (Krisp). Always enable both if using Fourier.

### Background Sound (Ambient Audio)

Add ambient office sounds to make the AI side sound more natural:

```json
{
  "backgroundSound": "office"
}
```

| Field             | Type   | Values                                  | Default                        |
| ----------------- | ------ | --------------------------------------- | ------------------------------ |
| `backgroundSound` | string | "off", "office", or URL to custom audio | "office" (phone) / "off" (web) |

For phone calls, the default "office" background adds subtle ambient sound that makes the AI feel more like a real receptionist. You can also provide a URL to a custom audio file.

---

## 9. Silence Detection & Timeout

### Silence Timeout

```json
{
  "silenceTimeoutSeconds": 30
}
```

| Field                   | Type   | Range  | Default | Description                               |
| ----------------------- | ------ | ------ | ------- | ----------------------------------------- |
| `silenceTimeoutSeconds` | number | 1-1000 | 30      | Seconds of silence before ending the call |

### Max Call Duration

```json
{
  "maxDurationSeconds": 1800
}
```

| Field                | Type   | Default      | Description                                               |
| -------------------- | ------ | ------------ | --------------------------------------------------------- |
| `maxDurationSeconds` | number | 600 (10 min) | Maximum call length. Set higher for complex conversations |

### Idle Messages (Customer Speech Timeout)

Configure assistant hooks to handle prolonged silence before ending the call:

```json
{
  "hooks": [
    {
      "on": "customer.speech.timeout",
      "options": {
        "timeoutSeconds": 10,
        "triggerMaxCount": 3,
        "triggerResetMode": "onUserSpeech"
      },
      "do": [
        {
          "type": "say",
          "exact": [
            "Are you still there?",
            "I'm still here if you need anything.",
            "Take your time, I'm here whenever you're ready."
          ]
        }
      ],
      "name": "idle_check"
    }
  ]
}
```

| Field              | Type   | Range                    | Default | Description                             |
| ------------------ | ------ | ------------------------ | ------- | --------------------------------------- |
| `timeoutSeconds`   | number | 1-1000                   | 7.5     | How long to wait before triggering      |
| `triggerMaxCount`  | number | 1-10                     | 3       | Max times to trigger per conversation   |
| `triggerResetMode` | string | "never" / "onUserSpeech" | "never" | Whether to reset count when user speaks |

**Tips:**

- Account for 2-3 seconds of processing delay when setting timeout values
- Hooks automatically disable during tool calls and transfers
- Use `exact` messages for consistency, or `prompt` with `{{transcript}}` for context-aware responses

---

## 10. Emotional Tone & Personality

### Emotion Recognition

```json
{
  "emotionRecognitionEnabled": true
}
```

| Field                       | Type    | Default | Description                           |
| --------------------------- | ------- | ------- | ------------------------------------- |
| `emotionRecognitionEnabled` | boolean | false   | Detect caller emotion and send to LLM |

When enabled, Vapi extracts the emotional inflection of the user's speech and feeds it to the LLM as additional context, allowing the agent to adapt tone dynamically.

### Prompt Engineering for Personality

Structure your system prompt with explicit personality sections:

```
## Identity
You are Sarah, a friendly receptionist at [Business Name]. You are warm, helpful, and genuinely care about helping callers.

## Personality
- Tone: conversational, warm, not corporate or stiff
- Speak naturally like a real person, not a script
- Show genuine interest in the caller's needs
- Use the caller's name when you learn it
- Mirror the caller's energy level

## Voice Realism
- Use natural fillers: "um", "well", "let me see"
- Use hesitations when thinking: "That's... that's a great question"
- Express emotion: "Oh no, I'm sorry to hear that!" or "That's wonderful!"
- Pause with ellipses for dramatic effect: "Let me check on that..."

## Speech Rules
- Spell out numbers: say "Four Thirty PM" not "4:30 PM"
- Express dates as words: "January Twenty-Fourth" not "1/24"
- Keep responses under 2 sentences unless the caller needs detail
- Ask one question at a time
- Begin responses with direct answers, not preamble
```

### SSML for Emotional Delivery

For providers that support SSML:

```xml
<speak>
  <prosody rate="slow" pitch="low">I'm sorry to hear that.</prosody>
  <break time="500ms"/>
  <prosody rate="medium" pitch="medium">Let me see what I can do to help.</prosody>
</speak>
```

Supported SSML tags:

- `<prosody>` - pitch, rate, volume
- `<emphasis>` - stress words (levels: strong, moderate, reduced)
- `<break>` - timed pauses
- `<say-as>` - interpret dates, numbers, phone numbers
- `<phoneme>` - exact pronunciation (IPA alphabet)
- `<sub>` - spoken substitutions for abbreviations

---

## 11. First Message / Greeting

### Configuration

```json
{
  "firstMessage": "Hi there! Thanks for calling [Business Name], this is Sarah. How can I help you today?",
  "firstMessageMode": "assistant-speaks-first"
}
```

| Field              | Type   | Values                    | Default                  | Description                                             |
| ------------------ | ------ | ------------------------- | ------------------------ | ------------------------------------------------------- |
| `firstMessage`     | string | Text or URL to audio file | null                     | First thing the assistant says. If null, waits for user |
| `firstMessageMode` | string | See below                 | "assistant-speaks-first" | When the greeting is delivered                          |

### First Message Modes

| Mode                                                  | Behavior                                       | Use Case                          |
| ----------------------------------------------------- | ---------------------------------------------- | --------------------------------- |
| `assistant-speaks-first`                              | Immediately speaks the firstMessage            | Standard inbound calls            |
| `assistant-waits-for-user`                            | Waits for caller to speak first, then responds | Outbound calls, transfers         |
| `assistant-speaks-first-with-model-generated-message` | LLM generates the greeting based on context    | Dynamic greetings, warm transfers |

### Best Practices for Greetings

1. **Keep it short** -- under 3 seconds of audio
2. **Include the business name** -- caller confirms they reached the right place
3. **Give a name** -- "this is Sarah" feels personal
4. **End with an open question** -- "How can I help?" invites the caller to speak
5. **Pre-record for lowest latency** -- provide an audio URL instead of text for instant playback

```json
{
  "firstMessage": "https://your-cdn.com/greeting.mp3",
  "firstMessageMode": "assistant-speaks-first"
}
```

---

## 12. Voice Speed & Pacing

### By Provider

| Provider   | Field                        | Range                 | Default      | Recommended   |
| ---------- | ---------------------------- | --------------------- | ------------ | ------------- |
| ElevenLabs | `speed`                      | 0.7-1.2               | 1.0          | 0.95-1.05     |
| OpenAI     | `speed`                      | 0.25-4.0              | 1.0          | 0.9-1.1       |
| Cartesia   | `experimentalControls.speed` | -1.0 to 1.0 or string | 0 / "normal" | "normal" or 0 |
| PlayHT     | `speed`                      | varies                | 1.0          | 0.9-1.1       |
| Azure      | `speed`                      | 0.5-2.0               | 1.0          | 0.9-1.1       |
| LMNT       | `speed`                      | 0.25-2.0              | 1.0          | 0.9-1.1       |

### Prompt-Level Pacing Control

Add explicit pacing instructions in the system prompt:

```
## Pacing Rules
- Speak at a natural, conversational pace
- Slow down slightly when delivering important information (phone numbers, addresses, prices)
- Speed up slightly for pleasantries and transitions
- Never rush through confirmations -- repeat key details slowly
- When the caller seems confused, slow down and simplify
```

### SSML Pacing

```xml
<speak>
  Your appointment is confirmed for
  <prosody rate="slow">Tuesday, January Twenty-Fourth at Two Thirty PM</prosody>.
  <break time="300ms"/>
  Is there anything else I can help with?
</speak>
```

---

## 13. Complete Recommended Configuration

### Quality-First Configuration (Human-Like Priority)

```json
{
  "name": "Human-Like Receptionist",

  "firstMessage": "Hi there! Thanks for calling, this is Sarah. How can I help you today?",
  "firstMessageMode": "assistant-speaks-first",

  "transcriber": {
    "provider": "deepgram",
    "model": "nova-3",
    "language": "en",
    "smartFormat": true
  },

  "model": {
    "provider": "openai",
    "model": "gpt-4.1-mini",
    "temperature": 0.8,
    "maxTokens": 200,
    "messages": [
      {
        "role": "system",
        "content": "[Your system prompt with personality, voice realism rules, etc.]"
      }
    ]
  },

  "voice": {
    "provider": "11labs",
    "voiceId": "<your-chosen-voice-id>",
    "model": "eleven_flash_v2_5",
    "stability": 0.45,
    "similarityBoost": 0.75,
    "style": 0,
    "useSpeakerBoost": false,
    "speed": 1.0,
    "optimizeStreamingLatency": 4
  },

  "startSpeakingPlan": {
    "waitSeconds": 0.4,
    "smartEndpointingPlan": {
      "provider": "deepgram-flux"
    },
    "transcriptionEndpointingPlan": {
      "onPunctuationSeconds": 0.1,
      "onNoPunctuationSeconds": 1.5,
      "onNumberSeconds": 0.5
    }
  },

  "stopSpeakingPlan": {
    "numWords": 0,
    "voiceSeconds": 0.2,
    "backoffSeconds": 1.0,
    "acknowledgementPhrases": [
      "yeah",
      "uh-huh",
      "ok",
      "mm-hmm",
      "right",
      "sure",
      "got it",
      "yes"
    ],
    "interruptionPhrases": [
      "stop",
      "wait",
      "hold on",
      "actually",
      "no no",
      "never mind"
    ]
  },

  "backchannelingEnabled": true,
  "fillerInjectionEnabled": true,
  "emotionRecognitionEnabled": true,
  "backgroundDenoisingEnabled": true,
  "backgroundSound": "office",

  "silenceTimeoutSeconds": 30,
  "maxDurationSeconds": 1800,

  "hooks": [
    {
      "on": "customer.speech.timeout",
      "options": {
        "timeoutSeconds": 10,
        "triggerMaxCount": 3,
        "triggerResetMode": "onUserSpeech"
      },
      "do": [
        {
          "type": "say",
          "exact": [
            "Are you still there?",
            "I'm still here if you need anything.",
            "Take your time, I'm here whenever you're ready."
          ]
        }
      ],
      "name": "idle_check"
    }
  ]
}
```

### Low-Latency Configuration (Speed Priority, Still Natural)

```json
{
  "name": "Fast Receptionist",

  "firstMessage": "Hi! How can I help you?",
  "firstMessageMode": "assistant-speaks-first",

  "transcriber": {
    "provider": "assembly-ai",
    "model": "universal-streaming",
    "formatTurns": false
  },

  "model": {
    "provider": "groq",
    "model": "llama-4-maverick-17b-128e-instruct",
    "temperature": 0.7,
    "maxTokens": 150
  },

  "voice": {
    "provider": "11labs",
    "voiceId": "<your-chosen-voice-id>",
    "model": "eleven_flash_v2_5",
    "stability": 0.5,
    "similarityBoost": 0.75,
    "style": 0,
    "useSpeakerBoost": false,
    "speed": 1.0,
    "optimizeStreamingLatency": 4
  },

  "startSpeakingPlan": {
    "waitSeconds": 0.2,
    "smartEndpointingPlan": {
      "provider": "deepgram-flux"
    },
    "transcriptionEndpointingPlan": {
      "onPunctuationSeconds": 0.05,
      "onNoPunctuationSeconds": 0.8,
      "onNumberSeconds": 0.3
    }
  },

  "stopSpeakingPlan": {
    "numWords": 0,
    "voiceSeconds": 0.2,
    "backoffSeconds": 0.8,
    "acknowledgementPhrases": ["yeah", "uh-huh", "ok", "mm-hmm", "right"]
  },

  "backchannelingEnabled": true,
  "fillerInjectionEnabled": true,
  "backgroundDenoisingEnabled": true,
  "backgroundSound": "office",

  "silenceTimeoutSeconds": 30,
  "maxDurationSeconds": 1800
}
```

### Budget Configuration (Cost-Conscious, Still Good)

```json
{
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-3",
    "language": "en"
  },
  "model": {
    "provider": "openai",
    "model": "gpt-4.1-mini",
    "maxTokens": 150
  },
  "voice": {
    "provider": "vapi",
    "voiceId": "Emma"
  },
  "startSpeakingPlan": {
    "waitSeconds": 0.4,
    "smartEndpointingPlan": {
      "provider": "deepgram-flux"
    }
  },
  "backchannelingEnabled": true,
  "fillerInjectionEnabled": true,
  "backgroundDenoisingEnabled": true,
  "backgroundSound": "office"
}
```

---

## Key Takeaways

1. **Turn detection is the #1 lever.** Default `onNoPunctuationSeconds` of 1.5s adds massive perceived latency. Tune this first.

2. **ElevenLabs Flash v2.5 is the sweet spot** for quality vs latency. Turbo v2.5 is marginally better quality but ~125ms slower.

3. **Enable backchanneling + filler injection.** These two features alone make the biggest difference in perceived naturalness.

4. **Add acknowledgementPhrases** to prevent false interruptions from "yeah", "uh-huh" etc.

5. **Keep `style: 0` and `useSpeakerBoost: false`** on ElevenLabs. They add latency with minimal quality gain for real-time.

6. **Use `backgroundSound: "office"`** for phone calls. The subtle ambient noise makes the AI feel like a real office.

7. **Prompt engineering matters hugely.** Instruct the LLM to use natural speech patterns, fillers, and emotional responses.

8. **Spell out numbers and dates** in the prompt instructions for natural TTS rendering.

9. **Enable Smart Denoising** (Krisp) for all production deployments. Clean audio = better STT = better responses.

10. **Pre-record greetings** for instant playback instead of waiting for TTS on the first message.

---

## Cost Estimate (Per Minute)

| Configuration     | Vapi Platform | STT                 | LLM                   | TTS               | Total      |
| ----------------- | ------------- | ------------------- | --------------------- | ----------------- | ---------- |
| **Quality-first** | $0.05         | $0.01 (Deepgram)    | ~$0.02 (GPT-4.1-mini) | $0.018 (EL Flash) | ~$0.10/min |
| **Low-latency**   | $0.05         | $0.00025 (Assembly) | ~$0.01 (Groq)         | $0.018 (EL Flash) | ~$0.08/min |
| **Budget**        | $0.05         | $0.01 (Deepgram)    | ~$0.02 (GPT-4.1-mini) | $0.0216 (Vapi)    | ~$0.10/min |
| **Premium**       | $0.05         | $0.01 (Deepgram)    | ~$0.03 (GPT-4.1)      | $0.036 (EL Turbo) | ~$0.13/min |

Note: Real-world costs often land $0.15-0.25/min when all provider charges are stacked. These are estimates based on published rates.

---

## Sources

- [Vapi Speech Configuration](https://docs.vapi.ai/customization/speech-configuration)
- [Vapi Voice Pipeline Configuration](https://docs.vapi.ai/customization/voice-pipeline-configuration)
- [Vapi Orchestration Models](https://docs.vapi.ai/how-vapi-works)
- [Vapi Prompting Guide](https://docs.vapi.ai/prompting-guide)
- [Vapi Voice Fallback Plans](https://docs.vapi.ai/voice-fallback-plan)
- [Vapi Idle Messages](https://docs.vapi.ai/assistants/idle-messages)
- [Vapi Background Speech Denoising](https://docs.vapi.ai/documentation/assistants/conversation-behavior/background-speech-denoising)
- [Vapi Vapi Voices](https://docs.vapi.ai/providers/voice/vapi-voices)
- [Vapi ElevenLabs Integration](https://docs.vapi.ai/providers/voice/elevenlabs)
- [Vapi Cartesia Integration](https://docs.vapi.ai/providers/voice/cartesia)
- [Vapi OpenAI Realtime](https://docs.vapi.ai/openai-realtime)
- [Vapi SSML Guide](https://vapi.ai/blog/mastering-ssml)
- [Vapi Voice Pipeline Architecture (Part 2)](https://vapi.ai/blog/how-we-built-vapi-s-voice-ai-pipeline-part-2)
- [Vapi Audio Caching Blog](https://vapi.ai/blog/audio-caching-for-latency-reduction)
- [AssemblyAI: Lowest Latency Vapi Agent](https://www.assemblyai.com/blog/how-to-build-lowest-latency-voice-agent-vapi)
- [Vapi Community: Bot Cutting Off Callers](https://vapi.ai/community/m/1382747242603221142)
- [Vapi Community: Human-Like Voice](https://vapi.ai/community/m/1418652585036087486)
- [Vapi Community: Cartesia ExperimentalControls Issue](https://vapi.ai/community/m/1377532876371001405)
- [ElevenLabs Voice Settings](https://elevenlabs-sdk.mintlify.app/speech-synthesis/voice-settings)
- [ElevenLabs Models Overview](https://elevenlabs.io/docs/overview/models)
- [TeamDay: Best AI Voice Models 2026](https://www.teamday.ai/blog/best-ai-voice-models-2026)
- [Vapi Optimization Guide](https://voiceaiwrapper.com/insights/vapi-voice-ai-optimization-performance-guide-voiceaiwrapper)
- [VoiceInfra: Voice AI Prompt Engineering Guide](https://voiceinfra.ai/blog/voice-ai-prompt-engineering-complete-guide)
- [Vapi Pricing](https://vapi.ai/pricing)
- [Telnyx: Vapi Pricing Breakdown](https://telnyx.com/resources/vapi-pricing)
- [Vapi Community: Backchanneling Disabled Issue](https://vapi.ai/community/m/1277302680313925695)
- [Vapi Changelog: Oct 2024](https://docs.vapi.ai/changelog)
