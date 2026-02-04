# Research Report: Best LLM for Real-Time Voice AI Agents (2026)

**Generated:** 2026-02-04
**Methodology:** Rule of 5 Deep Research
**Searches Performed:** 28
**Sources Cited:** 50+

---

## Executive Summary

For **cheap, low-latency, cloud-based voice AI agents for businesses**, the top recommendations are:

| Rank  | Solution                  | Best For                   | Cost                       | Latency (TTFT) |
| ----- | ------------------------- | -------------------------- | -------------------------- | -------------- |
| **1** | **Gemini 2.5 Flash-Lite** | Best overall value         | $0.10/$0.40 per 1M tokens  | ~370ms         |
| **2** | **Groq + Llama 4 Scout**  | Maximum speed              | $0.11/$0.34 per 1M tokens  | <100ms         |
| **3** | **GPT-4o-mini**           | Best ecosystem/reliability | $0.15/$0.60 per 1M tokens  | ~420ms         |
| **4** | **AWS Nova 2 Lite**       | AWS integration            | ~$0.02/$0.07 per 1M tokens | Optimized tier |

**Winner: Gemini 2.5 Flash-Lite** - Best price-to-performance ratio with native audio capabilities coming in 2.5 series.

---

## Research Questions

### Main Question

What is the best LLM for real-time voice AI agents for businesses that is cheap, has low latency, and is cloud-based?

### Sub-Questions Investigated

1. What are the latency benchmarks for each major LLM provider? - **Answered**
2. What is the pricing structure per 1M tokens? - **Answered**
3. Which LLMs have the best function calling for voice agents? - **Answered**
4. What do production voice AI platforms actually use? - **Answered**
5. What specialized voice-native LLM solutions exist? - **Answered**
6. What latency optimizations exist (streaming, caching, edge)? - **Answered**
7. What are the tradeoffs between quality vs speed vs cost? - **Answered**

---

## Key Findings

### Finding 1: Latency Requirements for Voice AI

**Confidence:** High

Natural human conversation has ~200ms gaps between speakers. Production voice AI must target:

- **Under 300ms:** Feels magical, indistinguishable from human
- **Under 800ms:** Acceptable for production
- **Under 1,500ms:** Maximum tolerable for voice-to-voice

Current production reality: **1,400-1,700ms median** for most platforms, explaining why users report agents that "feel slow."

**Evidence:**

