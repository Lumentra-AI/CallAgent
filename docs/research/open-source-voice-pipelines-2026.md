# Open-Source Voice AI Pipeline Frameworks - Deep Research Report

**Date:** 2026-02-27
**Context:** Evaluating alternatives to Lumentra's custom voice pipeline (SignalWire + Deepgram STT -> LLM -> Cartesia TTS)
**Searches conducted:** 60+ across 5 parallel research agents
**Sources cross-referenced:** 100+

---

## Executive Summary

Your custom pipeline (Node.js, WebSocket, Deepgram + LLM + Cartesia over SignalWire) is architecturally sound but you're reinventing significant infrastructure. Two frameworks stand out as clear leaders that are production-proven, actively maintained, and would solve your latency/turn-taking issues:

|                | **Pipecat**                                  | **LiveKit Agents**                                            |
| -------------- | -------------------------------------------- | ------------------------------------------------------------- |
| Stars          | 10,500+                                      | 9,500+                                                        |
| Language       | Python                                       | Python (primary), Node.js                                     |
| Transport      | WebRTC (Daily.co)                            | WebRTC (native LiveKit)                                       |
| License        | BSD-2-Clause                                 | Apache-2.0                                                    |
| Backed by      | Daily.co                                     | LiveKit ($1B valuation, $183M raised)                         |
| Used by        | HealthifyMe, Choco, Traba                    | OpenAI (ChatGPT voice), Tesla, Salesforce                     |
| E2E latency    | 500-800ms                                    | 500-800ms                                                     |
| Turn detection | SmartTurn ML model (65ms, 23 langs)          | Custom 135M param transformer (85% fewer false interruptions) |
| Telephony      | Daily SIP, Twilio, Telnyx, SignalWire, Plivo | Native LiveKit SIP, any SIP trunk                             |
| STT providers  | 19+                                          | 23+                                                           |
| TTS providers  | 25+                                          | 27+                                                           |
| LLM providers  | 18+                                          | 7+ (any OpenAI-compatible)                                    |

**Bottom line:** If you want maximum flexibility and vendor neutrality, use **Pipecat**. If you want a full-stack self-hostable solution with the best turn detection, use **LiveKit Agents**. Both are dramatically better than maintaining a custom pipeline.

---

## The Big Three Frameworks

### 1. Pipecat (by Daily.co) -- 10,500+ stars

**GitHub:** https://github.com/pipecat-ai/pipecat
**License:** BSD-2-Clause | **Last commit:** Daily | **Contributors:** 240+

**Architecture:** Sequential frame-based pipeline. Everything is a "frame" (audio chunks, text tokens, control signals) flowing through "frame processors." Bidirectional -- interruption signals propagate upstream instantly via SystemFrame priority queue.

```
Transport Input -> VAD (Silero) -> STT -> Context Aggregator -> LLM -> TTS -> Transport Output
```

**Why it's good:**

- Widest provider ecosystem (40+ AI services, swap with one-line changes)
- SmartTurn V3: ML model analyzing last 8 seconds of audio waveform to determine if speaker finished. 65ms inference, 23 languages, runs locally via ONNX
- Sentence-boundary text aggregation prevents choppy TTS
- Vendor-neutral: Daily.co is optional (SmallWebRTCTransport for serverless P2P)
- Client SDKs: JS, React, React Native, Swift, Kotlin, C++, ESP32
- Pipecat Cloud for managed deployment with auto-scaling

**Telephony support:**

- Daily SIP Interconnect (static SIP URIs)
- Daily PSTN Direct (purchase numbers through Daily)
- Twilio + Daily SIP bridge
- Twilio Media Streams (WebSocket, bypasses Daily entirely)
- Plivo, Telnyx, SignalWire, Exotel via SIP

**Basic voice agent example:**

```python
async def bot():
    transport = DailyTransport(room_url=..., token=..., bot_name="Bot")
    stt = DeepgramSTTService(api_key=...)
    tts = CartesiaTTSService(api_key=..., voice_id="...")
    llm = OpenAILLMService(api_key=...)
    context = OpenAILLMContext(messages=[{"role": "system", "content": "..."}])
    context_aggregator = llm.create_context_aggregator(context)

    pipeline = Pipeline([
        transport.input(),
        stt,
        context_aggregator.user(),
        llm,
        tts,
        transport.output(),
        context_aggregator.assistant(),
    ])
    task = PipelineTask(pipeline)
    await PipelineRunner().run(task)
```

