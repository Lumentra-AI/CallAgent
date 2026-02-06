# Vapi Voice AI System Architecture: Deep Research Report

**Date:** 2026-02-06
**Sources:** Vapi official docs, blog posts, AssemblyAI technical articles, developer community discussions

---

## 1. Architecture Overview

Vapi is fundamentally an **orchestration layer** over three swappable modules:

1. **Transcriber** (STT) -- Deepgram, AssemblyAI, Gladia, Google, Azure
2. **Model** (LLM) -- OpenAI, Anthropic, Groq, Gemini, custom servers
3. **Voice** (TTS) -- ElevenLabs, PlayHT, Cartesia, Deepgram, OpenAI

On top of these three core modules, Vapi runs a proprietary **Orchestration Layer** consisting of real-time models that are not customizable and run exclusively on Vapi infrastructure:

- **Endpointing** -- Detects when the user finishes speaking
- **Interruption detection** -- Distinguishes real interruptions from backchannels
- **Background noise filtering** -- Cleans ambient noise in real-time
- **Background voice filtering** -- Isolates primary speaker from TV/echo/other people
- **Backchanneling** -- Inserts "yeah", "uh-huh", "got it" at appropriate moments
- **Emotion detection** -- Extracts emotional inflection, feeds it to the LLM
- **Filler injection** -- Adds "um", "like", "so" to make assistant speech natural

All orchestration model processing is **ephemeral** -- audio is not persisted, only final transcripts and call logs are stored.

### Data Flow

```
User Audio
  |
  v
[Transport Layer] -- SIP / Telephony (Twilio/Telnyx) / WebSocket / WebRTC (Daily.co)
  |                   PCM 16-bit 16kHz or Mu-Law 8-bit 8kHz
  v
[Noise Filtering] -- Proprietary real-time denoising (Krisp + Fourier)
  |
  v
[VAD] -- Voice Activity Detection (state machine, 20ms chunks)
  |
  v
[STT - Streaming] -- Partial transcripts flow immediately
  |
  +--> [Orchestration Layer] -- Endpointing, interruption, emotion, backchanneling
  |
  v
[LLM - Streaming] -- Token-by-token generation
  |
  v
[TTS - Streaming] -- Audio chunks sent as generated
  |
  v
[Transport Layer] -- Back to user
```

With maximum customization (custom transcriber, LLM, TTS servers), audio transcription, inference, and synthesis can occur on customer infrastructure while orchestration (endpointing, interruptions, etc.) and transport routing remain on Vapi servers.

---

## 2. Transport Layer

### WebRTC (Primary for Web)

- Powered by **Daily.co** partnership (since 2016)
- Daily's global WebRTC infrastructure provides **~13ms average first-hop latency**
- Web SDK (`@vapi-ai/client-sdk-web`) enables browser-based calls
- Supports React, Next.js, plain JavaScript
- **~100ms network overhead** for web calls

### WebSocket Transport

- Bidirectional raw audio streaming via `wss://api.vapi.ai/[call-id]/transport`
- **Audio formats:**
  - PCM: 16-bit signed little-endian, 16kHz default (supports 8kHz, 44.1kHz)
  - Mu-Law: 8-bit G.711, 8kHz default (telephony-optimized)
- Binary messages = raw audio data
- Text messages = JSON control messages (`{"type": "hangup"}`, etc.)
- Automatic sample rate conversion handled internally
- Sub-200ms latency for live interactions

### Telephony

- SIP trunking with format `sip:username@sip.vapi.ai`
- No SIP registration or authentication required
- PSTN integration via Twilio/Telnyx
- **600ms+ network overhead** for telephony calls (legacy equipment)
- Single codec paths (Opus/G.711) to bypass legacy PBX overhead

### SIP

- Programmable transport layer
- Bring-your-own phone numbers
- Direct PBX integration

---

## 3. VAD (Voice Activity Detection)

### Architecture

Vapi's VAD is built around a **state machine** with four distinct states:

- **IDLE** -- No speech detected
- **STARTING** -- Potential speech onset detected
- **SPEAKING** -- Active speech confirmed (confidence above threshold)
- **STOPPING** -- Speech ending detected, waiting for confirmation (~800ms sustained silence)

### Processing

- Audio processed in **20ms chunks** as it arrives
- Uses **energy-based detection** with a default threshold of ~0.3
- Different confidence thresholds for starting vs. stopping speech
- Confidence-based filtering with multiple decision points:
  - **Basic filtering** -- Removes very low-confidence transcripts automatically
  - **Interruption decisions** -- Only higher-confidence transcripts can interrupt the AI while speaking

