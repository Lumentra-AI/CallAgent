# Vapi TTS Provider Deep Dive (March 2026)

## Research Methodology

- Artificial Analysis Speech Arena leaderboard (65 models ranked by blind ELO)
- Inworld 2026 TTS benchmark report
- Vapi documentation and community forums
- ElevenLabs, Cartesia, Hume official docs
- Developer community feedback (Reddit, forums)
- 25+ web searches cross-referenced

---

## TL;DR Recommendation

**For maximum human-likeness on phone:** ElevenLabs Flash v2.5 or Turbo v2.5
**For best quality/cost ratio:** Inworld TTS 1.5 Max
**For lowest latency:** Cartesia Sonic 3
**For emotional intelligence:** Hume AI Octave 2

If switching from self-hosted LiveKit to Vapi, the #1 pick is **ElevenLabs Turbo v2.5** (best balance of quality + latency + voice library) or **Inworld TTS 1.5 Max** (highest arena ranking at fraction of the cost).

---

## Complete TTS Arena Rankings (Artificial Analysis Speech Arena, March 2026)

65 models ranked by blind A/B comparison ELO scores. Only Vapi-relevant providers shown:

| Rank | Model           | Provider   | ELO   | Win Rate |
| ---- | --------------- | ---------- | ----- | -------- |
| 1    | TTS 1.5 Max     | Inworld    | 1,240 | 76%      |
| 2    | Eleven v3       | ElevenLabs | 1,197 | 70%      |
| 4    | TTS 1.5 Mini    | Inworld    | 1,182 | 68%      |
| 9    | Multilingual v2 | ElevenLabs | 1,129 | 65%      |
| 11   | TTS-1           | OpenAI     | 1,125 | --       |
| 13   | Turbo v2.5      | ElevenLabs | 1,119 | --       |
| 14   | TTS-1 HD        | OpenAI     | 1,114 | --       |
| 15   | Flash v2.5      | ElevenLabs | 1,108 | --       |
| 22   | Sonic 3         | Cartesia   | 1,074 | --       |
| 27   | Azure Neural    | Microsoft  | 1,062 | --       |
| 29   | Octave 2        | Hume AI    | 1,061 | --       |
| 35   | GPT-4o mini TTS | OpenAI     | 1,056 | --       |
| 48   | LMNT            | LMNT       | 985   | --       |
| 54   | Neuphonic TTS   | Neuphonic  | 959   | --       |

**Not ranked on arena:** PlayHT (3.0/PlayDialog), Deepgram Aura-2, Rime AI, Smallest AI

---

## Provider-by-Provider Analysis

### 1. ElevenLabs

**Arena ranking:** #2 (v3, ELO 1197), #9 (Multilingual v2, 1129), #13 (Turbo v2.5, 1119), #15 (Flash v2.5, 1108)

**Models available through Vapi:**
| Model | model_id | Latency (TTFB) | Best For |
|-------|----------|-----------------|----------|
| Flash v2.5 | `eleven_flash_v2_5` | ~75ms | Real-time phone agents (RECOMMENDED) |
| Turbo v2.5 | `eleven_turbo_v2_5` | ~250-300ms | Balanced quality + speed |
| Multilingual v2 | `eleven_multilingual_v2` | ~300-400ms | Non-English or multilingual |
| Eleven v3 | `eleven_v3` | ~500ms+ | NOT for real-time (pre-gen only) |
| v3 Conversational | `eleven_v3_conversational` | ~300ms+ | Higher quality but higher latency |

**Cost through Vapi:** ~$0.036/min (Vapi markup) | ~$206/1M chars (direct)
**BYOK:** Yes, bring your own ElevenLabs API key to Vapi

**Voice cloning:**

- Instant Voice Clone (IVC): 1-5 min audio, good quality, works via API
- Professional Voice Clone (PVC): 30+ min audio (3hr recommended), broadcast quality, website only
- CRITICAL: PVCs are "not fully optimized" for v3 model -- use IVC with v3