**Limitations:**

- Python-only (no Node.js SDK)
- 0.0.x versioning = breaking changes between releases
- More verbose setup than LiveKit
- Self-hosted deployment is complex
- No built-in LLM fallback processor
- Turn detection waits for end-of-speech (no preemptive generation)

**Key resources:**

- Docs: https://docs.pipecat.ai
- Phone bot quickstart: https://github.com/pipecat-ai/pipecat-quickstart-phone-bot
- SmartTurn model: https://huggingface.co/pipecat-ai/smart-turn-v3
- Discord: ~6,400 members

---

### 2. LiveKit Agents -- 9,500+ stars

**GitHub:** https://github.com/livekit/agents
**License:** Apache-2.0 | **Last commit:** Daily | **Contributors:** 265+

**Architecture:** Agent joins a WebRTC room as a first-class participant (same as a human). Audio streams through STT -> LLM -> TTS pipeline. Worker-Job model for horizontal scaling.

```
User Speech -> VAD (Silero) -> STT -> Turn Detection (EOU Model) -> LLM -> TTS -> Audio Playback
```

**Why it's good:**

- Powers OpenAI ChatGPT voice mode in production
- Best turn detection: custom 135M parameter transformer (open weights), 85% fewer false interruptions, 3% false negative rate, ~50ms inference on CPU
- 5 turn detection modes: ML model, realtime models, VAD-only, STT endpointing, manual
- False interruption handling with automatic resumption from exact word
- Full-stack self-hostable (LiveKit server is open-source Go, no cloud required)
- Both Python and Node.js SDKs
- Native SIP/PSTN telephony (no intermediary needed)
- 50+ provider plugins

**Telephony support:**

- Native LiveKit SIP (inbound + outbound)
- Any SIP trunk provider (Twilio, Telnyx, etc.)
- LiveKit Phone Numbers (provision directly through LiveKit Cloud)
- DTMF support, SIP REFER (call transfers)
- Same agent code works for WebRTC and telephony

**Basic voice agent example:**

```python
class Assistant(Agent):
    def __init__(self):
        super().__init__(instructions="You are a helpful voice AI assistant.")

server = AgentServer()

@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: agents.JobContext):
    session = AgentSession(
        stt="deepgram/nova-3:multi",
        llm="openai/gpt-4.1-mini",
        tts="cartesia/sonic-3:voice-id-here",
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )
    await session.start(room=ctx.room, agent=Assistant())
    await session.generate_reply(instructions="Greet the user.")
```

**Limitations:**