### Configuration

- `voiceSeconds`: 0-0.5s (default **0.2s**) -- How long customer must speak before triggering detection
- VAD parameters are **locked at session start** and cannot be changed mid-call
- For noisy environments: increase threshold to 0.5-0.6
- For production: breathing, keyboard clicks, HVAC can exceed 0.3 threshold

### Noise Filtering (Pre-VAD)

Two complementary denoising systems:

1. **Smart Denoising** -- Uses Krisp's AI-powered noise removal in real-time
2. **Fourier Denoising** (experimental) -- Frequency-domain filtering for consistent background noise
   - Rolling 3-second audio window
   - 85th percentile volume calculation for primary speaker level
   - Dynamic offset: filters audio 15dB below moving baseline
   - Baseline updates every 20ms
   - Media detection: activates aggressive mode when variance < 55dB, sustained volume > 1s
   - Media mode: -30dB threshold (vs normal -35dB), -20dB offset (vs -15dB)
   - Adds **< 0.5ms** processing latency
   - 500ms grace period to avoid cutting off word starts

### Background Voice Filtering (Proprietary)

- Standard denoisers preserve human speech (including unwanted background speakers)
- Vapi built a proprietary model that isolates the primary speaker and blocks everything else
- Uses adaptive thresholding that learns speaker differences in real-time
- Background speech is typically quieter -- the model exploits this signal
- Automatic switching between normal and media-optimized filtering modes

---

## 4. Turn-Taking System

### The Core Problem

Simple timeout-based turn detection creates either:

- **Premature interruptions** (timeout too short, cuts people off mid-thought)
- **Awkward dead air** (timeout too long, 4+ seconds of silence)

### Vapi's Approach: Custom Fusion Audio-Text Model

Instead of using a fixed timeout, Vapi uses a **custom fusion audio-text model** that analyzes:

- **Audio features** -- Tone, intonation, pitch, rhythm changes
- **Text content** -- What the user is saying and whether it forms a complete thought
- **Conversation context** -- History of the conversation

Based on both the user's tone AND what they're saying, it decides how long to pause before hitting the LLM. This reduced premature interruptions by **73%** compared to fixed timeouts.

### Greedy Inference Strategy

When Vapi's endpointing model determines the user is done:

1. It **immediately** sends the utterance to the LLM
2. If the user continues speaking (model was wrong):
   - The LLM request is **instantly cancelled**
   - A new request starts with the **updated, complete utterance**
   - The user never hears the scrapped attempt
3. This speculative approach prioritizes responsiveness -- better to cancel a wrong guess than wait for certainty

---

## 5. Endpointing (Smart Endpointing)

### Four Complementary Approaches

#### 5a. Transcription-Based Endpointing (Rule-Based)

Custom delays based on message content patterns:

- `onPunctuationSeconds`: **0.1s** default -- Delay after detecting punctuation
- `onNoPunctuationSeconds`: **1.5s** default -- Delay when no punctuation detected
- `onNumberSeconds`: **0.5s** default -- Delay after numbers
- `waitSeconds`: **0.4s** default -- General wait time before speaking

**CRITICAL:** The default `onNoPunctuationSeconds` of 1.5s is the #1 latency killer. Optimized setups reduce this dramatically.

#### 5b. Smart Endpointing (ML-Based)

Multiple provider options:

| Provider          | Type                   | Best For     | Key Parameter                               |
| ----------------- | ---------------------- | ------------ | ------------------------------------------- |
| **LiveKit**       | Text-based             | English      | `waitFunction`: "200 + 8000 \* x" (default) |
| **Vapi**          | Audio-text fusion      | Non-English  | Proprietary model                           |
| **Krisp**         | Audio-based (prosodic) | Universal    | `threshold`: 0.0-1.0 (default 0.5)          |
| **Deepgram Flux** | Audio-text             | Low-latency  | `eotThreshold`: 0.7, `eotTimeoutMs`: 5000   |
| **Assembly**      | Audio-text             | Configurable | `endOfTurnConfidenceThreshold`: 0.4         |

**LiveKit** analyzes semantic content of transcribed speech using a custom open-weights language model. The `waitFunction` is a mathematical expression where `x` is the probability the user is still speaking. Three presets: aggressive, normal, conservative.

**Krisp** examines acoustic features (intonation, pitch, rhythm). Always fires -- even for brief acknowledgments. Good for detecting natural speech endings.

**Deepgram Flux** combines transcription with native turn detection at low latency.

**Assembly** uses an `end_of_turn` flag from transcripts with configurable confidence thresholds and silence windows.

#### 5c. Custom External Models

