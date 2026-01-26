# Lumentra Voice AI Stack - Research Report (January 2026)

## Executive Summary

This report analyzes the current Lumentra voice AI implementation, identifies critical issues, and provides cost-optimized architecture recommendations for achieving sub-500ms voice-to-voice latency at scale (10,000-100,000 min/month).

**Key Findings:**

1. Current notebook has multiple dependency issues and uses outdated model references
2. FunctionGemma 270M via Ollama is **not production-ready** for sub-500ms latency targets
3. Custom stack can achieve **70-85% cost savings** vs Vapi ($0.02-0.04/min vs $0.13-0.31/min)
4. Groq's free tier has rate limits unsuitable for production; paid tier required
5. Architecture requires fundamental redesign for sub-500ms target

**January 2026 Market Updates:**

- Nvidia acquired Groq's LPU technology and engineering team in December 2025 for $20B
- Cerebras signed a $10B deal with OpenAI for inference infrastructure (January 2026)
- Llama 4 launched in Spring 2025 but is not open-weight (only via Meta AI)
- Qwen 3 released April 2025 with significantly improved tool calling
- Kimi K2 emerged as a strong 1T MoE model (32B active) for agentic tasks

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Notebook Issues & Fixes](#2-notebook-issues--fixes)
3. [Cost Analysis](#3-cost-analysis)
4. [Breaking Changes & Deprecations](#4-breaking-changes--deprecations)
5. [Architecture Recommendations](#5-architecture-recommendations)
6. [Component Deep Dive](#6-component-deep-dive)
7. [Latency Budget](#7-latency-budget)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Risk Analysis](#9-risk-analysis)
10. [Open Questions](#10-open-questions)

---

## 1. Current State Analysis

### 1.1 Current Architecture

```
Current: SignalWire -> Deepgram (STT) -> FunctionGemma (Router) -> Groq (LLM) -> Cartesia (TTS)
```

**Files Analyzed:**

- `lumentra-api/src/services/functiongemma/router.ts` - Ollama-based function calling router
- `lumentra-api/src/services/groq/client.ts` - Groq LLM configuration
- `lumentra-api/src/services/voice/turn-manager.ts` - Voice conversation orchestration
- `lumentra-api/src/services/fallback/chain.ts` - Fallback chain logic
- `lumentra-api/notebooks/h100_voice_ai_testing.ipynb` - Testing notebook (BROKEN)

### 1.2 Critical Issues Identified

| Issue                                  | Severity | Location                      | Impact                   |
| -------------------------------------- | -------- | ----------------------------- | ------------------------ |
| FunctionGemma Ollama latency spikes    | CRITICAL | `router.ts`                   | 20s+ delays after idle   |
| Notebook uses non-existent model names | HIGH     | `h100_voice_ai_testing.ipynb` | Cannot run               |
| Groq free tier rate limits             | HIGH     | Production                    | Will hit limits at scale |
| No streaming TTS                       | MEDIUM   | `cartesia/tts.ts`             | Added latency            |
| Sequential pipeline (not parallel)     | HIGH     | `turn-manager.ts`             | Cannot hit 500ms         |

### 1.3 What's Actually Working

- Deepgram STT integration (Nova-2 phonecall model) - WORKING
- Cartesia TTS integration (Sonic model) - WORKING
- SignalWire telephony - WORKING
- Groq API client - WORKING (but wrong tier for production)
- FunctionGemma concept - FLAWED (Ollama reliability issues)

---

## 2. Notebook Issues & Fixes

### 2.1 Dependency Issues

**Problem 1: Model Name Errors**

```python
# WRONG (in notebook)
gemma_model_id = "google/gemma-3-12b-it"

# CORRECT (actual HuggingFace model ID)
gemma_model_id = "google/gemma-3-12b-it"  # This IS correct, but requires gating approval
```

**Problem 2: Missing Dependencies**

```python
# Notebook uses vllm but doesn't install it properly
!pip install -q vllm  # This can fail on Colab due to CUDA version mismatch
```

**Problem 3: HuggingFace Token Handling**

```python
# Current code assumes HF_TOKEN in Colab secrets
# Fails silently if not present
```

### 2.2 Fixed Notebook Requirements

```python
# Correct dependency installation for 2026
!pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cu124
!pip install transformers>=4.48.0 accelerate>=1.2.0 bitsandbytes>=0.45.0
!pip install huggingface_hub>=0.27.0

# For production testing
!pip install groq-sdk>=0.37.0
```

### 2.3 Model Availability (January 2026)

| Model                               | Status    | Access                    | Notes                       |
| ----------------------------------- | --------- | ------------------------- | --------------------------- |
| `google/gemma-3-12b-it`             | AVAILABLE | Gated (requires approval) | 12B params, multimodal      |
| `google/functiongemma-270m-it`      | AVAILABLE | Gated                     | Function calling specialist |
| `meta-llama/Llama-3.1-8B-Instruct`  | AVAILABLE | Open                      | Tool calling support        |
| `meta-llama/Llama-3.3-70B-Instruct` | AVAILABLE | Open                      | Best tool calling           |

---

## 3. Cost Analysis

### 3.1 Vapi Full Stack Cost (Baseline)

| Component          | Cost/min           | Notes                    |
| ------------------ | ------------------ | ------------------------ |
| Vapi Platform Fee  | $0.05              | Fixed orchestration cost |
| STT (Deepgram)     | $0.015             | Pass-through             |
| LLM (GPT-4o-mini)  | $0.02-0.05         | Varies by usage          |
| TTS (ElevenLabs)   | $0.03-0.05         | Premium voices           |
| Telephony (Twilio) | $0.02              | Pass-through             |
| **Total Vapi**     | **$0.13-0.31/min** |                          |

**At 50,000 min/month: $6,500 - $15,500/month**

### 3.2 Custom Stack Cost (Target)

| Component        | Provider            | Cost/min       | Notes                         |
| ---------------- | ------------------- | -------------- | ----------------------------- |
| Telephony        | SignalWire          | $0.003         | 85% cheaper than Twilio       |
| STT              | Deepgram Nova-2     | $0.0043        | Phonecall model               |
| LLM              | Groq (Llama 3.1 8B) | $0.0002        | $0.05/M input, $0.08/M output |
| TTS              | Cartesia Sonic      | $0.03          | 40ms TTFA                     |
| **Total Custom** |                     | **$0.037/min** |                               |

**At 50,000 min/month: $1,850/month (86% savings)**

### 3.3 Alternative STT Options

| Provider       | Model            | Cost/min | Latency | WER   |
| -------------- | ---------------- | -------- | ------- | ----- |
| Deepgram       | Nova-2 Phonecall | $0.0043  | <300ms  | ~12%  |
| Deepgram       | Nova-3           | $0.0077  | <300ms  | 6.84% |
| AssemblyAI     | Universal        | $0.0065  | ~400ms  | ~8%   |
| Whisper (Groq) | Large-v3         | $0.0005  | ~500ms  | ~5%   |

**Recommendation:** Deepgram Nova-2 Phonecall for cost/latency balance. Nova-3 if accuracy critical.

### 3.4 Alternative TTS Options

| Provider         | Cost/min        | TTFA    | Languages | Notes           |
| ---------------- | --------------- | ------- | --------- | --------------- |
| Cartesia Sonic   | $0.03           | 40-90ms | 15        | Best latency    |
| Smallest AI      | $0.01           | <100ms  | 30+       | 66% cheaper     |
| ElevenLabs Flash | $0.15           | 75ms    | 70+       | Premium quality |
| Speechmatics     | $0.011/1K chars | <150ms  | Multiple  | Good balance    |

**Recommendation:** Cartesia for sub-500ms target. Smallest AI for cost optimization.

### 3.5 Alternative LLM Options

| Provider     | Model         | Cost/1M tokens       | Latency (TTFT) | Tool Calling |
| ------------ | ------------- | -------------------- | -------------- | ------------ |
| Groq         | Llama 3.1 8B  | $0.05 in / $0.08 out | ~200ms         | Native       |
| Groq         | Llama 3.3 70B | $0.59 in / $0.79 out | ~300ms         | Best         |
| Cerebras     | Llama 3.1 8B  | $0.10 in / $0.10 out | ~150ms         | Native       |
| Together AI  | Llama 3.1 8B  | $0.18 in / $0.18 out | ~250ms         | Native       |
| Local (H100) | Llama 3.1 8B  | $2.50/hr GPU         | ~100ms         | Native       |

**Recommendation:** Groq Llama 3.1 8B for API. Self-hosted for >100K min/month.

---

## 4. Breaking Changes & Deprecations

### 4.1 Groq API Changes (2025-2026)

| Date     | Change                                | Impact                                  |
| -------- | ------------------------------------- | --------------------------------------- |
| May 2025 | `llama3-8b-8192` deprecated           | Migrate to `llama-3.1-8b-instant`       |
| Aug 2025 | `gemma2-9b-it` deprecated             | Migrate to `llama-3.1-8b-instant`       |
| Aug 2025 | `llama-3-groq-8b-tool-use` deprecated | Use `llama-3.1-8b-instant` native tools |

**Current Code Status:** Uses `llama-3.1-8b-instant` - CORRECT

### 4.2 Deepgram API Changes

| Change             | Status          | Notes                        |
| ------------------ | --------------- | ---------------------------- |
| Nova-3 released    | Available       | Better accuracy, higher cost |
| `nova-2-phonecall` | Still supported | Recommended for phone        |
| WebSocket API v2   | Current         | No breaking changes          |

**Current Code Status:** Uses `nova-2-phonecall` - CORRECT

### 4.3 Cartesia API Changes

| Change           | Status          | Notes                  |
| ---------------- | --------------- | ---------------------- |
| Sonic-3 released | Available       | AI laughter, emotions  |
| `sonic-english`  | Still supported | Current code uses this |
| WebSocket API    | Stable          | No breaking changes    |

**Current Code Status:** Uses `sonic-english` - CORRECT (consider Sonic-3 upgrade)

### 4.4 Ollama/FunctionGemma Issues

**CRITICAL ISSUE:** Ollama has documented production reliability problems:

1. **Latency Spikes:** 20s+ delays after 5-second idle periods
2. **Memory Leaks:** Response times degrade from seconds to minutes/hours
3. **Concurrency Issues:** "Head-of-line blocking" under load
4. **Not Production Ready:** Ollama docs state it's for "local development, prototyping"

**Source:** GitHub Issues #13552, #7081, #6353, #9103

**Recommendation:** REMOVE FunctionGemma/Ollama from production path. Use Groq native tool calling.

---

## 5. Architecture Recommendations

### 5.1 Current Architecture Problems

```
CURRENT (Sequential, ~1200ms+):
┌──────────┐   ┌──────────┐   ┌─────────────┐   ┌──────┐   ┌──────────┐
│SignalWire│──▶│ Deepgram │──▶│FunctionGemma│──▶│ Groq │──▶│ Cartesia │
│  (40ms)  │   │ (300ms)  │   │   (50-20000ms) │ (400ms)│   │ (100ms)  │
└──────────┘   └──────────┘   └─────────────┘   └──────┘   └──────────┘
                                     ▲
                                     │
                              BOTTLENECK - REMOVE
```

### 5.2 Recommended Architecture (Sub-500ms Target)

```
RECOMMENDED (Parallel/Streaming, ~450ms target):

                    ┌─────────────────────────────────┐
                    │     Conversation State Cache    │
                    │      (Redis/In-Memory)          │
                    └─────────────────────────────────┘
                                    ▲
                                    │
┌──────────┐   ┌──────────────┐    │    ┌──────────────┐
│SignalWire│──▶│  Deepgram    │────┴───▶│    Groq      │
│  WebRTC  │   │  Streaming   │         │  Llama 3.1   │
│  (40ms)  │   │  (150ms TTFT)│         │  Native Tools│
└──────────┘   └──────────────┘         │  (200ms TTFT)│
                                        └──────┬───────┘
                                               │
                                               ▼ (streaming)
                                        ┌──────────────┐
                                        │   Cartesia   │
                                        │  Streaming   │
                                        │  (40ms TTFA) │
                                        └──────────────┘
```

### 5.3 Key Architecture Changes

| Change                           | Why                                | Impact       |
| -------------------------------- | ---------------------------------- | ------------ |
| Remove FunctionGemma/Ollama      | Reliability issues, latency spikes | -200-20000ms |
| Use Groq native tool calling     | Built into Llama 3.1, no extra hop | -50ms        |
| Stream STT → LLM                 | Start LLM before speech ends       | -100ms       |
| Stream LLM → TTS                 | Start TTS before LLM finishes      | -150ms       |
| Co-locate services (same region) | Reduce network latency             | -30ms        |
| Persistent WebSocket connections | Avoid handshake overhead           | -20ms        |

### 5.4 Simplified Router Alternative

Instead of FunctionGemma, use **intent detection in prompt + Groq native tools**:

```typescript
// REMOVE: FunctionGemma router complexity
// REPLACE WITH: Simple intent patterns + Groq native tool calling

const QUICK_PATTERNS = {
  greeting: /^(hi|hello|hey)[\s!.]*$/i,
  farewell: /^(bye|goodbye|thanks)[\s!.]*$/i,
};

function quickRoute(text: string): "template" | "llm" {
  for (const [key, pattern] of Object.entries(QUICK_PATTERNS)) {
    if (pattern.test(text)) return "template";
  }
  return "llm"; // Let Groq handle tool calling natively
}
```

---

## 6. Component Deep Dive

### 6.1 Telephony: SignalWire vs Twilio

| Aspect            | SignalWire        | Twilio      |
| ----------------- | ----------------- | ----------- |
| Cost (voice/min)  | $0.003            | $0.014      |
| Phone numbers     | $0.08/month       | $1.00/month |
| WebSocket streams | Yes               | Yes         |
| API compatibility | Twilio-compatible | Native      |
| Global coverage   | Limited           | Excellent   |
| Support           | Community         | Enterprise  |

**Recommendation:** SignalWire for cost. Twilio if global coverage critical.

### 6.2 STT: Deepgram Configuration

**Current Config (GOOD):**

```typescript
export const defaultDeepgramConfig: DeepgramConfig = {
  model: "nova-2-phonecall", // Correct for phone
  language: "en-US",
  punctuate: true,
  interimResults: true, // Critical for streaming
  utteranceEndMs: 1000, // Consider reducing to 800
  vadEvents: true, // Important for barge-in
  encoding: "mulaw", // Correct for telephony
  sampleRate: 8000, // Correct for phone
  endpointing: 300, // Good
};
```

**Optimization:** Reduce `utteranceEndMs` to 800ms for faster turn detection.

### 6.3 LLM: Groq Configuration

**Current Config (NEEDS UPDATE):**

```typescript
// Current - OK but could optimize
export const chatConfig: GroqConfig = {
  model: "llama-3.1-8b-instant",
  temperature: 0.7, // Consider 0.5 for more deterministic
  maxTokens: 150, // Good for voice
  stream: false, // CHANGE TO TRUE
};
```

**Recommended Config:**

```typescript
export const chatConfig: GroqConfig = {
  model: "llama-3.1-8b-instant",
  temperature: 0.5, // More deterministic for tools
  maxTokens: 150,
  stream: true, // CRITICAL for latency
};
```

### 6.4 TTS: Cartesia Configuration

**Current Config (GOOD):**

```typescript
export const defaultCartesiaConfig: CartesiaConfig = {
  modelId: "sonic-english",
  voiceId: cartesiaVoices.hannah,
  outputFormat: {
    container: "raw",
    encoding: "pcm_mulaw", // Correct for telephony
    sampleRate: 8000, // Correct
  },
};
```

**Optimization:** Consider `sonic-3` for emotional expressions.

---

## 7. Latency Budget

### 7.1 Target: Sub-500ms Voice-to-Voice

| Component       | Current          | Target    | How                  |
| --------------- | ---------------- | --------- | -------------------- |
| Telephony       | 40ms             | 40ms      | Already optimized    |
| Audio buffering | 30ms             | 20ms      | Reduce buffer size   |
| STT (TTFT)      | 300ms            | 150ms     | Use interim results  |
| Router          | 50-20000ms       | 0ms       | Remove FunctionGemma |
| LLM (TTFT)      | 400ms            | 200ms     | Groq streaming       |
| TTS (TTFA)      | 100ms            | 40ms      | Cartesia WebSocket   |
| Network         | 50ms             | 10ms      | Co-locate services   |
| **Total**       | **1000-20500ms** | **460ms** |                      |

### 7.2 Optimization Techniques

1. **Parallel STT→LLM:** Start LLM inference with partial transcript
2. **Streaming LLM→TTS:** Start TTS with first LLM tokens
3. **Connection pooling:** Reuse WebSocket connections
4. **Regional deployment:** All services in same cloud region
5. **Warm connections:** Keep STT/TTS WebSockets alive

### 7.3 Streaming Pipeline

```
Time 0ms     : User stops speaking
Time 20ms   : Final STT transcript received (interim used earlier)
Time 30ms   : LLM request sent
Time 230ms  : First LLM tokens received
Time 240ms  : TTS synthesis started
Time 280ms  : First audio bytes generated
Time 320ms  : Audio playback begins
Time ~500ms : Response perceived by user
```

---

## 8. Implementation Roadmap

### Phase 1: Fix Critical Issues (Week 1)

1. Remove FunctionGemma/Ollama dependency
2. Enable Groq streaming
3. Update notebook with correct models
4. Add connection pooling

### Phase 2: Optimize Pipeline (Week 2)

1. Implement streaming STT→LLM
2. Implement streaming LLM→TTS
3. Reduce utteranceEndMs to 800ms
4. Add latency metrics/logging

### Phase 3: Scale Testing (Week 3)

1. Load test at 1000 concurrent calls
2. Measure p50/p95/p99 latencies
3. Identify bottlenecks
4. Tune configurations

### Phase 4: Production Hardening (Week 4)

1. Add circuit breakers
2. Implement fallbacks
3. Set up monitoring/alerting
4. Document runbooks

---

## 9. Risk Analysis

### 9.1 Technical Risks

| Risk                     | Probability | Impact              | Mitigation              |
| ------------------------ | ----------- | ------------------- | ----------------------- |
| Groq rate limits         | High        | Service degradation | Upgrade to paid tier    |
| Deepgram outage          | Low         | Complete outage     | Add Whisper fallback    |
| Cartesia latency spike   | Medium      | UX degradation      | Add ElevenLabs fallback |
| SignalWire coverage gaps | Medium      | Lost calls          | Twilio fallback         |

### 9.2 Cost Risks

| Risk                | Probability | Impact             | Mitigation              |
| ------------------- | ----------- | ------------------ | ----------------------- |
| Groq price increase | Medium      | 2-5x cost increase | Multi-provider strategy |
| Usage spike         | Medium      | Unexpected bills   | Usage caps, alerts      |
| Hidden fees         | Low         | Budget overrun     | Audit all providers     |

### 9.3 Vendor Lock-in

| Component  | Lock-in Risk | Alternatives              |
| ---------- | ------------ | ------------------------- |
| SignalWire | Low          | Twilio, Telnyx            |
| Deepgram   | Medium       | AssemblyAI, Whisper       |
| Groq       | Low          | Cerebras, Together, Local |
| Cartesia   | Medium       | ElevenLabs, Smallest AI   |

---

## 10. Open Questions

**Requires Your Input:**

1. **Language Support:** Is English-only acceptable, or do you need multilingual support?

   - Impacts: STT model choice (Nova-2 vs Nova-3), TTS provider choice

2. **Voice Cloning:** Do you need custom brand voices?

   - Impacts: TTS provider choice (Cartesia basic vs ElevenLabs)

3. **Compliance:** Any specific compliance requirements (HIPAA, PCI, SOC2)?

   - Impacts: Provider selection, data handling

4. **Fallback Strategy:** What should happen when primary providers fail?

   - Options: Static message, transfer to human, secondary provider

5. **Monitoring:** What observability stack are you using?

   - Impacts: Integration approach for latency tracking

6. **GPU Budget:** For self-hosted models, what's the monthly GPU budget?
   - Determines: Local vs API for LLM

---

## Appendix A: Provider Pricing Summary (January 2026)

### A.1 Full Stack Cost Comparison

| Stack                | Cost/min   | Monthly (50K min) | Notes           |
| -------------------- | ---------- | ----------------- | --------------- |
| Vapi (GPT-4o-mini)   | $0.15-0.20 | $7,500-10,000     | Easiest setup   |
| Vapi (Groq)          | $0.10-0.12 | $5,000-6,000      | Faster, cheaper |
| Custom (Groq)        | $0.037     | $1,850            | 75% savings     |
| Custom (Self-hosted) | $0.02      | $1,000            | Max savings     |

### A.2 Individual Component Costs

| Component | Cheapest               | Recommended               | Premium            |
| --------- | ---------------------- | ------------------------- | ------------------ |
| Telephony | SignalWire ($0.003)    | SignalWire                | Twilio ($0.014)    |
| STT       | Whisper/Groq ($0.0005) | Deepgram Nova-2 ($0.0043) | Nova-3 ($0.0077)   |
| LLM       | Groq Free (limited)    | Groq Paid ($0.0002)       | GPT-4o ($0.01)     |
| TTS       | Smallest AI ($0.01)    | Cartesia ($0.03)          | ElevenLabs ($0.15) |

---

## Appendix B: Code Changes Required

### B.1 Files to Modify

1. `lumentra-api/src/services/groq/client.ts` - Enable streaming
2. `lumentra-api/src/services/voice/turn-manager.ts` - Remove FunctionGemma
3. `lumentra-api/src/services/fallback/chain.ts` - Simplify chain
4. `lumentra-api/notebooks/h100_voice_ai_testing.ipynb` - Fix dependencies

### B.2 Files to Remove

1. `lumentra-api/src/services/functiongemma/router.ts` - Replace with simple patterns
2. `lumentra-api/src/services/functiongemma/types.ts` - No longer needed

### B.3 Files to Add

1. `lumentra-api/src/services/groq/streaming.ts` - Streaming handler
2. `lumentra-api/src/lib/metrics.ts` - Latency tracking
3. `lumentra-api/src/services/fallback/providers.ts` - Multi-provider fallback

---

---

## 11. Qwen 3 vs Llama 3.1 Analysis

### 11.1 Model Comparison

| Aspect                 | Qwen 3 8B             | Llama 3.1 8B       | Winner    |
| ---------------------- | --------------------- | ------------------ | --------- |
| Tool Calling           | Hermes-style, native  | JSON-based, native | Qwen 3    |
| Tau2-Bench (Agentic)   | 69.6                  | ~55                | Qwen 3    |
| Mathematical Reasoning | Superior              | Good               | Qwen 3    |
| Multilingual           | Excellent (30+ langs) | Good (8 langs)     | Qwen 3    |
| Parallel Tool Calls    | Yes                   | No (Llama 4 only)  | Qwen 3    |
| Groq Availability      | No                    | Yes                | Llama 3.1 |
| Cerebras Availability  | Yes                   | Yes                | Tie       |

### 11.2 Tool Calling Performance

**Qwen 3 Advantages:**

- Outperforms open-source peers in browser navigation and code execution tasks
- Scores 69.6 on Tau2-Bench Verified, rivaling proprietary models
- Can act multimodal by calling external APIs
- Native parallel tool calling support

**Qwen 3 Limitations:**

- Struggles with multi-step agentic tasks requiring >5 tool calls
- Hermes-style tool format requires specific prompting
- Not available on Groq (our primary LLM provider)

**Llama 3.1 Advantages:**

- Available on Groq with ~200ms TTFT
- Well-documented tool calling format
- Strong community support and examples

### 11.3 Recommendation

**For Lumentra:** Stay with **Llama 3.1 8B on Groq** for now because:

1. Groq provides the lowest latency (~200ms TTFT)
2. Tool calling requirements are simple (3-4 tools max)
3. Qwen 3 not available on Groq
4. Can revisit if self-hosting on vLLM (where Qwen 3 shines)

**Future Option:** If self-hosting, Qwen 3 8B on vLLM would be superior for complex agentic workflows.

---

## 12. Multi-Tenant Architecture (Serving Multiple Businesses)

### 12.1 Your Business Context

- Parent company: Data center / ISP services provider
- Target customers: Hotels, clinics, service businesses
- Expected scale: 5+ businesses in first month
- Peak concurrent calls: 2-10+ per business during rush hours
- Future capability: Self-hosted infrastructure

### 12.2 Concurrent Call Capacity Planning

**Scenario Analysis:**

| Businesses | Calls/Business (Peak) | Total Concurrent | Architecture Needed           |
| ---------- | --------------------- | ---------------- | ----------------------------- |
| 5          | 2-3                   | 10-15            | Single API instance           |
| 10         | 3-5                   | 30-50            | Load-balanced APIs            |
| 25         | 5-10                  | 125-250          | Distributed + Self-hosted LLM |
| 50+        | 10+                   | 500+             | Multi-region + GPU cluster    |

### 12.3 Architecture Options

#### Option A: Pure API (Current)

```
Cost: ~$0.037/min
Best for: <50 concurrent calls
Pros: Zero infrastructure, instant scaling
Cons: Rate limits, vendor dependency, latency variance
```

#### Option B: Hybrid (API + Self-hosted LLM)

```
Cost: ~$0.025/min (40% savings on LLM)
Best for: 50-500 concurrent calls
Pros: Control over LLM, predictable latency
Cons: GPU management overhead
```

#### Option C: Full Self-Hosted

```
Cost: ~$0.015/min (60% savings)
Best for: 500+ concurrent calls
Pros: Maximum control, lowest per-minute cost
Cons: High upfront investment, operational complexity
```

### 12.4 GPU Hosting Decision Matrix

| Factor             | API (Groq) | Cloud GPU Rental | Self-Hosted        |
| ------------------ | ---------- | ---------------- | ------------------ |
| Upfront Cost       | $0         | $0               | $150,000+ (8xH100) |
| Monthly (50K min)  | $1,850     | $1,500-2,500     | $500-1,000         |
| Monthly (200K min) | $7,400     | $2,500-3,500     | $500-1,000         |
| Break-even         | N/A        | ~30K min/month   | ~100K min/month    |
| Latency Control    | Limited    | Good             | Best               |
| Scaling            | Instant    | Minutes          | Hours              |
| Maintenance        | Zero       | Low              | High               |

### 12.5 GPU Cloud Pricing (January 2026)

| Provider      | H100 SXM | H100 PCIe | A100 80GB |
| ------------- | -------- | --------- | --------- |
| Hyperstack    | $2.40/hr | $1.90/hr  | $1.29/hr  |
| RunPod        | $2.99/hr | $1.99/hr  | $1.49/hr  |
| Vast.ai       | Variable | $1.80/hr  | $1.20/hr  |
| GMI Cloud     | $2.40/hr | $2.10/hr  | $1.50/hr  |
| AWS/GCP/Azure | $4-8/hr  | $4-6/hr   | $3-4/hr   |

**Recommendation:** Start with Hyperstack or RunPod for testing. Avoid hyperscalers (2-4x more expensive).

### 12.6 vLLM Performance Benchmarks

**H100 SXM (Single GPU):**

- Llama 3.1 8B: ~12,500 tokens/s throughput
- Qwen 3 8B: ~12,000 tokens/s throughput
- Concurrent requests: 100+ stable

**A100 80GB (Single GPU):**

- Llama 3.1 8B: ~6,000 tokens/s throughput
- Concurrent requests: 50+ stable
- Cost-effective for medium scale

**Practical Capacity (H100):**

- 1 H100 can serve ~50-100 concurrent voice calls
- Assumes 150 tokens/turn, 200ms TTFT target
- Headroom for burst traffic

### 12.7 Recommended Scaling Path

**Phase 1 (Now - 5 businesses, <50 concurrent):**

- Use Groq API for LLM
- Use Deepgram/Cartesia APIs
- Total: ~$0.037/min

**Phase 2 (10-25 businesses, 50-250 concurrent):**

- Self-host LLM on 1-2 H100s (RunPod/Hyperstack)
- Keep STT/TTS on APIs
- Total: ~$0.025/min

**Phase 3 (50+ businesses, 500+ concurrent):**

- Self-host LLM on dedicated H100 cluster (your data center)
- Consider self-hosted STT (Whisper on GPU)
- Keep TTS on Cartesia (hard to self-host well)
- Total: ~$0.015/min

---

## 13. Human Transfer Handling (Critical Feature)

### 13.1 The Problem

> "If we can't handle 'let me talk to a human' gracefully, this product has no purpose."

**Key Statistics:**

- 86% of customers prefer humans for complex issues
- 80% will only use AI if they know human backup exists
- 73% cite "repeating information" as major frustration

### 13.2 When Human Transfer Is Triggered

| Trigger            | Detection Method                 | Priority  |
| ------------------ | -------------------------------- | --------- |
| Direct request     | "I want to talk to a person"     | Immediate |
| Repeated failures  | Bot fails 2-3 times              | High      |
| Emotional distress | Sentiment analysis, raised voice | High      |
| Complex issue      | Multi-step, outside scope        | Medium    |
| Complaints/refunds | Specific keywords                | High      |

### 13.3 Transfer Scenarios & Handling

#### Scenario A: Human Available (Business Hours)

```
Flow: AI detects transfer need -> Warm transfer with context
Latency: <5 seconds to connect
Context passed: Full transcript, intent, customer info
```

**Implementation:**

```typescript
// SignalWire warm transfer with context
async function warmTransferToHuman(call: Call, context: TransferContext) {
  // 1. Inform caller
  await call.say("I'm connecting you with a team member who can help better.");

  // 2. Call human with context display
  const humanCall = await signalwire.dial(humanExtension);
  await humanCall.sendContextToAgent(context); // Shows on screen

  // 3. Merge calls (warm transfer)
  await call.connect(humanCall);
}
```

#### Scenario B: Human Unavailable (After Hours / Busy)

**This is the critical scenario. Options:**

| Option         | User Experience                  | Implementation                  | Best For         |
| -------------- | -------------------------------- | ------------------------------- | ---------------- |
| Callback Queue | "We'll call you back within X"   | Store request, trigger callback | High-value leads |
| Voicemail      | "Leave a message"                | Record + transcribe + notify    | Low urgency      |
| AI Continues   | "Let me try to help another way" | Fallback prompts                | Simple issues    |
| Scheduling     | "Book a call with staff"         | Calendar integration            | Appointments     |
| SMS/Email      | "I'll send details to follow up" | Async communication             | Info requests    |

### 13.4 Recommended Hybrid Approach

```
                    ┌─────────────────────────────────┐
                    │     Human Transfer Requested     │
                    └─────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │   Check Human Availability       │
                    │   (Queue status, business hours) │
                    └─────────────────────────────────┘
                          │                    │
                    Available            Unavailable
                          │                    │
                          ▼                    ▼
                    ┌───────────┐      ┌─────────────────┐
                    │   Warm    │      │  Classify Issue │
                    │  Transfer │      └─────────────────┘
                    └───────────┘              │
                                    ┌─────────┼─────────┐
                                    │         │         │
                              Urgent     Medium      Low
                                    │         │         │
                                    ▼         ▼         ▼
                              ┌────────┐ ┌────────┐ ┌────────┐
                              │Callback│ │Schedule│ │Voicemail│
                              │ Queue  │ │  Appt  │ │+ Email │
                              └────────┘ └────────┘ └────────┘
```

### 13.5 Callback Queue Implementation

```typescript
interface CallbackRequest {
  callerId: string;
  callerName: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  transcript: string;
  requestedAt: Date;
  businessId: string;
  estimatedWait: number; // minutes
}

async function handleUnavailableHuman(
  call: Call,
  context: ConversationContext,
): Promise<void> {
  const urgency = await classifyUrgency(context);

  if (urgency === "high") {
    // Callback queue with time estimate
    const waitTime = await getEstimatedWaitTime(context.businessId);

    await call.say(
      `I understand this is urgent. Our team will call you back within ${waitTime} minutes. ` +
        `To confirm, your callback number is ${formatPhone(call.from)}. ` +
        `Is that correct?`,
    );

    // Confirm and queue
    const confirmed = await call.gather({ numDigits: 1 });
    if (confirmed === "1" || confirmed === "yes") {
      await queueCallback({
        callerId: call.from,
        reason: context.transferReason,
        urgency: "high",
        transcript: context.fullTranscript,
        businessId: context.businessId,
      });

      await call.say(
        `Perfect. You're in the queue and will receive a call shortly. ` +
          `I'm also sending you a text with a reference number. Is there anything else?`,
      );
    }
  } else if (urgency === "medium") {
    // Offer appointment scheduling
    await call.say(
      `I can schedule a call with our team. Would you like to book a specific time, ` +
        `or should we call you back when someone is available?`,
    );
    // Handle scheduling flow...
  } else {
    // Voicemail + email follow-up
    await call.say(
      `Our team is currently unavailable. I can take a detailed message and ` +
        `they'll get back to you by email or phone. Would you like to leave a message?`,
    );
    // Handle voicemail...
  }
}
```

### 13.6 Context Preservation (Critical)

**What to pass to human agent:**

```typescript
interface WarmTransferContext {
  // Caller info
  callerPhone: string;
  callerName?: string;

  // Conversation summary
  fullTranscript: string;
  aiSummary: string; // LLM-generated 2-3 sentence summary

  // Intent analysis
  primaryIntent: string;
  detectedEntities: Record<string, string>; // dates, names, etc.

  // Transfer reason
  transferReason: string;
  failedAttempts: number;

  // Customer history (from CRM)
  previousCalls: number;
  customerTier: string;
  openIssues: string[];
}
```

### 13.7 Hotel/Clinic Specific Patterns

**Hotels:**

- After hours: "I can help with reservations and basic questions. For urgent matters, I'll connect you to our night manager."
- Busy times: Queue with music + position announcements
- Complaints: Immediate escalation + manager notification

**Clinics:**

- After hours: "For medical emergencies, please call 911. For appointment scheduling, I can help now or you can leave a message."
- Urgent medical: Never block, always offer emergency routing
- Prescription refills: AI can handle, queue for doctor approval

---

## 14. TTS Optimization: Cartesia vs Smallest AI

### 14.1 Benchmark Comparison

| Metric                     | Cartesia Sonic | Smallest AI Lightning |
| -------------------------- | -------------- | --------------------- |
| TTFA (Time to First Audio) | 40-90ms        | <100ms                |
| Cost per minute            | $0.03          | $0.01                 |
| MOS Score (quality)        | Good           | +0.27 higher          |
| Languages                  | 15             | 30+                   |
| Voice cloning              | Yes            | Yes ($0.045/min)      |
| Numbers/dates handling     | Weak           | Strong                |
| Emotional expression       | Sonic-3 only   | Standard              |

### 14.2 Independent Analysis

**Cartesia Strengths:**

- Fastest raw TTFA (40ms achievable)
- Best for ultra-low-latency requirements
- Sonic-3 has emotional expressions (laughter, etc.)

**Cartesia Weaknesses:**

- Higher cost (3x Smallest AI)
- Struggles with numbers, dates, proper nouns
- Limited language support

**Smallest AI Strengths:**

- 66% cheaper
- Better voice quality (MOS score)
- Better handling of dates/numbers (critical for appointments)
- More languages

**Smallest AI Weaknesses:**

- Slightly higher latency (~100ms vs 40ms)
- Less established (newer company)
- Self-benchmarked results (potential bias)

### 14.3 Recommendation: Hybrid Approach

```typescript
// Use both providers based on scenario
const TTS_STRATEGY = {
  // Cartesia for speed-critical responses
  greeting: "cartesia", // First impression, minimal latency
  acknowledgment: "cartesia", // "Got it", "I see", quick confirms

  // Smallest AI for content-heavy responses
  appointment_details: "smallest", // Dates, times, numbers
  information: "smallest", // Longer explanations
  pricing: "smallest", // Money amounts

  // Default
  default: "cartesia", // Prioritize latency
};

async function synthesizeSpeech(text: string, type: string): Promise<Audio> {
  const provider = TTS_STRATEGY[type] || TTS_STRATEGY.default;

  if (provider === "cartesia") {
    return cartesiaClient.synthesize(text);
  } else {
    return smallestClient.synthesize(text);
  }
}
```

### 14.4 Cost Impact

| Volume   | Cartesia Only | Smallest Only | Hybrid (70/30) |
| -------- | ------------- | ------------- | -------------- |
| 50K min  | $1,500        | $500          | $1,200         |
| 100K min | $3,000        | $1,000        | $2,400         |
| 200K min | $6,000        | $2,000        | $4,800         |

**Hybrid savings: 20% vs Cartesia-only**

---

## 15. Concurrent Call Architecture

### 15.1 Scaling Requirements

**Your scenario:**

- 5 businesses in month 1
- Each business: 2-10 concurrent calls at peak
- Total peak: 10-50 concurrent calls initially
- Growth target: 25+ businesses, 250+ concurrent

### 15.2 Architecture for Scale

```
┌────────────────────────────────────────────────────────────────────┐
│                        LOAD BALANCER                                │
│              (Geographic + Least-Connections)                       │
└────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│  Voice Server │          │  Voice Server │          │  Voice Server │
│   Instance 1  │          │   Instance 2  │          │   Instance N  │
│ (Stateless)   │          │ (Stateless)   │          │ (Stateless)   │
└───────┬───────┘          └───────┬───────┘          └───────┬───────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │  Deepgram   │ │   Groq/LLM  │ │  Cartesia   │
            │    Pool     │ │    Pool     │ │    Pool     │
            │ (WebSocket) │ │  (HTTP/2)   │ │ (WebSocket) │
            └─────────────┘ └─────────────┘ └─────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
            ┌─────────────┐                 ┌─────────────┐
            │    Redis    │                 │  PostgreSQL │
            │ (Session +  │                 │  (Tenant +  │
            │  Pub/Sub)   │                 │   Config)   │
            └─────────────┘                 └─────────────┘
```

### 15.3 Multi-Tenant Isolation

```typescript
interface TenantConfig {
  tenantId: string;
  businessName: string;

  // Voice configuration
  voiceId: string; // Custom TTS voice
  systemPrompt: string; // Business-specific AI behavior

  // Tools/capabilities
  enabledTools: string[]; // booking, transfer, info
  businessHours: Schedule;

  // Transfer settings
  humanTransferNumbers: string[];
  afterHoursStrategy: "voicemail" | "callback" | "emergency";

  // Rate limits
  maxConcurrentCalls: number;
  monthlyMinuteLimit: number;
}

// Call routing with tenant isolation
async function handleIncomingCall(call: IncomingCall) {
  // 1. Identify tenant from phone number
  const tenant = await getTenantByPhoneNumber(call.to);

  // 2. Check capacity
  const currentCalls = await redis.get(`tenant:${tenant.id}:active_calls`);
  if (currentCalls >= tenant.maxConcurrentCalls) {
    return await handleOverflow(call, tenant);
  }

  // 3. Create isolated session
  const session = await createSession({
    callId: call.id,
    tenantId: tenant.id,
    config: tenant,
  });

  // 4. Process with tenant-specific config
  await voicePipeline.process(call, session);
}
```

### 15.4 Connection Pool Management

```typescript
class ConnectionPoolManager {
  private deepgramPools: Map<string, WebSocket[]> = new Map();
  private cartesiaPools: Map<string, WebSocket[]> = new Map();

  // Pre-warm connections per region
  async warmPools(regions: string[]): Promise<void> {
    for (const region of regions) {
      // 10 Deepgram connections per region
      this.deepgramPools.set(region, await this.createDeepgramPool(10));

      // 10 Cartesia connections per region
      this.cartesiaPools.set(region, await this.createCartesiaPool(10));
    }
  }

  // Get connection from pool (sub-ms)
  async getConnection(
    type: "deepgram" | "cartesia",
    region: string,
  ): Promise<WebSocket> {
    const pool =
      type === "deepgram"
        ? this.deepgramPools.get(region)
        : this.cartesiaPools.get(region);

    if (pool && pool.length > 0) {
      return pool.pop()!;
    }

    // Pool exhausted - create new (adds latency)
    return this.createNewConnection(type, region);
  }

  // Return to pool after call ends
  returnConnection(
    type: "deepgram" | "cartesia",
    region: string,
    ws: WebSocket,
  ): void {
    if (ws.readyState === WebSocket.OPEN) {
      const pool =
        type === "deepgram"
          ? this.deepgramPools.get(region)
          : this.cartesiaPools.get(region);

      if (pool && pool.length < 20) {
        // Max pool size
        pool.push(ws);
        return;
      }
    }
    ws.close();
  }
}
```

### 15.5 Capacity Planning Formula

```
Required Instances = (Peak Concurrent Calls / Calls per Instance) * 1.5 (headroom)

Where:
- Calls per Instance = 20-30 (conservative, depends on hardware)
- Headroom factor = 1.5 for burst capacity

Example:
- 50 businesses * 5 concurrent each = 250 peak calls
- 250 / 25 calls per instance = 10 instances
- 10 * 1.5 = 15 instances for safety

GPU Requirements (if self-hosting LLM):
- 1 H100 = ~100 concurrent voice calls
- 250 calls = 3 H100s recommended
```

---

## 16. Decision Framework Summary

### 16.1 Immediate Decisions

| Decision             | Recommendation                             | Reasoning                     |
| -------------------- | ------------------------------------------ | ----------------------------- |
| LLM Provider         | Groq (Llama 3.1 8B)                        | Lowest latency, good pricing  |
| STT Provider         | Deepgram Nova-2                            | Best balance, phone-optimized |
| TTS Provider         | Cartesia primary + Smallest AI for content | Speed + quality balance       |
| Telephony            | SignalWire                                 | 85% cheaper than Twilio       |
| Remove FunctionGemma | Yes                                        | Production reliability issues |

### 16.2 Scaling Milestones

| Milestone       | Trigger    | Action                      |
| --------------- | ---------- | --------------------------- |
| 5 businesses    | Now        | Pure API stack              |
| 25 businesses   | ~3 months  | Add cloud GPU for LLM       |
| 50 businesses   | ~6 months  | Consider dedicated hardware |
| 100+ businesses | ~12 months | Full self-hosted option     |

### 16.3 Cost Projections

| Scale       | API Only | Hybrid | Full Self-Hosted |
| ----------- | -------- | ------ | ---------------- |
| 50K min/mo  | $1,850   | N/A    | N/A              |
| 100K min/mo | $3,700   | $2,800 | N/A              |
| 200K min/mo | $7,400   | $4,500 | $3,000           |
| 500K min/mo | $18,500  | $9,000 | $5,000           |

---

---

## 17. LLM Provider Market Analysis (January 2026)

### 17.1 Groq (GroqCloud)

**Status:** Nvidia "aquihired" Groq in December 2025 for $20B. GroqCloud service continues but no new LPU hardware expected.

| Model                   | Input ($/1M) | Output ($/1M) | Speed       | Context | Tool Calling |
| ----------------------- | ------------ | ------------- | ----------- | ------- | ------------ |
| Llama 3.3 70B Versatile | $0.59        | $0.79         | ~250 tok/s  | 128K    | Yes          |
| Llama 3.3 70B Specdec   | $0.59        | $0.99         | 1,665 tok/s | 128K    | Yes          |
| Qwen3 32B               | $0.29        | $0.59         | ~535 tok/s  | 131K    | Yes          |
| Llama 3.1 8B            | $0.05        | $0.08         | 750+ tok/s  | 128K    | Yes          |
| Kimi K2                 | TBD          | TBD           | TBD         | 256K    | Yes          |
| GPT-OSS                 | TBD          | TBD           | TBD         | TBD     | Yes          |

**Latency:** ~0.22s TTFT (historically lowest in industry)

**Pros:**

- Fastest inference speeds (6x+ faster than GPU alternatives)
- Deterministic execution = consistent latency
- Full context window support
- 50% batch processing discount

**Cons:**

- Future uncertain after Nvidia acquisition
- No new hardware development expected
- Engineering team now at Nvidia

### 17.2 Cerebras

**Status:** IPO expected Q2 2026. Signed $10B deal with OpenAI for inference deployment starting 2026.

| Model            | Input ($/1M) | Output ($/1M) | Speed       | Context |
| ---------------- | ------------ | ------------- | ----------- | ------- |
| Llama 3.1 8B     | $0.10        | $0.10         | 1,200 tok/s | 8K      |
| Llama 3.1 70B    | $0.60        | $0.60         | 2,100 tok/s | 8K      |
| Llama 3.1 405B   | $6.00        | $12.00        | 969 tok/s   | 8K      |
| Llama 4 Maverick | TBD          | TBD           | 2,522 tok/s | TBD     |

**Latency:** Better TTFT than Groq according to OpenAI benchmarks

**Pros:**

- Fastest raw throughput (2,100+ tok/s for 70B)
- 70x faster than GPUs
- Strong enterprise backing (OpenAI partnership)
- CS-4 systems coming H2 2026

**Cons:**

- Higher per-token cost than Groq
- Some models being deprecated January 20, 2026
- Limited context window (8K vs 128K on Groq)

### 17.3 Together AI

**Status:** Active development, strong open-source model support

| Model           | Input ($/1M) | Output ($/1M) | Context | Tool Calling |
| --------------- | ------------ | ------------- | ------- | ------------ |
| Llama 3.3 70B   | $0.88        | $0.88         | 128K    | Yes          |
| Qwen3-235B-A22B | $0.20        | $0.60         | 256K    | Yes          |
| Qwen3-32B       | $0.80        | $0.80         | 131K    | Yes          |
| DeepSeek-R1     | Varies       | Varies        | 128K    | Yes          |
| Kimi K2         | $1.00        | $3.00         | 256K    | Yes          |
| Mistral Small 3 | ~$0.10       | ~$0.30        | 33K     | Yes          |

**Features:**

- Parallel function calling support
- Streaming with tool calls
- 50% batch discount
- 11x cheaper than GPT-4o for Llama 3.3 70B

**Pros:**

- 200+ model catalog
- Excellent function calling documentation
- Multiple function calls in parallel
- Good streaming support

**Cons:**

- Higher latency than Groq/Cerebras
- Pricing varies significantly by model

### 17.4 Fireworks AI

**Status:** Strong GPU optimization, production-focused

| Metric          | Value                                |
| --------------- | ------------------------------------ |
| GPU Cost        | $3.89/hr (A100) vs $6.50 HuggingFace |
| Latency         | 2-3x lower than vLLM                 |
| Throughput      | 250% higher than open-source engines |
| Mixtral Speed   | Up to 300 tok/s                      |
| New User Credit | $1 free                              |

**Pricing:**

- Cached input tokens: 50% off
- Batch inference: 50% off
- Fine-tuned models: Same price as base

**Features:**

- HIPAA and SOC 2 Type II compliant
- LoRA fine-tuning support
- Supports DeepSeek, Llama, Qwen, Mixtral, DBRX

**Pros:**

- 4x faster than alternatives
- Production-grade reliability
- Good security compliance
- Transparent pricing

**Cons:**

- Function calling still evolving
- Less extreme speeds than Groq/Cerebras

### 17.5 Hyperbolic

**Status:** Aggressive pricing, GPU cloud focus

| Resource  | Price                              |
| --------- | ---------------------------------- |
| H200 GPU  | $2.65/hr                           |
| H100 GPU  | $1.49/hr                           |
| Inference | Up to 80% cheaper than traditional |

**Models Available:**

- DeepSeek R1
- Qwen models (including coder)
- Kimi K2 (1T parameter, good at tool calling)

**Features:**

- BF16 precision for accuracy-critical tasks
- FP8 precision for speed-critical tasks
- OpenAI-compatible API
- Single-tenant GPU options

**Pros:**

- 2.5-3x cheaper than AWS
- No minimums or commitments
- Latest open-source models

**Cons:**

- Less established than competitors
- Limited documentation on tool calling

### 17.6 SambaNova

**Status:** Custom RDU hardware, partnered with Meta for Llama 4 launch

| Model                 | Speed      | Notes                               |
| --------------------- | ---------- | ----------------------------------- |
| DeepSeek R1 671B      | 255 tok/s  | Fastest among benchmarked providers |
| Llama 4               | 800 tok/s  | 10x faster than GPU inference       |
| GPT-OSS 120B          | 600+ tok/s | OpenAI's open model                 |
| Llama 3.1 8B/70B/405B | High       | Launch partner for all variants     |

**Technology:**

- 3-tier memory architecture
- Dataflow processing (not GPU-based)
- Lower power consumption

**Pros:**

- Extreme speeds for large models
- First to support Llama 3.1 full lineup
- Llama 4 launch partner

**Cons:**

- Pricing not publicly detailed
- Less mainstream adoption

---

## 18. Model Analysis (8B-70B for Voice AI)

### 18.1 Llama 3.3 70B

**Released:** December 2024

| Aspect       | Details                                              |
| ------------ | ---------------------------------------------------- |
| Parameters   | 70B                                                  |
| Context      | 128K                                                 |
| Performance  | Approaches Llama 3.1 405B quality                    |
| Tool Calling | Full support (same format as Llama 3.2)              |
| Best Use     | Reasoning, math, general knowledge, function calling |

**Tool Calling Format:**

- Hermes-style JSON schema
- Functions in user message or system prompt
- Structured function call returns
- Multiple formats supported via chat templates

**Recommendation:** Excellent for voice AI. Best balance of quality and speed when served on Groq.

### 18.2 Qwen 3 Series

**Released:** April 29, 2025

| Model         | Activated Params | Context | Tool Calling | Notes                   |
| ------------- | ---------------- | ------- | ------------ | ----------------------- |
| Qwen3-8B      | 8B               | 32K     | Yes          | Outperforms Qwen2.5-14B |
| Qwen3-14B     | 14B              | 32K     | Yes          | Matches Qwen2.5-32B     |
| Qwen3-32B     | 32B              | 131K    | Yes          | Matches Qwen2.5-72B     |
| Qwen3-30B-A3B | 3B (30B total)   | 128K    | Yes          | MoE, beats QwQ-32B      |

**Key Strengths:**

- Expertise in agent capabilities
- Leading performance on complex agent-based tasks
- Parallel function calling native support
- Both thinking and non-thinking modes

**Limitations:**

- Qwen3-30B-A3B struggles with >5 tool calls per task
- Vision models need custom chat templates for tools

**Recommendation:** Qwen3-32B on Groq is a strong contender. Better agentic capability than Llama but check availability.

### 18.3 DeepSeek V3 / R1

**Status:** Extremely cost-effective, strong reasoning

| Model                  | Input ($/1M)                  | Output ($/1M) | Context | Best For              |
| ---------------------- | ----------------------------- | ------------- | ------- | --------------------- |
| DeepSeek-Chat (V3)     | $0.07 (cached) / $0.27 (miss) | $0.27         | 128K    | General tasks, agents |
| DeepSeek-Reasoner (R1) | $0.12                         | $0.20         | 128K    | Complex reasoning     |

**Cost Comparison:**

- 20-50x cheaper than OpenAI equivalents
- 30x cheaper than GPT-5 ($1.25/$10 per 1M)
- V3.2-Exp introduces Sparse Attention for efficiency

**Note:** High first-token latency (19s reported for V3.2) makes it unsuitable for real-time voice.

### 18.4 Kimi K2

**Released:** 2025 by Moonshot AI

| Aspect               | Details          |
| -------------------- | ---------------- |
| Total Parameters     | 1 Trillion (MoE) |
| Activated Parameters | 32B              |
| Context              | 256K             |
| Training             | 15.5T tokens     |

**Pricing:**

| Provider        | Input ($/1M)               | Output ($/1M) |
| --------------- | -------------------------- | ------------- |
| Moonshot Direct | $0.15 (hit) / $0.60 (miss) | $2.50         |
| Together AI     | $1.00                      | $3.00         |
| OpenRouter      | Free - $3.00               | Varies        |

**Tool Calling:**

- Strong tool-calling capabilities
- Parallel function calling supported
- $0.005 per web_search call
- Autonomous tool decision making

**Recommendation:** Excellent for agentic tasks. Higher output cost but very capable.

### 18.5 Mistral Models

| Model                 | Release  | Input ($/1M) | Output ($/1M) | Context |
| --------------------- | -------- | ------------ | ------------- | ------- |
| Mistral Small 3       | Jan 2025 | $0.03        | $0.11         | 33K     |
| Mistral Small 3.1 24B | Mar 2025 | $0.03        | $0.11         | 33K     |
| Mistral Medium 3      | May 2025 | $0.40        | $2.00         | 131K    |
| Mistral Small 3.2 24B | Jun 2025 | $0.06        | $0.18         | 33K     |
| Mistral Large 3 2512  | Dec 2025 | $0.50        | $1.50         | 262K    |

**Best Value:** Mistral Small 3 at $0.03/$0.11 - cheapest quality model available.

---

## 19. Comprehensive Model Comparison for Voice AI

### 19.1 Full Comparison Table

| Model                 | Provider | Input $/1M | Output $/1M | TTFT     | Speed tok/s | Context | Tool Calling | Voice AI Score |
| --------------------- | -------- | ---------- | ----------- | -------- | ----------- | ------- | ------------ | -------------- |
| Llama 3.1 8B          | Groq     | $0.05      | $0.08       | 0.15s    | 750+        | 128K    | Yes          | 9/10           |
| Llama 3.1 8B          | Cerebras | $0.10      | $0.10       | <0.2s    | 1,200       | 8K      | Limited      | 8/10           |
| Qwen3-32B             | Groq     | $0.29      | $0.59       | 0.2s     | 535         | 131K    | Excellent    | 9/10           |
| Llama 3.3 70B Specdec | Groq     | $0.59      | $0.99       | 0.22s    | 1,665       | 128K    | Yes          | 9/10           |
| Llama 3.3 70B         | Cerebras | $0.60      | $0.60       | <0.2s    | 2,100       | 8K      | Limited      | 8/10           |
| Mistral Small 3       | Direct   | $0.03      | $0.11       | 0.3-0.5s | ~200        | 33K     | Yes          | 7/10           |
| Kimi K2               | Moonshot | $0.15      | $2.50       | 0.3s     | ~300        | 256K    | Excellent    | 8/10           |
| DeepSeek V3           | Direct   | $0.07      | $0.27       | 19s      | ~200        | 128K    | Yes          | 3/10           |

**Voice AI Score Criteria:**

- TTFT speed (40%)
- Tool calling quality (30%)
- Cost efficiency (20%)
- Streaming support (10%)

### 19.2 Top 3 Recommendations for Voice AI

#### Recommendation 1: Groq + Llama 3.1 8B (Best for Speed + Cost)

**Why:**

- Fastest TTFT (~150ms)
- Cheapest per-token ($0.05/$0.08)
- Native tool calling
- Consistent latency

**Use Case:** High-volume, cost-sensitive voice agents

**Monthly Cost at 50K minutes:**

- ~$75-150 for LLM alone
- Total stack: ~$1,500-2,000

**Caveats:**

- 8B may struggle with complex reasoning
- Groq future uncertain post-Nvidia acquisition

#### Recommendation 2: Groq + Qwen3-32B (Best for Tool Calling)

**Why:**

- Leading agentic performance
- Excellent parallel function calling
- Full 131K context
- 535 tok/s on Groq

**Use Case:** Complex booking workflows, multi-step tasks

**Monthly Cost at 50K minutes:**

- ~$300-500 for LLM
- Total stack: ~$2,000-2,500

**Caveats:**

- Higher cost than 8B models
- May be overkill for simple queries

#### Recommendation 3: Cerebras + Llama 3.3 70B (Best for Quality)

**Why:**

- Near-405B quality
- 2,100 tok/s throughput
- Lower output cost than Groq ($0.60 vs $0.79)
- OpenAI partnership = long-term stability

**Use Case:** Premium voice agents, complex conversations

**Monthly Cost at 50K minutes:**

- ~$600-900 for LLM
- Total stack: ~$2,500-3,000

**Caveats:**

- Limited context (8K vs 128K)
- Tool calling documentation unclear

### 19.3 Hybrid Strategy (Recommended for Lumentra)

```
Simple Queries (80%) -> Groq Llama 3.1 8B ($0.05/$0.08)
Complex Queries (20%) -> Groq Qwen3-32B ($0.29/$0.59)
```

**Router Logic:**

- Check intent complexity
- Route bookings to 32B
- Route FAQs to 8B

**Cost Savings:** 40-60% vs using 32B for everything

---

## 20. Voice AI Specific Requirements

### 20.1 Latency Targets

| Component                | Target     | Industry Average |
| ------------------------ | ---------- | ---------------- |
| STT                      | <200ms     | 200-500ms        |
| LLM TTFT                 | <200ms     | 500-2000ms       |
| LLM Generation           | >200 tok/s | 50-100 tok/s     |
| TTS TTFA                 | <100ms     | 200-400ms        |
| **Total Voice-to-Voice** | **<500ms** | **1-3 seconds**  |

**Human Expectation:** 200-300ms before perceiving delay

### 20.2 Provider TTFT Comparison

| Provider             | TTFT   | Notes                       |
| -------------------- | ------ | --------------------------- |
| Groq                 | ~0.22s | Most consistent             |
| Cerebras             | <0.22s | Reportedly better than Groq |
| Gemini Flash 2.5     | 0.37s  | Good for voice              |
| GPT-4.1 Mini         | 0.42s  | Acceptable                  |
| Self-hosted Llama 8B | ~0.3s  | Predictable                 |

### 20.3 Streaming Requirements

All leading providers support streaming, but quality varies:

- **Groq:** Streaming + tool calls in delta
- **Together AI:** Full streaming with incremental tool_calls
- **Cerebras:** Streaming supported
- **Fireworks:** Streaming + partial responses

### 20.4 Tool Calling for Bookings

Required capabilities:

1. **Availability Check** - Query calendar systems
2. **Booking Creation** - Create appointments with dates/times
3. **Booking Modification** - Reschedule, cancel
4. **Customer Lookup** - Search by phone/email
5. **Parallel Execution** - Multiple tools in one turn

**Best for Tool Calling:**

1. Qwen 3 series (leading open-source agentic performance)
2. Kimi K2 (designed for agentic tasks)
3. Llama 3.3 70B (mature, well-documented)

### 20.5 Date/Time/Phone Accuracy

Voice AI must handle:

- "Next Tuesday at 3pm"
- "March 15th"
- Phone numbers with correct formatting
- Timezone awareness

**Recommendation:** Use structured prompting with explicit date parsing functions.

---

## 21. Risk Assessment Update

### 21.1 Groq (Medium-High Risk)

- Nvidia acquisition disrupts roadmap
- No new LPU hardware expected
- Service may sunset 2027+

**Mitigation:** Plan migration path to Cerebras/SambaNova

### 21.2 Cerebras (Low Risk)

- $10B OpenAI deal = strong backing
- IPO Q2 2026 = growth mode
- New hardware (CS-4) coming H2 2026

### 21.3 Together AI (Low Risk)

- Diversified model catalog
- Not hardware-dependent
- Easy migration

---

## 22. Updated Lumentra Architecture Recommendation

Based on January 2026 research, the recommended stack:

**Phase 1 (Current - 5 businesses):**

```
STT: Deepgram Nova-2 (streaming)
LLM: Groq Llama 3.1 8B (with fallback to Qwen3-32B)
TTS: Cartesia Sonic (primary) / Smallest AI (dates/numbers)
Telephony: SignalWire
```

**Phase 2 (25+ businesses):**

```
Add: Intent router to select 8B vs 32B
Add: Cerebras as Groq fallback
Consider: Kimi K2 for complex agentic tasks
```

**Phase 3 (50+ businesses):**

```
Self-host: Llama 3.3 70B on H100
Keep: Groq/Cerebras for burst capacity
Add: Fine-tuned models per industry
```

---

## References

- [Groq Pricing](https://groq.com/pricing)
- [Groq Model Deprecations](https://console.groq.com/docs/deprecations)
- [Groq Supported Models](https://console.groq.com/docs/models)
- [Cerebras Inference](https://www.cerebras.ai/inference)
- [Cerebras Pricing](https://www.cerebras.ai/pricing)
- [Cerebras OpenAI Partnership](https://www.cerebras.ai/blog/openai-partners-with-cerebras-to-bring-high-speed-inference-to-the-mainstream)
- [Together AI Pricing](https://www.together.ai/pricing)
- [Together AI Function Calling](https://docs.together.ai/docs/function-calling)
- [Fireworks AI Pricing](https://fireworks.ai/pricing)
- [Hyperbolic Pricing](https://docs.hyperbolic.xyz/docs/hyperbolic-pricing)
- [SambaNova Cloud](https://sambanova.ai/)
- [DeepSeek API Pricing](https://api-docs.deepseek.com/quick_start/pricing)
- [Mistral Pricing](https://docs.mistral.ai/deployment/ai-studio/pricing)
- [Qwen3 Blog](https://qwenlm.github.io/blog/qwen3/)
- [Qwen 3 Function Calling](https://qwen.readthedocs.io/en/latest/framework/function_call.html)
- [Kimi K2 Pricing Analysis](https://artificialanalysis.ai/models/kimi-k2)
- [Llama 3.3 70B Providers](https://artificialanalysis.ai/models/llama-3-3-instruct-70b/providers)
- [LLM Latency Benchmark 2026](https://research.aimultiple.com/llm-latency-benchmark/)
- [Choosing LLM for Voice Agents](https://softcery.com/lab/ai-voice-agents-choosing-the-right-llm)
- [Best Agentic Models January 2026](https://whatllm.org/blog/best-agentic-models-january-2026)
- [Groq LPU Benchmark](https://groq.com/blog/artificialanalysis-ai-llm-benchmark-doubles-axis-to-fit-new-groq-lpu-inference-engine-performance-results)
- [Deepgram Nova-2 vs Nova-3](https://deepgram.com/learn/model-comparison-when-to-use-nova-2-vs-nova-3-for-devs)
- [Cartesia Pricing](https://cartesia.ai/pricing)
- [SignalWire vs Twilio](https://signalwire.com/signalwire-vs-twilio)
- [Voice AI Latency Best Practices](https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents)
- [Self-Hosted vs Vapi TCO](https://blog.dograh.com/self-hosted-voice-agents-vs-vapi-real-cost-analysis-tco-break-even/)
- [Ollama Production Issues](https://github.com/ollama/ollama/issues/13552)
- [FunctionGemma Overview](https://blog.google/technology/developers/functiongemma/)
- [HuggingFace Gemma 3](https://huggingface.co/blog/gemma3)
- [Qwen 3 Benchmarks](https://dev.to/best_codes/qwen-3-benchmarks-comparisons-model-specifications-and-more-4hoa)
- [vLLM vs TensorRT-LLM](https://www.marktechpost.com/2025/11/19/vllm-vs-tensorrt-llm-vs-hf-tgi-vs-lmdeploy-a-deep-technical-comparison-for-production-llm-inference/)
- [H100 Pricing Guide](https://docs.jarvislabs.ai/blog/h100-price)
- [Smallest AI vs Cartesia Benchmark](https://smallest.ai/blog/-tts-benchmark-2025-smallestai-vs-cartesia-report)
- [AI-Human Handoff Best Practices](https://dialzara.com/blog/ai-to-human-handoff-7-best-practices)
- [Retell AI Handoff Guide](https://www.retellai.com/blog/how-an-ai-agent-knows-when-to-handoff-to-a-human-agent)
- [Voice AI Scaling Guide](https://frejun.ai/how-to-scale-voice-agents-for-millions-of-calls/)
- [Groq vs Cerebras Comparison](https://www.cerebras.ai/blog/cerebras-cs-3-vs-groq-lpu)
- [SignalWire AI Agents](https://signalwire.com/products/ai-agent)

---

_Report last updated: January 15, 2026_