**Recommended settings for phone receptionist:**

```json
{
  "stability": 0.5,
  "similarity_boost": 0.75,
  "style": 0,
  "speed": 1.0
}
```

**Known voice IDs (current premade):**

- `EXAVITQu4vr4xnSDxMaL` -- Sarah (female, warm, professional)
- `9BWtsMINqrJLrRacOk9x` -- Aria (female, expressive)
- `21m00Tcm4TlvDq8ikWAM` -- Rachel (female, calm -- DEPRECATED Feb 28 2026)

**DEPRECATION WARNING:** 31 legacy default voices (including Aria, Rachel, Antoni, Josh, etc.) were removed Feb 28, 2026. New replacement voices exist but IDs not publicly documented yet. Must check ElevenLabs voice library or /voices API endpoint for current catalog.

**Languages:** 32+ (Flash v2.5), 70+ (v3, Multilingual v2)

**Emotion/expressiveness:** v3 supports 40+ audio tags for emotional expression. Flash/Turbo rely on stability/similarity_boost tuning. Turbo v2.5 has known "accent drifting" in non-English.

**Verdict:** Best overall voice quality for English. Flash v2.5 is the gold standard for real-time phone agents -- 75ms latency with ELO 1108. Turbo v2.5 if you can tolerate ~250ms for notably better quality (ELO 1119). Expensive but worth it for premium receptionist.

---

### 2. Cartesia Sonic 3

**Arena ranking:** #22 (Sonic 3, ELO 1,074)

**Models available through Vapi:**

- Sonic 3 (current default)
- Sonic English Oct '24 (ELO 1,062) -- older English-optimized model
- Sonic Turbo -- NOT available on Vapi despite existing in Cartesia's API

**Cost through Vapi:** ~$0.031/min | ~$46.70/1M chars (direct)
**Latency:** 40ms TTFB (fastest of all providers)

**Known voice IDs (from our codebase):**

- `694f9389-aac1-45b6-b726-9d9369183238` -- Sarah (female, default)
- `a0e99841-438c-4a64-b679-ae501e7d6091` -- Barbershop Man (male)
- `f786b574-daa5-4673-aa0c-cbe3e8534c02` -- LiveKit default

**Emotion controls through Vapi:** PARTIALLY BROKEN

- Speed and emotion arrays available via `experimentalControls` in Vapi
- Cartesia removed speed/emotion options from newer Sonic-2 versions
- Users report "inconsistent pacing" with Sonic 3 -- speeds up/slows down unpredictably
- Stable/realistic voices work better than "studio/emotive" voices for agents

**Known issues through Vapi:**

- Inconsistent pacing (speed fluctuations mid-sentence)
- Sonic Turbo not available
- experimentalControls may not fully work for all voices
- Some voices sound more "robotic" than ElevenLabs equivalents

**Languages:** 42+

**Verdict:** Fastest TTS available (40ms TTFB) but quality gap vs ElevenLabs is significant (ELO 1074 vs 1108-1197). Good if latency is your absolute priority. Emotion controls are unreliable through Vapi. We already use Cartesia on LiveKit -- switching to ElevenLabs or Inworld on Vapi would be an upgrade.

---

### 3. Inworld TTS

**Arena ranking:** #1 (TTS 1.5 Max, ELO 1,240), #4 (TTS 1.5 Mini, ELO 1,182)

**Models available through Vapi:**

- TTS 1.5 Max (highest quality, ~200-250ms TTFB)
- TTS 1.5 Mini (faster, ~130ms TTFB, still high quality)
- TTS 1 Max (older, ELO 1,184)
- TTS 1 (older, ELO 1,147)

**Cost:** $0.01/min | $5-10/1M chars
**Cost through Vapi:** Not publicly documented but likely $0.01-0.02/min + Vapi markup

**BYOK:** Likely yes (Vapi supports BYOK for most providers)