- [Telnyx Benchmark](https://telnyx.com/resources/voice-ai-agents-compared-latency): "Research reveals average gap in natural dialogue is approximately 200ms"
- [Hamming AI](https://hamming.ai/resources/voice-ai-latency-whats-fast-whats-slow-how-to-fix-it): "Production voice AI delivers 1,400-1,700ms at median"
- [Daily.co Benchmarks](https://www.daily.co/blog/benchmarking-llms-for-voice-agent-use-cases/): "~700ms TTFT target for text-mode LLMs in voice harness"

---

### Finding 2: LLM Pricing Comparison (Per 1M Tokens)

**Confidence:** High

| Provider/Model         | Input   | Output | Context | Notes              |
| ---------------------- | ------- | ------ | ------- | ------------------ |
| **Budget Tier**        |
| Groq Llama 3.1 8B      | $0.05   | $0.08  | 128K    | Fastest inference  |
| Groq Llama 4 Scout     | $0.11   | $0.34  | 1M      | 460+ tok/s         |
| Gemini 2.5 Flash-Lite  | $0.10   | $0.40  | 1M      | Best value         |
| AWS Nova Micro (batch) | $0.0175 | $0.07  | -       | 50% batch discount |
| Mistral Nemo           | $0.02   | -      | 262K    | Cheapest Mistral   |
| **Mid Tier**           |
| GPT-4o-mini            | $0.15   | $0.60  | 128K    | Best ecosystem     |
| Gemini 2.5 Flash       | $0.30   | $2.50  | 1M      | Full features      |
| Cohere Command R       | $0.15   | $0.60  | 128K    | RAG optimized      |
| Groq Llama 3.3 70B     | $0.59   | $0.79  | 128K    | Quality + speed    |
| **Premium Tier**       |
| Claude Haiku 4.5       | $1.00   | $5.00  | 200K    | Best tool use      |
| GPT-4o                 | $2.50   | $10.00 | 128K    | Full multimodal    |
| Claude Sonnet 4.5      | $3.00   | $15.00 | 200K    | Complex reasoning  |

**Evidence:**

- [OpenAI Pricing](https://openai.com/api/pricing/)
- [Google Gemini Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Groq Pricing](https://groq.com/pricing)

---

### Finding 3: Latency Benchmarks by Provider

**Confidence:** High

| Provider     | Model          | TTFT      | Tokens/sec | Notes                  |
| ------------ | -------------- | --------- | ---------- | ---------------------- |
| **Cerebras** | Llama 3.1 8B   | ~50ms     | 1,800+     | Fastest overall        |
| **Groq**     | Llama 3.1 8B   | <100ms    | 300+       | Best production option |
| **Groq**     | Llama 4 Scout  | ~100ms    | 460+       | Excellent value        |
| **Cerebras** | Llama 3.1 70B  | ~150ms    | 450+       | Fast large model       |
| **Gemini**   | 2.5 Flash-Lite | ~370ms    | High       | Best cost/latency      |
| **Mistral**  | Medium 3       | 380ms     | 73         | Good balance           |
| **Claude**   | Haiku 4.5      | ~400ms    | Medium     | Best tool calling      |
| **OpenAI**   | GPT-4o-mini    | ~420ms    | Medium     | Most reliable          |
| **Mistral**  | Large 2411     | 510ms     | 45         | Premium quality        |
| **OpenAI**   | GPT-4o         | 500-800ms | Medium     | Full capabilities      |
| **Claude**   | Sonnet 4.5     | 600-800ms | Medium     | Complex reasoning      |

**Evidence:**

- [Artificial Analysis Leaderboard](https://artificialanalysis.ai/leaderboards/models)
- [Cerebras Benchmarks](https://www.cerebras.ai/blog/2026Insights): "2,500+ tokens/sec on Llama 4 Maverick"
- [Groq Benchmarks](https://groq.com/blog/artificialanalysis-ai-llm-benchmark-doubles-axis-to-fit-new-groq-lpu-inference-engine-performance-results)

---

### Finding 4: Function Calling / Tool Use Capabilities

**Confidence:** High

For voice agents, reliable function calling is critical for booking appointments, transferring calls, looking up information, etc.

| Model                | Function Calling   | Quality   | Notes                       |
| -------------------- | ------------------ | --------- | --------------------------- |
| **GPT-4o-mini**      | Native, excellent  | Best      | Full structured outputs     |
| **Claude Haiku 4.5** | Native, excellent  | Excellent | Best multi-step tool use    |
| **Gemini Flash**     | Supported          | Good      | Google Search grounding     |
| **Llama 4 models**   | Via prompting      | Good      | JSON output reliable        |
| **Groq models**      | Via JSON prompting | Good      | Requires prompt engineering |
| **Mistral**          | Supported          | Good      | Function calling API        |

**Evidence:**

- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html)
- [Docker LLM Tool Calling Evaluation](https://www.docker.com/blog/local-llm-tool-calling-a-practical-evaluation/): "GPT-4 achieved tool selection F1 score of 0.974"

---

### Finding 5: Specialized Voice AI Solutions

**Confidence:** High

#### Speech-to-Speech Models (Skip STT/TTS Pipeline)

| Solution                           | Latency      | Pricing                     | Notes                                      |
| ---------------------------------- | ------------ | --------------------------- | ------------------------------------------ |
| **OpenAI Realtime (gpt-realtime)** | Near-instant | $32/$64 per 1M audio tokens | Premium quality, expensive                 |
| **Gemini Live API**                | 320ms p50    | ~Video token rates          | Native audio, 2-3x faster than traditional |
| **AWS Nova 2 Sonic**               | Low          | $0.0034/1K speech tokens    | 7 languages, 1M context                    |
| **Ultravox**                       | 150ms TTFT   | Self-hosted or Cerebrium    | Open-source speech LLM                     |

#### STT Providers

| Provider            | Cost                  | Latency  | WER              |
| ------------------- | --------------------- | -------- | ---------------- |
| **Deepgram Nova-3** | $0.0077/min streaming | <300ms   | 18% (real-world) |
| **AssemblyAI**      | $0.01/min             | ~300ms   | Competitive      |
| **NVIDIA Canary**   | Self-hosted           | Sub-25ms | 5.63% (best)     |

#### TTS Providers

| Provider                  | Cost            | Latency   | Notes           |
| ------------------------- | --------------- | --------- | --------------- |
| **Cartesia Sonic**        | ~$0.04/min      | 90ms TTFB | Best latency    |
| **ElevenLabs Flash v2.5** | $0.10+/min      | 75ms      | Best quality    |
| **PlayHT**                | ~$0.03-0.05/min | Low       | Good value      |
| **Deepgram Aura**         | Included        | Fast      | Bundle with STT |

**Evidence:**

- [OpenAI Realtime API](https://openai.com/index/introducing-gpt-realtime/)
- [Deepgram Pricing](https://deepgram.com/pricing)
- [ElevenLabs Conversational AI](https://elevenlabs.io/blog/we-cut-our-pricing-for-conversational-ai)
- [Cartesia Sonic](https://cartesia.ai/sonic)

---

### Finding 6: Voice AI Platform Costs (End-to-End)

**Confidence:** High

| Platform      | Cost/Minute | Latency    | Best For              |
| ------------- | ----------- | ---------- | --------------------- |
| **Retell AI** | $0.07+      | ~800ms     | Regulated industries  |
| **Vapi**      | $0.13-0.31+ | ~500ms     | Developer flexibility |
| **Bland AI**  | $0.09       | ~700ms     | Simple use cases      |
| **Telnyx**    | Varies      | <200ms RTT | Lowest latency        |
| **Synthflow** | $0.08-0.15  | 300-500ms  | Balanced              |

**Real-World Cost Breakdown (per minute):**

- Platform/Hosting: $0.05
- STT (Deepgram): $0.0077
- LLM (varies): $0.02-0.20
- TTS (ElevenLabs): $0.04-0.10
- Telephony: $0.01
- **Total: $0.08-0.35/min typical**

**Evidence:**

- [Retell AI Pricing](https://www.retellai.com/resources/voice-ai-platform-pricing-comparison-2025)
- [CloudTalk Voice AI Costs](https://www.cloudtalk.io/blog/how-much-does-voice-ai-cost/)
- [Vapi Review](https://www.retellai.com/blog/vapi-ai-review)

---

### Finding 7: Production Architecture Recommendations

**Confidence:** High

#### Recommended Stack for Budget + Low Latency

```
STT: Deepgram Nova-3 ($0.0077/min, <300ms)
 |
LLM: Gemini 2.5 Flash-Lite ($0.10/$0.40, ~370ms TTFT)
     OR Groq + Llama 4 Scout ($0.11/$0.34, <100ms TTFT)
 |
TTS: Cartesia Sonic (~$0.04/min, 90ms TTFB)
     OR Deepgram Aura (bundled)

Total: ~$0.06-0.10/minute
End-to-end: 500-800ms achievable
```

#### Tiered Approach (Production)

```
Primary (80-90% of calls):
  - Gemini 2.5 Flash-Lite OR Groq Llama 4 Scout
  - Simple intents, FAQ, routing

Escalation (10-20% of calls):
  - GPT-4o-mini OR Claude Haiku 4.5
  - Complex function calling, multi-step workflows

Premium (optional):
  - OpenAI Realtime API OR Gemini Live API
  - High-value conversations requiring maximum quality
```

**Evidence:**

- [AssemblyAI Voice AI Stack 2026](https://www.assemblyai.com/blog/the-voice-ai-stack-for-building-agents)
- [Softcery LLM Comparison](https://softcery.com/lab/ai-voice-agents-choosing-the-right-llm)

---

## Comprehensive Comparison Matrix

| Criteria             | Gemini 2.5 Flash-Lite | Groq Llama 4 Scout | GPT-4o-mini | Claude Haiku 4.5 |
| -------------------- | --------------------- | ------------------ | ----------- | ---------------- |
| **Input Cost**       | $0.10/1M              | $0.11/1M           | $0.15/1M    | $1.00/1M         |
| **Output Cost**      | $0.40/1M              | $0.34/1M           | $0.60/1M    | $5.00/1M         |
| **TTFT**             | ~370ms                | <100ms             | ~420ms      | ~400ms           |
| **Context**          | 1M tokens             | 1M tokens          | 128K tokens | 200K tokens      |
| **Function Calling** | Good                  | JSON prompting     | Excellent   | Excellent        |
| **Streaming**        | Yes                   | Yes                | Yes         | Yes              |
| **Free Tier**        | 1,500 req/day         | Limited            | No          | No               |
| **Batch Discount**   | 50%                   | No                 | 50%         | 50%              |
| **Best For**         | Cost-sensitive        | Speed-critical     | Reliability | Complex tools    |

---

## Recommendations

### Primary Recommendation: Gemini 2.5 Flash-Lite

**Rationale:**

1. **Cheapest viable option** at $0.10/$0.40 per 1M tokens
2. **Sub-400ms TTFT** meets voice requirements
3. **1M token context** handles long conversations
4. **Free tier** for development (1,500 requests/day)
5. **Native audio capabilities** coming in Gemini 2.5 series
6. **Google Search grounding** for knowledge queries

**When to use:** Default choice for most business voice AI applications

### Alternative: Groq + Llama 4 Scout

**Rationale:**

1. **Fastest inference** at <100ms TTFT, 460+ tokens/sec
2. **Competitive pricing** at $0.11/$0.34 per 1M tokens
3. **1M token context**
4. **Open-source model** flexibility

**When to use:** When sub-100ms latency is critical, high-volume applications

### Enterprise Option: GPT-4o-mini

**Rationale:**

1. **Most mature ecosystem** and tooling
2. **Best native function calling** reliability
3. **Proven production track record**
4. **Azure integration** for enterprise compliance

**When to use:** Enterprise deployments prioritizing reliability over cost

---

## Warnings

1. **Gemini 2.0 Flash-Lite deprecated March 31, 2026** - Migrate to 2.5 series
2. **Groq requires JSON prompting** for function calling - less reliable than native
3. **Claude prioritizes safety** - can add 2-4 seconds in some edge cases
4. **OpenAI Realtime API is expensive** - ~$0.20/minute, budget carefully
5. **Hidden platform costs** - Budget 50-100% above base pricing for real deployments
6. **Latency varies by region** - Test in your deployment region

---

## Open Questions

- How will Gemini 2.5 native audio pricing compare to OpenAI Realtime?
- Will Groq add native function calling support?
- What will Llama 4 Behemoth (2T parameters) offer for voice AI?

---

## All Sources

### Official Documentation

1. [OpenAI API Pricing](https://openai.com/api/pricing/)
2. [OpenAI Realtime API](https://openai.com/index/introducing-gpt-realtime/)
3. [Google Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
4. [Gemini Live API](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api)
5. [Anthropic Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
6. [Groq Pricing](https://groq.com/pricing)
7. [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
8. [AWS Nova Models](https://aws.amazon.com/nova/models/)
9. [Mistral AI Pricing](https://mistral.ai/pricing)
10. [Cohere Pricing](https://cohere.com/pricing)
11. [Deepgram Pricing](https://deepgram.com/pricing)
12. [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api)
13. [Cartesia Pricing](https://cartesia.ai/pricing)

### Benchmarks & Analysis

14. [Artificial Analysis LLM Leaderboard](https://artificialanalysis.ai/leaderboards/models)
15. [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html)
16. [LLM Stats](https://llm-stats.com/)
17. [Klu LLM Leaderboard](https://klu.ai/llm-leaderboard)
18. [AIMultiple LLM Latency Benchmark](https://research.aimultiple.com/llm-latency-benchmark/)

### Technical Deep Dives

19. [Groq LPU Architecture](https://groq.com/lpu-architecture)
20. [Cerebras Inference](https://www.cerebras.ai/blog/introducing-cerebras-inference-ai-at-instant-speed)
21. [Ultravox Speech LLM](https://www.ultravox.ai/)
22. [Daily.co LLM Benchmarks for Voice](https://www.daily.co/blog/benchmarking-llms-for-voice-agent-use-cases/)

### Industry Guides

23. [AssemblyAI Voice AI Stack 2026](https://www.assemblyai.com/blog/the-voice-ai-stack-for-building-agents)
24. [Softcery LLM Comparison for Voice](https://softcery.com/lab/ai-voice-agents-choosing-the-right-llm)
25. [Retell AI LLM Guide](https://www.retellai.com/blog/choosing-the-best-llm-for-your-voice-ai-agents)
26. [Gladia LLM Comparison](https://www.gladia.io/blog/comparing-llms-for-voice-agents)
27. [Vellum Voice AI Platforms Guide](https://www.vellum.ai/blog/ai-voice-agent-platforms-guide)

### Platform Comparisons

28. [Retell vs Vapi Comparison](https://www.retellai.com/comparisons/retell-vs-vapi)
29. [Voice AI Platform Pricing 2025](https://www.retellai.com/resources/voice-ai-platform-pricing-comparison-2025)
30. [CloudTalk Voice AI Costs](https://www.cloudtalk.io/blog/how-much-does-voice-ai-cost/)
31. [Telnyx Voice AI Latency Benchmark](https://telnyx.com/resources/voice-ai-agents-compared-latency)
32. [Hamming AI Latency Guide](https://hamming.ai/resources/voice-ai-latency-whats-fast-whats-slow-how-to-fix-it)

### Provider-Specific

33. [Groq Llama 4 Announcement](https://groq.com/blog/llama-4-now-live-on-groq-build-fast-at-the-lowest-cost-without-compromise)
34. [Cerebras vs Blackwell](https://www.cerebras.ai/blog/blackwell-vs-cerebras)
35. [SambaNova Cloud](https://sambanova.ai/)
36. [Fireworks AI Pricing](https://fireworks.ai/pricing)
37. [Together AI](https://www.together.ai/)
38. [OpenRouter Pricing](https://openrouter.ai/pricing)

### Model Announcements

39. [Claude Haiku 4.5](https://www.anthropic.com/news/claude-haiku-4-5)
40. [GPT-4o-mini Launch](https://openai.com/index/gpt-4o-mini-advancing-cost-efficient-intelligence/)
41. [Llama 4 Models](https://www.llama.com/models/llama-4/)
42. [Gemini 2.5 Flash-Lite](https://developers.googleblog.com/en/gemini-25-flash-lite-is-now-stable-and-generally-available/)
43. [Deepgram Nova-3](https://deepgram.com/learn/introducing-nova-3-speech-to-text-api)

### Voice/Audio Specific

44. [ElevenLabs Conversational AI Pricing Cut](https://elevenlabs.io/blog/we-cut-our-pricing-for-conversational-ai)
45. [Cartesia Sonic 3](https://www.eesel.ai/blog/cartesia-sonic-3-api)
46. [PlayHT Review](https://qcall.ai/play-ht-review)
47. [Inworld TTS Benchmarks 2026](https://inworld.ai/resources/best-voice-ai-tts-apis-for-real-time-voice-agents-2026-benchmarks)

### Cost Calculators

48. [Pricepertoken.com](https://pricepertoken.com/)
49. [Helicone LLM Cost](https://www.helicone.ai/llm-cost/)
50. [Softcery Voice Agent Calculator](https://softcery.com/ai-voice-agents-calculator)

---

## Methodology Notes

- **Searches performed:** 28
- **Source types:** Official docs, benchmarks, industry guides, platform comparisons, calculators
- **Contradictions found:** Minor pricing discrepancies between sources (used official docs as authority)
- **Recency:** All sources from 2025-2026, prioritized January 2026 data