- Telephony latency can double due to SIP-to-WebRTC bridge hop (GitHub issue #3685)
- Python SDK is much more mature than Node.js (13x more stars, 7x more contributors)
- API churn: v0.x to v1.0 migration was significant (renamed classes, removed features)
- Coupled to LiveKit ecosystem (need LiveKit server running)
- Cold start latency on cloud free tier (10-20s)
- EOU model is text-based only, doesn't work with speech-to-speech APIs

**Key resources:**

- Docs: https://docs.livekit.io/agents/
- Quickstart: https://docs.livekit.io/agents/start/voice-ai-quickstart/
- EOU model blog: https://blog.livekit.io/using-a-transformer-to-improve-end-of-turn-detection/
- Telephony guide: https://docs.livekit.io/agents/start/telephony/

---

### 3. TEN Framework (by Agora) -- 10,100+ stars

**GitHub:** https://github.com/TEN-framework/ten-framework
**License:** Apache-2.0 | **Last commit:** Daily | **Backed by:** Agora

**Architecture:** Graph-based extension system with C++ performance core. Extensions communicate via JSON protocol. Multi-language support (Go, C++, Python, TypeScript).

**Why it matters:** C++ core delivers lower latency than pure Python frameworks. Custom TEN-VAD model. Compatible with Dify and Coze workflow platforms.

**Limitations:** Smaller ecosystem, tied to Agora for RTC, fewer integrations than Pipecat/LiveKit.

**Verdict:** Strong third option. Consider if you need C++ performance or already use Agora.

---

## Other Notable Frameworks

### Bolna -- 587 stars

**GitHub:** https://github.com/bolna-ai/bolna | **License:** MIT | **Language:** Python

Phone-call-first design. Native Twilio + Plivo integration. LiteLLM gives widest LLM compatibility (14+ providers). Docker-compose ready. Good for simpler phone agents.

### Jambonz -- ~89 stars (distributed repos)

**GitHub:** https://github.com/jambonz | **License:** MIT | **Language:** JavaScript/Node.js

Purpose-built for telephony. Connects ANY SIP trunk to ANY AI layer. 18+ speech vendors. Multi-tenant, enterprise-grade. Best choice if you want to own your telephony stack and pair with any AI framework.

### Rapida -- 659 stars

**GitHub:** https://github.com/rapidaai/voice-ai | **License:** GPL-2.0 | **Language:** Go

Only serious Go-based voice AI orchestrator. gRPC for bidirectional streaming. Observability-first (call logs, traces, latency dashboards). Asterisk PBX compatibility.

### Fonoster -- 7,700 stars

**GitHub:** https://github.com/fonoster/fonoster | **License:** MIT | **Language:** TypeScript

"Open-source Twilio." Programmable telecom stack with OAuth2, RBAC, multitenancy. More telecom platform than voice AI framework.

### Vocode -- 3,700 stars (STALE)

**GitHub:** https://github.com/vocodedev/vocode-core | **License:** MIT

Was a pioneer but **last commit November 2024**. Actively seeking maintainers. Avoid for new projects.

---

## Speech-to-Speech Models (Pipeline Killers)

These eliminate the STT -> LLM -> TTS pipeline entirely:

### NVIDIA PersonaPlex-7B -- 5,600 stars

- Full-duplex speech-to-speech with persona control
- **0.07 second speaker switching** (vs Gemini Live's 1.3s)
- Open weights, MIT license
- Community Twilio integration exists
- Most promising S2S model for voice agents

### Moshi (Kyutai) -- 9,700 stars

- Full-duplex: listens and speaks simultaneously
- 160ms theoretical latency (200ms practical)
- Rust production backend
- Not yet plug-and-play for phone calls

### Ultravox (Fixie AI) -- 4,400 stars

- Audio goes directly into LLM embedding space (no STT)
- Based on Llama 3.3, Gemma 3, Qwen 3
- 42+ languages, open weights
- Works as drop-in LLM provider in Pipecat and LiveKit

**Trend:** These models will likely make STT+LLM+TTS pipelines obsolete within 1-2 years.

---

## Why Your Custom Pipeline Has Latency Issues

### The 3 Biggest Gaps vs. Frameworks

1. **WebSocket (TCP) vs WebRTC (UDP)**

   - Your pipeline uses WebSocket over TCP. TCP's head-of-line blocking means one lost packet delays ALL subsequent packets
   - WebRTC uses UDP -- drops lost packets (a 20ms audio gap is imperceptible; a 200ms delay is not)
   - WebRTC adds built-in jitter buffering, echo cancellation, noise suppression, adaptive bitrate
   - **Impact: 100-300ms latency advantage for WebRTC**

2. **Turn Detection**

   - Your pipeline uses silence thresholds + transcript heuristics
   - Pipecat's SmartTurn: ML model analyzing 8s audio waveform, 65ms inference, 23 languages
   - LiveKit's EOU: 135M parameter transformer, 85% fewer false interruptions
   - Simple silence thresholds cause either premature responses (user still talking) or sluggish ones (waiting too long)

3. **Interruption Handling**
   - Your pipeline manually manages queue flushing
   - Pipecat: SystemFrame priority queue bypasses all buffered data instantly
   - LiveKit: False interruption detection + automatic resumption from exact word
   - Without proper handling, background noise or backchannels ("uh-huh") trigger false interruptions = audio chop

### Component-Level Latency Breakdown (Industry Data, 4M+ Calls)

| Component         | Typical        | Optimized     | % of Total |
| ----------------- | -------------- | ------------- | ---------- |
| STT               | 200-400ms      | 100-200ms     | 15-20%     |
| **LLM**           | **300-1000ms** | **200-400ms** | **~70%**   |
| TTS (TTFB)        | 150-500ms      | 100-250ms     | 10-15%     |
| Network/Transport | 100-300ms      | 50-150ms      | 5-10%      |
| Turn Detection    | 200-800ms      | 200-400ms     | variable   |

**LLM is the dominant bottleneck at ~70% of total latency.** Using GPT-4.1 mini, Gemini 2.5 Flash, or Claude Haiku (~360-400ms TTFT) is critical.

### Production Latency Benchmarks (Hamming AI, 4M+ calls)

| Percentile | Response Time | User Experience           |
| ---------- | ------------- | ------------------------- |
| P50        | 1.4-1.7s      | Noticeable but functional |
| P90        | 3.3-3.8s      | Significant frustration   |
| P99        | 8.4-15.3s     | Complete breakdown        |

Human conversation gaps average ~200ms. Under 300ms feels instantaneous. Above 1500ms triggers stress.

---

## Audio Chop Prevention: How Frameworks Solve It

### Root Causes

1. False VAD triggers (background noise, bot echo, breathing)
2. Premature endpointing (turn detection fires before user finishes)
3. Queue starvation (TTS buffer empties, LLM tokens arrive too slowly)
4. Network jitter (audio packets arrive out of order)

### Framework Solutions

| Technique                     | Pipecat                         | LiveKit                       | Your Pipeline         |
| ----------------------------- | ------------------------------- | ----------------------------- | --------------------- |
| ML turn detection             | SmartTurn V3                    | EOU transformer               | Silence threshold     |
| False interruption resumption | No                              | Yes (resumes from exact word) | No                    |
| Priority queue for interrupts | SystemFrame bypasses all queues | Built-in                      | Manual flush          |
| Echo cancellation             | WebRTC built-in                 | WebRTC built-in               | Not included          |
| Sentence buffering            | Built-in LLMTextProcessor       | Built-in preemptive synthesis | Custom implementation |
| Min interruption duration     | Configurable                    | 0.5s default                  | Custom                |
| Backchannel filtering         | SmartTurn classification        | min_interruption_words        | Custom                |

### Best Practices (Framework-Agnostic)

1. Use WebRTC (includes AEC, jitter buffering)
2. Layer ML turn detection on top of VAD
3. Set `min_interruption_duration` to 300-500ms
4. Implement sentence-boundary buffering for LLM -> TTS
5. Barge-in should stop playback within 200ms
6. Start TTS synthesis on first LLM sentence, not full response

---

## Comparison: Your Stack vs. Frameworks

| Aspect             | Your Custom Pipeline           | Pipecat                      | LiveKit Agents                |
| ------------------ | ------------------------------ | ---------------------------- | ----------------------------- |
| Transport          | SignalWire WebSocket (TCP)     | WebRTC (UDP)                 | WebRTC (UDP)                  |
| STT                | Deepgram                       | 19+ providers                | 23+ providers                 |
| TTS                | Cartesia                       | 25+ providers                | 27+ providers                 |
| LLM                | OpenAI/Groq/Gemini             | 18+ providers                | 7+ (OpenAI-compat)            |
| Turn detection     | Silence threshold + heuristics | SmartTurn ML (65ms)          | EOU transformer (50ms)        |
| Barge-in           | Manual queue management        | SystemFrame priority         | False interruption resumption |
| Echo cancellation  | Not included                   | WebRTC built-in              | WebRTC built-in               |
| Provider switching | Rewrite integration            | Change one import            | Change one string             |
| Scaling            | Manual                         | Pipecat Cloud or K8s         | Worker-Job architecture       |
| Multi-tenant       | Custom implementation          | Per-process isolation        | Per-job isolation             |
| Maintenance        | You maintain everything        | Community maintains adapters | Community maintains plugins   |
| Language           | Node.js/TypeScript             | Python only                  | Python (primary), Node.js     |
| Time to build      | Weeks-months                   | Hours-days                   | Hours-days                    |

---

## Recommendations

### If Starting Fresh

Use **LiveKit Agents** (Python SDK). Reasons:

- Self-hostable end-to-end (server + agents + telephony)
- Best turn detection in the industry (85% fewer false interruptions)
- Powers OpenAI ChatGPT voice -- proven at billions of calls/year
- Native SIP means your SignalWire numbers work via SIP trunking
- Apache-2.0 license, no vendor lock-in
- $1B company with $183M raised -- not going anywhere

### If You Need Node.js

Use **LiveKit Agents JS SDK** (less mature than Python but at 1.0) or **Jambonz** (pure Node.js, telephony-focused).

### If You Want Maximum Flexibility

Use **Pipecat**. More provider integrations, vendor-neutral, BSD-2 license. Trade-off: Python-only, more setup work, deployment is harder.

### If You Want to Future-Proof

Keep an eye on **speech-to-speech models** (PersonaPlex, Ultravox, Moshi). Within 1-2 years, the STT+LLM+TTS pipeline will likely collapse into a single model call. Both Pipecat and LiveKit already support Ultravox and OpenAI Realtime API as drop-in providers.

### Quick Win for Your Current Pipeline

Even without switching frameworks, you can improve latency by:

1. Adding Silero VAD locally (sub-1ms, replaces silence thresholds)
2. Implementing sentence-boundary buffering for LLM -> TTS
3. Using GPT-4.1 mini or Gemini 2.5 Flash (~400ms TTFT vs slower models)
4. Adding a min interruption duration of 300-500ms to prevent false triggers

---

## Sources

### Framework Repositories

- [Pipecat](https://github.com/pipecat-ai/pipecat) | [Docs](https://docs.pipecat.ai)
- [LiveKit Agents](https://github.com/livekit/agents) | [Docs](https://docs.livekit.io/agents/)
- [LiveKit Agents JS](https://github.com/livekit/agents-js)
- [TEN Framework](https://github.com/TEN-framework/ten-framework)
- [Bolna](https://github.com/bolna-ai/bolna)
- [Jambonz](https://github.com/jambonz)
- [Rapida](https://github.com/rapidaai/voice-ai)
- [Vocode](https://github.com/vocodedev/vocode-core) (stale)
- [Fonoster](https://github.com/fonoster/fonoster)
- [Ultravox](https://github.com/fixie-ai/ultravox)
- [Moshi](https://github.com/kyutai-labs/moshi)
- [PersonaPlex](https://github.com/NVIDIA/personaplex)

### Technical Deep-Dives

- [LiveKit: Transformer End-of-Turn Detection](https://blog.livekit.io/using-a-transformer-to-improve-end-of-turn-detection/)
- [LiveKit: Improved EOU Cuts Interruptions 39%](https://blog.livekit.io/improved-end-of-turn-model-cuts-voice-ai-interruptions-39/)
- [Pipecat: SmartTurn V3](https://huggingface.co/pipecat-ai/smart-turn-v3)
- [Pipecat: Pipeline Architecture](https://docs.pipecat.ai/guides/learn/pipeline)
- [Modal: One-Second Latency with Pipecat](https://modal.com/blog/low-latency-voice-bot)
- [Cerebrium: 500ms Latency with LiveKit](https://www.cerebrium.ai/blog/deploying-a-global-scale-ai-voice-agent-with-500ms-latency)
- [SimpliSmart: Sub-400ms Architecture](https://simplismart.ai/blog/real-time-voice-ai-sub-400ms-latency)

### Benchmarks and Analysis

- [Hamming AI: Voice AI Latency Benchmarks](https://hamming.ai/blog/voice-ai-latency-whats-fast-whats-slow-how-to-fix-it)
- [Hamming AI: Best Voice Agent Stack](https://hamming.ai/resources/best-voice-agent-stack)
- [Hamming AI: Testing LiveKit Voice Agents (4M+ calls)](https://hamming.ai/resources/testing-and-monitoring-livekit-voice-agents-production)
- [AssemblyAI: 6 Best Orchestration Tools](https://www.assemblyai.com/blog/orchestration-tools-ai-voice-agents)
- [F22 Labs: LiveKit vs Pipecat](https://www.f22labs.com/blogs/difference-between-livekit-vs-pipecat-voice-ai-platforms/)

### Production Case Studies

- [Daily/Freeplay: Production Voice AI Lessons](https://freeplay.ai/blog/building-production-voice-ai-that-actually-works-lessons-from-daily-pipecat-co-founder-kwindla-hultman-kramer)
- [Coval: State of Voice AI 2026](https://www.coval.dev/blog/the-state-of-voice-ai-instruction-following-in-2026-a-conversation-with-kwindla-from-pipecat-and-zach-from-ultravox)
- [LiveKit Series C: $1B Valuation](https://blog.livekit.io/livekit-series-c/)
- [TechCrunch: LiveKit $100M Raise](https://techcrunch.com/2026/01/22/voice-ai-engine-and-openai-partner-livekit-hits-1b-valuation/)