**Voice library:** Accessible through Inworld TTS Playground (requires free account). Specific voice IDs not publicly documented.

**Voice cloning:** Zero-shot voice cloning included at no extra cost

**Languages:** English primary, expanding to Hindi, Hebrew, Arabic

**Latency:**

- TTS 1.5 Max: P90 TTFB 130-250ms
- TTS 1.5 Mini: P90 TTFB under 130ms

**Emotion/expressiveness:** Context-aware speech synthesis -- understands text meaning and adjusts delivery. No manual emotion tags needed.

**Verdict:** BEST QUALITY ON THE MARKET (ELO 1240, 76% win rate in blind tests) at a fraction of ElevenLabs cost. The Mini model at <130ms latency with ELO 1182 is arguably the best value in TTS today. Relatively new entrant so voice catalog is less mature than ElevenLabs. Worth serious evaluation for any Vapi deployment.

---

### 4. PlayHT

**Arena ranking:** NOT RANKED (not on Artificial Analysis arena)

**Models available through Vapi:**

- PlayDialog (multi-turn two-speaker dialogue, English)
- PlayDialog-turbo (faster, same quality)
- PlayHT 3.0 (general purpose)
- PlayHT 3.0 Mini (faster, lower quality)
- PlayAI Conversational (purpose-built for voice agents)

**Cost through Vapi:** ~$0.0648/min (most expensive non-premium option)
**Cost direct:** Starts at $31.20/month

**Voice library:** 800+ pre-built voices, 100+ languages

**Voice cloning:** Yes, free plan includes 1 clone

**Latency:** Not publicly benchmarked. PlayDialog-turbo claims "faster response times."

**Verdict:** NOT RECOMMENDED. Most expensive per-minute through Vapi, not ranked on any blind quality arena, and 800 voices does not mean 800 good voices. The multi-speaker dialog feature is interesting but irrelevant for a single-voice phone agent. Skip.

---

### 5. OpenAI TTS

**Arena ranking:** #11 (TTS-1, ELO 1,125), #14 (TTS-1 HD, ELO 1,114), #35 (GPT-4o mini TTS, ELO 1,056)

**Models available through Vapi:**

- tts-1 (standard, faster)
- tts-1-hd (higher quality, slower)
- gpt-4o-mini-tts (instruction-following, emotion control via prompts)

**Cost through Vapi:** ~$0.0108/min (cheapest category)
**Cost direct:** ~$15/1M chars | ~$0.015/min

**Available voices:** alloy, echo, fable, onyx, nova, shimmer (6 built-in voices only)

**Latency:** ~200ms TTFB (90th percentile)

**Voice cloning:** None

**Languages:** Follows GPT language support (broad)

**Emotion control:** GPT-4o mini TTS accepts natural language instructions ("speak warmly", "sound excited") but reliability is mixed.

**Verdict:** Surprisingly good quality-to-cost ratio. TTS-1 at ELO 1125 outranks Cartesia Sonic 3 (1074) and costs 3x less. Only 6 voices is a limitation, but "nova" and "alloy" work well for professional female, "onyx" for male. Good budget option. However, no voice cloning and limited voice selection makes it less suitable for premium branded experiences.

---

### 6. Deepgram Aura-2

**Arena ranking:** NOT RANKED on Artificial Analysis arena

**Models available through Vapi:** Yes (native integration)

**Cost through Vapi:** ~$0.0108/min
**Cost direct:** $0.030/1K chars

**Voice library:** 40+ English voices with localized accents
**Languages:** 7 (English, Spanish, Dutch, French, German, Italian, Japanese)

**Latency:** Sub-200ms baseline, optimized to ~90ms

**Features:**

- Entity-aware text normalization (addresses, phone numbers, account numbers without SSML)
- Domain-specific tuning for support, sales, healthcare, finance
- On-premises deployment option
- Same provider as STT (reduced integration complexity)