Integration with third-party endpointing services for domain-specific logic.

#### 5d. Regex Pattern Matching

Custom rules matching against:

- Assistant responses
- User inputs
- Both
  Triggers context-aware endpointing behavior with custom `timeoutSeconds` per pattern.

### Configuration Example (Custom Rules)

```json
{
  "customEndpointingRules": [
    {
      "type": "user",
      "regex": "\\d+",
      "timeoutSeconds": 3.0
    }
  ]
}
```

---

## 6. Barge-In / Interruption Handling

### Stop Speaking Plan

Controls how interruptions are detected and handled when users speak while the assistant is talking.

#### Detection Parameters

- `numWords`: 0-10 (default **0**) -- Words customer must say before assistant stops
  - At 0: Uses VAD-based detection (fastest, reacts to any voice)
  - Above 0: Uses transcription-based detection (more accurate, slightly slower)
- `voiceSeconds`: 0-0.5s (default **0.2s**) -- Duration of voice activity before triggering
- `backoffSeconds`: 0-10s (default **1.0s**) -- How long assistant waits before resuming after interruption

#### Phrase-Based Detection

- `interruptionPhrases`: Array of phrases that trigger **instant pipeline clear** (e.g., "stop", "hold on")
- `acknowledgementPhrases`: Array of phrases to **ignore** as interruptions (e.g., "okay", "right", "yeah")

#### Interruption Sequence (< 100ms total)

When a genuine interruption is detected:

1. VAD detects speech onset and emits event
2. LLM request is **aborted**
3. TTS generation **stops immediately**
4. Audio buffers are **cleared**
5. System switches to **listening mode**

#### Context Reconstruction

After interruption, Vapi uses **word-level timestamps** from the TTS provider to identify exactly which words the user heard before the interruption. This information is passed to the LLM so it knows what it did and did not successfully communicate.

#### Backchanneling Detection

Vapi's proprietary model distinguishes:

- **True interruptions**: "stop", "hold up", "wait" --> triggers full pipeline clear
- **Backchannels**: "yeah", "uh-huh", "okay", "oh gotcha" --> ignored, treated as affirmations
- Uses a **fusion audio-text model** to determine the best backchannel moment and cue

#### Industry-Specific Tuning

- **Healthcare**: `backoffSeconds: 2.0` for deliberate pauses
- **Gaming/Support**: `backoffSeconds: 0.5` for quick recovery
- **Natural conversation**: `endpointing: 200-400ms`
- **Noisy environments**: `endpointing: 400-500ms`

---

## 7. Speech Pipeline (STT -> LLM -> TTS)

### Design Philosophy

Every phase operates in real-time (sensitive to **50-100ms** level), streaming between every layer. No component waits for the previous one to fully complete.

### STT (Transcriber) Stage

- Streaming speech recognition provides **partial results incrementally**
- Progression: "I need to..." -> "I need to schedule..." -> complete utterance
- Each partial result feeds immediately to subsequent stages
- Confidence-based filtering removes low-quality partials

| Provider                       | Latency      | Notes                  |
| ------------------------------ | ------------ | ---------------------- |
| AssemblyAI Universal-Streaming | **~90ms**    | Currently fastest      |
| Deepgram Nova-2                | **80-120ms** | Consistent performance |
| General streaming ASR          | **40-300ms** | Varies by provider     |

**Key optimization:** Disable formatting (punctuation, capitalization, number processing) to save milliseconds per interaction.

### LLM (Model) Stage

- Token streaming reduces latency vs. waiting for complete responses
- First meaningful token is what matters, not full generation time
- Prompt caching and knowledge prefetch reduce processing time

| Provider                    | Latency       | Notes                |
| --------------------------- | ------------- | -------------------- |
| Groq (Llama 4 Maverick 17B) | **~200ms**    | Fastest inference    |
| GPT-4o-mini                 | **~180ms**    | Good balance         |
| General LLM                 | **100-400ms** | Varies significantly |

**Key optimization:** Keep `maxTokens` low (150-200) for concise voice responses.

### TTS (Voice) Stage

- Streaming audio chunks sent as they are generated
- Voice warming at session start saves 100-200ms
- Phrase caching for common responses

| Provider              | Latency (TTFB) | Notes                                    |
| --------------------- | -------------- | ---------------------------------------- |
| ElevenLabs Flash v2.5 | **~75ms**      | Fastest, set optimizeStreamingLatency: 4 |
| OpenAI TTS            | **~200ms**     |                                          |
| General Neural TTS    | **50-250ms**   | When warmed                              |

### Pipeline Parallelism