**Quality assessment:** "In blind preference tests, Aura-2 consistently loses to Inworld and OpenAI TTS on naturalness." Optimized for enterprise reliability over expressiveness.

**Verdict:** Enterprise workhorse, not a quality leader. Great entity handling and reliability, but sounds less natural than ElevenLabs, Inworld, or even OpenAI. Best for use cases where consistent pronunciation matters more than emotional expressiveness (financial services, healthcare).

---

### 7. Hume AI Octave 2

**Arena ranking:** #29 (Octave 2, ELO 1,061)

**Available through Vapi:** Yes (native integration since March 2025)

**Cost:** $0.02/min | ~$7.60/1M chars
**Latency:** ~100ms inference, ~200ms TTFB with streaming

**Key differentiator:** First TTS built on LLM intelligence. Understands text emotionally and semantically. No SSML tags needed -- just natural language instructions like "speak warmly" or "sound concerned."

**Features:**

- Emotional direction via natural language prompts
- Character acting (interprets emotional cues)
- Voice cloning (10 sec minimum, 3-5 min recommended)
- Custom voice generation from text descriptions
- 11 languages (20+ in development)

**Verdict:** Interesting emotional intelligence approach but ELO 1061 puts it behind Cartesia (1074), OpenAI (1125), and far behind ElevenLabs (1108-1197) and Inworld (1240). The emotional understanding is a unique selling point but actual voice quality does not match the marketing. Not recommended as primary TTS for a receptionist where clear, professional sound matters more than emotional range.

---

### 8. LMNT

**Arena ranking:** #48 (ELO 985)

**Available through Vapi:** Yes (native integration)

**Latency:** 150-200ms TTFB
**Languages:** 24 with mid-sentence switching

**Voice cloning:** 5 second clean recording for studio-quality clones

**Verdict:** NOT RECOMMENDED. ELO 985 is below average -- significant quality gap vs top providers. Fast voice cloning is the only standout feature but quality cannot compete.

---

### 9. Azure Neural TTS

**Arena ranking:** #27 (Azure Neural, ELO 1,062)

**Available through Vapi:** Yes (native integration)

**Cost through Vapi:** ~$0.0108/min
**Cost direct:** ~$15/1M chars

**Multilingual:** Extensive language support (400+ voices, 140+ languages)

**Verdict:** Solid enterprise option with massive language coverage. ELO 1062 is mid-tier. Best for multilingual deployments where you need obscure language support. Not recommended over ElevenLabs or Inworld for English-primary receptionist.

---

### 10. Rime AI

**Arena ranking:** NOT RANKED

**Available through Vapi:** Yes (native integration)

**Latency:** Sub-100ms on-premises, sub-200ms cloud
**Voice library:** 200+ voices
**Languages:** English, Spanish (expanding)
**Compliance:** SOC 2 Type II

**Verdict:** Enterprise-focused with on-premises deployment. No public quality benchmarks. Worth evaluating only if you need on-prem TTS for compliance.

---

### 11. Smallest AI

**Arena ranking:** NOT RANKED

**Available through Vapi:** Yes (native integration)

**Latency:** Sub-100ms (Lightning model)
**Quality:** WVMOS 5.06

**Verdict:** Impressive latency claims but no public arena ranking and limited market presence. Too risky for production without independent quality verification.

---

### 12. Neuphonic

**Arena ranking:** #54 (ELO 959)

**Available through Vapi:** Yes (native integration)

**Cost:** ~$17.60/1M chars

**Verdict:** NOT RECOMMENDED. ELO 959 is well below average. Not competitive.

---

### 13. Vapi Native Voices

**Available voices (11 active, 8 legacy deprecated March 1, 2026):**

- Elliot (Male, Canadian, 20s) -- "realistic, friendly, professional, soothing"
- Savannah (Female, American Southern, 20s) -- "realistic, straightforward"
- Rohan (Male, Indian American, 20s) -- "realistic, bright, energetic"
- Emma (Female, Asian American, 20s) -- "realistic, warm, conversational"
- Clara (Female, American, 30s) -- "realistic, warm, professional"
- Nico (Male, American, 20s) -- "realistic, young, casual, natural"
- Kai (Male, American, 30s) -- "realistic, friendly, relaxed, approachable"
- Sagar (Male, Indian American, 20s) -- "realistic, steady, professional"
- Godfrey (Male, American, 20s) -- "realistic, young, energetic"
- Neil (Male, Indian American, 20s) -- "realistic, clear, professional"

**Cost:** ~$0.0216/min
**Underlying provider:** Not disclosed

**Verdict:** Convenient and cheap but quality is unknown (no arena ranking, no public benchmarks). Fine for testing/prototyping. For production, use a known-quantity provider.

---

## Cost Comparison Summary (through Vapi)

| Provider         | TTS Cost/min | Vapi Platform | Total TTS+Platform | Quality (ELO) |
| ---------------- | ------------ | ------------- | ------------------ | ------------- |
| OpenAI TTS-1     | $0.0108      | $0.05         | $0.0608            | 1,125         |
| Deepgram Aura-2  | $0.0108      | $0.05         | $0.0608            | Unranked      |
| Azure Neural     | $0.0108      | $0.05         | $0.0608            | 1,062         |
| Inworld 1.5 Max  | ~$0.01       | $0.05         | ~$0.06             | 1,240         |
| Vapi Native      | $0.0216      | $0.05         | $0.0716            | Unknown       |
| Hume Octave 2    | $0.02        | $0.05         | $0.07              | 1,061         |
| Cartesia Sonic 3 | $0.031       | $0.05         | $0.081             | 1,074         |
| ElevenLabs Flash | $0.036       | $0.05         | $0.086             | 1,108         |
| PlayHT           | $0.0648      | $0.05         | $0.1148            | Unranked      |

**Total call cost (STT + LLM + TTS + Vapi):** Typically $0.15-0.30/min depending on LLM choice.

---

## Quality/Cost Efficiency (ELO per dollar per minute)

| Provider              | ELO/$/min       |
| --------------------- | --------------- |
| Inworld 1.5 Max       | ~20,667         |
| OpenAI TTS-1          | ~18,503         |
| Azure Neural          | ~17,467         |
| ElevenLabs Flash v2.5 | ~12,884         |
| Cartesia Sonic 3      | ~13,259         |
| Hume Octave 2         | ~15,157         |
| PlayHT                | ~N/A (unranked) |

**Inworld delivers by far the best value: #1 quality at budget pricing.**

---

## Latency Comparison (TTFB)

| Provider    | Model             | TTFB       |
| ----------- | ----------------- | ---------- |
| Cartesia    | Sonic 3           | ~40ms      |
| ElevenLabs  | Flash v2.5        | ~75ms      |
| Smallest AI | Lightning         | ~100ms     |
| Hume AI     | Octave 2          | ~100ms     |
| Deepgram    | Aura-2            | ~90-200ms  |
| Inworld     | TTS 1.5 Mini      | <130ms     |
| LMNT        | --                | ~150-200ms |
| ElevenLabs  | v3 Conversational | ~300ms+    |
| OpenAI      | TTS-1             | ~200ms     |
| Inworld     | TTS 1.5 Max       | ~130-250ms |
| ElevenLabs  | Turbo v2.5        | ~250-300ms |

---

## Final Recommendations for Phone Receptionist AI

### Tier 1: Top Picks (in order)

**1. ElevenLabs Turbo v2.5** -- Best overall for premium receptionist

- Model ID: `eleven_turbo_v2_5`
- ELO: 1,119 | TTFB: ~250ms | Cost: ~$0.036/min
- Why: Excellent quality (ELO 1119), good latency for phone (250ms is acceptable), massive voice library with cloning, proven production track record
- Best for: English-primary receptionist where quality matters most
- Settings: stability 0.5, similarity_boost 0.75, style 0, speed 1.0