The pipeline uses **streaming parallelism** rather than true concurrent execution:

- STT partial results begin flowing to the orchestration layer immediately
- As soon as endpointing triggers, full transcript goes to LLM
- LLM tokens stream directly to TTS as they generate
- TTS begins synthesizing from the first few tokens, not the complete response
- Audio playback begins from first TTS chunk

This means the user hears the beginning of the response while the LLM is still generating the middle/end.

### OpenAI Realtime API (Alternative Pipeline)

Vapi also supports OpenAI's native speech-to-speech Realtime API which bypasses the STT -> LLM -> TTS pipeline entirely:

- Audio in, audio out natively
- Eliminates transcription and TTS stages
- System messages auto-converted to session instructions
- Limited to 5 voices (alloy, echo, shimmer, marin, cedar)
- Some orchestration features unavailable (knowledge bases, custom voice cloning)
- Endpointing and interruption still managed by Vapi's orchestration layer

---

## 8. Latency Optimization

### Target: Sub-500ms End-to-End

- **Conversational flow breaks at >1200ms** between user statement end and agent response start
- Target: **p50 < 500ms, p95 < 800ms**
- Best achieved: **~465ms** end-to-end (web), ~365ms pipeline + ~100ms network

### Optimization Breakdown

| Layer          | Savings     | Technique                                                          |
| -------------- | ----------- | ------------------------------------------------------------------ |
| Network        | 40-100ms    | Regional anchoring, WebRTC, TLS session reuse                      |
| Telephony      | 100-300ms   | Single codec paths, bypass legacy PBX                              |
| ASR            | 150-400ms   | Streaming models, tight end-of-speech timeouts, disable formatting |
| LLM            | 100-300ms   | Token streaming, prompt caching, fast models (Groq)                |
| TTS            | 100-200ms   | Voice warming, phrase caching, high-speed mode                     |
| Application    | 50-200ms    | Async DB/API calls, parallelization                                |
| Turn Detection | 1000-1500ms | Override defaults (the #1 optimization)                            |

### Dynamic LLM Routing (Vapi's Biggest Innovation)

Vapi discovered that OpenAI/Azure latency is **highly volatile** -- varying independently across Azure regions, with models performing well on some days but becoming unusable on others.

**Evolution of their solution:**

1. **Brute-force racing** -- Send to all 40+ Azure deployments, use fastest response. Cost: 40x tokens. Abandoned.

2. **Periodic polling** -- Poll each deployment every 10min with single-token requests, store in Redis. Cost: ~$400/day. Problem: 5+ minute blind spots when deployments degraded between polls.

3. **Exploration-exploitation (final approach):**

   - **Exploitation**: Route majority traffic to currently fastest endpoint
   - **Exploration**: Direct statistically significant subset to test other deployments
   - Real-time detection of performance changes
   - Discovery of newly fast deployments

4. **Dynamic fallback thresholds** (on top of #3):
   - Calculate historical **standard deviation per deployment**
   - Set dynamic timeout thresholds based on each deployment's statistical profile
   - If first request exceeds its outlier threshold, cancel and cascade to second-fastest
   - Continue cascading through ranked deployments

**Result:** Reduced **P95 latency by over 1000ms**, enabling higher-fidelity TTS models.

### Caching Strategies

1. **Audio caching** -- Pre-synthesized speech for common phrases

   - Client-side: local audio for instant playback
   - Server-side: server remembers common phrases
   - Hybrid: both approaches combined

2. **Semantic caching** -- Stores LLM query/response pairs matched by embedding similarity

   - Self-hosted: **~50ms** response time
   - API-based: **~200ms** response time
   - vs. full LLM call: potentially seconds

3. **Prompt caching** -- Reuse cached system prompts and few-shot examples

### Optimal Low-Latency Configuration

```json
{
  "transcriber": {
    "provider": "assembly-ai",
    "model": "universal-streaming",
    "formatTurns": false
  },
  "model": {
    "provider": "groq",
    "model": "llama-4-maverick-17b-128e-instruct",
    "maxTokens": 150
  },
  "voice": {
    "provider": "11labs",
    "model": "eleven_flash_v2_5",
    "optimizeStreamingLatency": 4
  },
  "startSpeakingPlan": {
    "waitSeconds": 0.2,
    "smartEndpointingEnabled": true
  }
}
```

---

## 9. Orchestration Layer Detail

### Backchanneling

- Uses a **proprietary fusion audio-text model**
- Determines the optimal moment for backchannels
- Selects appropriate cue ("uh-huh", "got it", "yeah")
- Wrong-moment backchannels can derail user speech -- timing is critical
- Cannot be fully disabled in some reports (community complaints about persistent fillers)

### Emotion Detection

- Real-time audio model extracts emotional inflection
- Feeds emotional context into the LLM system prompt
- LLM adjusts behavior based on detected emotions (angry, annoyed, confused, neutral)
- Does not persist emotion data

### Filler Injection

- Custom streaming model adds "um", "like", "so" to assistant responses
- Operates in real-time without adding latency
- Does not modify user prompts
- Makes assistant speech patterns more natural

### All Orchestration Models

- Run exclusively on Vapi infrastructure
- Not customizable by users
- Process data ephemerally (no persistence)
- Add minimal latency to the pipeline

---

## Key Architectural Takeaways

1. **Streaming-first design** -- Every component streams to the next; nothing waits for full completion
2. **Speculative execution** -- LLM requests fire before certainty of turn completion, cancelled if wrong
3. **Multi-model orchestration** -- 7+ proprietary models run in parallel on every conversation
4. **Provider-agnostic** -- STT, LLM, TTS are all swappable; orchestration is the moat
5. **Dynamic routing** -- Exploration-exploitation across 40+ Azure deployments for LLM latency
6. **Context preservation** -- Word-level timestamps track exactly what was/wasn't communicated
7. **Ephemeral processing** -- All orchestration audio processing is transient, supporting HIPAA/PCI compliance
8. **Daily.co partnership** -- WebRTC infrastructure provides 13ms first-hop latency globally
9. **Turn detection is the biggest lever** -- Default settings add 1.5s+ of unnecessary latency; optimizing this alone can 4x pipeline speed
10. **Background voice filtering** -- A genuine differentiator solving a problem standard denoisers cannot

---

## Sources

- [How We Built Vapi's Voice AI Pipeline: Part 1](https://vapi.ai/blog/how-we-built-vapi-s-voice-ai-pipeline-part-1)
- [How We Built Vapi's Voice AI Pipeline: Part 2](https://vapi.ai/blog/how-we-built-vapi-s-voice-ai-pipeline-part-2)
- [How We Solved Latency at Vapi](https://vapi.ai/blog/how-we-solved-latency-at-vapi)
- [How We Built Adaptive Background Speech Filtering at Vapi](https://vapi.ai/blog/how-we-built-adaptive-background-speech-filtering-at-vapi)
- [Speech Latency Solutions: Complete Guide to Sub-500ms Voice AI](https://vapi.ai/blog/speech-latency)
- [Audio Caching for Latency Reduction](https://vapi.ai/blog/audio-caching-for-latency-reduction)
- [Orchestration Models | Vapi Docs](https://docs.vapi.ai/how-vapi-works)
- [Voice Pipeline Configuration | Vapi Docs](https://docs.vapi.ai/customization/voice-pipeline-configuration)
- [Speech Configuration | Vapi Docs](https://docs.vapi.ai/customization/speech-configuration)
- [WebSocket Transport | Vapi Docs](https://docs.vapi.ai/calls/websocket-transport)
- [Data Flow | Vapi Docs](https://docs.vapi.ai/security-and-privacy/data-flow)
- [OpenAI Realtime | Vapi Docs](https://docs.vapi.ai/openai-realtime)
- [How to Build the Lowest Latency Voice Agent in Vapi (AssemblyAI)](https://www.assemblyai.com/blog/how-to-build-lowest-latency-voice-agent-vapi)
- [Biggest Challenges in Building AI Voice Agents (AssemblyAI)](https://www.assemblyai.com/blog/biggest-challenges-building-ai-voice-agents-how-assemblyai-vapi-are-solving-them)
- [How Intelligent Turn Detection Solves Voice Agent Challenges (AssemblyAI)](https://www.assemblyai.com/blog/turn-detection-endpointing-voice-agent)
- [Daily and Vapi Partnership](https://www.daily.co/blog/daily-and-vapi-partner-to-deliver-ai-voice-assistants-as-an-api/)
- [Barge-In Handling Guide (VapiPro)](https://vapipro.com/how-to-handle-interruptions-and-over-talking-in-vapi-voice-agents-barge-in-handling-guide/)
- [LiveKit vs Vapi Comparison (Modal)](https://modal.com/blog/livekit-vs-vapi-article)
- [Vapi Latency Optimization (VoiceAIWrapper)](https://voiceaiwrapper.com/insights/vapi-voice-ai-optimization-performance-guide-voiceaiwrapper)
- [How to Optimise Latency for Voice Agents (Nikhil R)](https://rnikhil.com/2025/05/18/how-to-reduce-latency-voice-agents)