**2. Inworld TTS 1.5 Mini** -- Best quality/cost/speed balance

- ELO: 1,182 | TTFB: <130ms | Cost: ~$0.01/min
- Why: Higher ELO than any ElevenLabs real-time model, faster than Turbo v2.5, 3.6x cheaper
- Best for: High-volume deployments where cost matters
- Risk: Newer provider, less mature voice catalog, requires playground account to discover voices

**3. ElevenLabs Flash v2.5** -- Fastest ElevenLabs option

- Model ID: `eleven_flash_v2_5`
- ELO: 1,108 | TTFB: ~75ms | Cost: ~$0.036/min
- Why: Ultra-low latency, still good quality, same voice library as Turbo
- Best for: When response speed is critical (impatient callers, fast-paced interactions)

**4. Inworld TTS 1.5 Max** -- Absolute highest quality

- ELO: 1,240 | TTFB: ~130-250ms | Cost: ~$0.01/min
- Why: #1 ranked TTS model globally, 76% win rate in blind tests
- Best for: When you want the most human-like voice possible and can accept up to 250ms latency

### Tier 2: Solid Alternatives

**5. OpenAI TTS-1** -- Budget quality pick

- ELO: 1,125 | TTFB: ~200ms | Cost: ~$0.0108/min
- Limited to 6 voices, no cloning, but surprisingly high quality for the price

**6. Cartesia Sonic 3** -- Speed demon

- ELO: 1,074 | TTFB: ~40ms | Cost: ~$0.031/min
- Lowest latency available, but noticeable quality gap. Known pacing issues through Vapi.

### Tier 3: Specialized Use Cases

**7. Azure Neural** -- Multilingual enterprise
**8. Deepgram Aura-2** -- Entity precision (numbers, addresses)
**9. Hume Octave 2** -- Emotional intelligence niche

### Not Recommended

- PlayHT: Expensive, unranked quality
- LMNT: ELO 985, below average
- Neuphonic: ELO 959, not competitive
- Smallest AI: No public benchmarks
- Rime AI: Enterprise on-prem niche only

### Best Voice IDs for Receptionist

**ElevenLabs (female, professional):**

- `EXAVITQu4vr4xnSDxMaL` -- Sarah (warm, professional) -- check if still active post-deprecation
- Check /voices API endpoint for current catalog -- 31 voices were deprecated Feb 28, 2026

**ElevenLabs (male, professional):**

- Check voice library for current options (Brian, Daniel, Liam were popular)

**Cartesia (if staying with it):**

- `694f9389-aac1-45b6-b726-9d9369183238` -- Sarah (female, our current default)

**OpenAI:**

- `nova` -- female, professional, clear
- `alloy` -- female, warm
- `onyx` -- male, deep, authoritative

**Inworld:**

- Must create free account at Inworld TTS Playground to browse and copy voice names

---

## Key Insight: The Market Has Shifted

Our current setup (Cartesia Sonic-3 on self-hosted LiveKit) is ranked #22 on the arena. Switching to Vapi with ElevenLabs or Inworld would be a significant quality upgrade:

- Cartesia Sonic 3: ELO 1,074
- ElevenLabs Flash v2.5: ELO 1,108 (+34 points, +3.2%)
- ElevenLabs Turbo v2.5: ELO 1,119 (+45 points, +4.2%)
- Inworld TTS 1.5 Mini: ELO 1,182 (+108 points, +10.1%)
- Inworld TTS 1.5 Max: ELO 1,240 (+166 points, +15.5%)

The jump from Cartesia to Inworld 1.5 Max represents a 15.5% quality improvement at 70-80% lower cost per minute.

---

_Research completed: 2026-03-22_
_Sources: Artificial Analysis Speech Arena, Inworld TTS Benchmarks 2026, Vapi docs, ElevenLabs docs, community forums_
