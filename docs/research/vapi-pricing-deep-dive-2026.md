# Vapi Pricing Deep Dive (March 2026)

> Sources: vapi.ai/pricing (rendered via Playwright), docs.vapi.ai API reference, retellai.com/pricing, bland.ai. All prices verified against official pages on 2026-03-22.

---

## 1. Plan Structure (Simplified in 2026)

Vapi has consolidated to **two tiers** -- the old Startup ($59/mo) and Agency ($99/mo) plans are **legacy/grandfathered**. New users get:

|                     | Pay As You Go                  | Enterprise                  |
| ------------------- | ------------------------------ | --------------------------- |
| **Monthly fee**     | $0                             | Annual contract (custom)    |
| **Free credits**    | $10 on signup (no CC required) | N/A                         |
| **Pricing model**   | Usage-based                    | Volume-based (custom rates) |
| **Concurrency**     | 10 included, +$10/line/mo      | Custom                      |
| **Call history**    | 14 days                        | Custom                      |
| **Chat history**    | 30 days                        | Custom                      |
| **SSO**             | No                             | Yes                         |
| **RBAC**            | No                             | Yes                         |
| **SOC2**            | No                             | Yes                         |
| **HIPAA**           | Add-on: $1,000/mo              | Included                    |
| **Infra SLA**       | No                             | 99.99%                      |
| **Support SLA**     | No                             | Custom                      |
| **Named engineer**  | No                             | Yes                         |
| **Account manager** | No                             | Yes                         |
| **Support channel** | Community Discord + Email      | Private Slack + Email       |

**Enterprise minimum:** 400,000 minutes/year (~33K min/mo).

**Legacy Startup/Agency plans:** Grandfathered users keep same terms. Free minutes on those plans cover model AND hosting costs. Telephony provider fees and Chat features are NOT included even on legacy plans.

---

## 2. Complete Cost Breakdown Formula

**Total cost per minute = Vapi Hosting + Transport + STT + LLM + TTS**

Each component is billed separately. There is no single "per minute" rate -- it depends entirely on provider choices.

### 2a. Vapi Hosting Cost (Platform Fee)

| Channel     | Cost           |
| ----------- | -------------- |
| Voice calls | **$0.05/min**  |
| SMS/Chat    | **$0.005/msg** |

This is Vapi's margin. It applies to ALL calls regardless of BYOK status. It covers infrastructure, orchestration, features, and support.

**Key fact:** You ALWAYS pay $0.05/min hosting even with BYOK. This is non-negotiable on the self-serve plan.

### 2b. Transport (Telephony) Costs

Charged by provider, NOT by Vapi. These are passthrough costs:

| Provider                 | Cost/min         |
| ------------------------ | ---------------- |
| **Vapi Telephony / SIP** | **$0.00 (FREE)** |
| **Vapi WebSockets**      | **$0.00 (FREE)** |
| **Daily WebRTC**         | **$0.00 (FREE)** |
| Twilio Inbound           | $0.008/min       |
| Twilio Outbound          | $0.014/min       |
| Vonage                   | $0.00814/min     |
| Telnyx                   | $0.0055/min      |

**Cost optimization:** Use Vapi's built-in telephony (free) instead of Twilio/Vonage/Telnyx to save $0.005-0.014/min. Custom SIP is also supported on PAYG plan.

### 2c. Speech-to-Text (STT) Costs

| Provider                      | Cost/min                           |
| ----------------------------- | ---------------------------------- |
| **Google**                    | **$0.000631/min** (cheapest)       |
| Assembly AI                   | $0.0025/min                        |
| OpenAI GPT-4o Mini Transcribe | $0.003/min                         |
| OpenAI GPT-4o Transcribe      | $0.006/min                         |
| ElevenLabs                    | $0.00667/min                       |
| **Deepgram**                  | **$0.01/min** (best quality/price) |
| Talkscriber                   | $0.011/min                         |
| Gladia                        | $0.0126/min                        |
| Azure                         | $0.017/min                         |
| Speechmatics                  | $0.01733/min                       |

### 2d. Large Language Model (LLM) Costs

Priced per 1M tokens (blended input/output shown from calculator):

| Provider / Model              | Cost/1M tokens                            |
| ----------------------------- | ----------------------------------------- |
| **Mistral Small**             | **$0.0001** (cheapest)                    |
| **Cerebras Llama 3.1 8B**     | **$0.0001**                               |
| OpenRouter Default            | $0.0005                                   |
| DeepInfra Default             | $0.0007                                   |
| Together AI Default           | $0.0009                                   |
| Groq Llama 3.1 8B             | $0.001                                    |
| Anyscale Default              | $0.001                                    |
| Perplexity Default            | $0.001                                    |
| Mistral Large                 | $0.002                                    |
| **GPT-4.1 Mini**              | **$0.01** (best mainstream quality/price) |
| GPT-4.1 Nano                  | $0.01                                     |
| GPT-4o Mini                   | $0.01                                     |
| Inflection 3 Pi               | $0.01                                     |
| DeepSeek V3                   | $0.01                                     |
| Groq Mixtral 8x7B             | $0.01                                     |
| DeepSeek R1                   | $0.02                                     |
| Groq Llama-3.3 70B            | $0.02                                     |
| Cerebras Llama 3.3 70B        | $0.02                                     |
| O3 Mini                       | $0.03                                     |
| O4 Mini                       | $0.04                                     |
| **GPT-4.1**                   | **$0.06**                                 |
| Grok 2 / Grok 3               | $0.06                                     |
| GPT-4o                        | $0.07                                     |
| Anthropic (all Claude models) | $0.09                                     |
| Google (all Gemini models)    | $0.09                                     |
| ChatGPT-4o Latest             | $0.14                                     |
| Grok Beta                     | $0.14                                     |
| O3                            | $0.28                                     |
| GPT-4o Mini Realtime          | $0.28                                     |
| O1 Preview                    | $0.43                                     |
| GPT-4o Realtime               | $1.14                                     |
| GPT-4.5 Preview               | $2.12                                     |

**Note on token usage per call minute:** A typical 1-minute voice call generates ~1,000-2,000 prompt tokens and ~200-500 completion tokens. With a 1,000 token system prompt, expect ~2,000-3,000 total tokens per minute. At GPT-4.1 Mini ($0.01/1M tokens), that is roughly $0.00002-0.00003/min for LLM -- effectively negligible.

### 2e. Text-to-Speech (TTS) Costs

| Provider            | Cost/min                  |
| ------------------- | ------------------------- |
| **Inworld**         | **$0.002/min** (cheapest) |
| **Neuphonic**       | **$0.01/min**             |
| Deepgram            | $0.0108/min               |
| Azure               | $0.0108/min               |
| OpenAI              | $0.0108/min               |
| Rime AI             | $0.0108/min               |
| Smallest AI         | $0.02/min                 |
| **Vapi (built-in)** | **$0.0216/min**           |
| **Cartesia**        | **$0.0216/min**           |
| ElevenLabs          | $0.036/min                |
| LMNT                | $0.0576/min               |
| Hume                | $0.06/min                 |
| PlayHT              | $0.0648/min               |
| Tavus (video)       | $0.24/min                 |

---

## 3. BYOK (Bring Your Own Keys)

**How it works:** You provide your own API keys for STT, LLM, and TTS providers. Vapi routes requests through your keys instead of their managed accounts.

**What you save:** Model provider costs through Vapi are eliminated. You pay the providers directly (potentially at rates you've negotiated).

**What you still pay:** The $0.05/min Vapi Hosting Cost still applies. Transport costs still apply if using third-party telephony.

**When BYOK makes sense:**

- You have negotiated volume discounts with providers (e.g., OpenAI committed use)
- You want to use your existing provider credits
- You need specific model versions or configurations not available through Vapi's managed service
- You are at scale where even small per-token savings compound

**When BYOK does NOT help:**

- Vapi passes through provider costs "at cost" (their negotiated rates), so savings may be minimal unless you have better rates
- The $0.05/min platform fee is unchanged regardless

---

## 4. Cost Scenarios: Cheapest to Premium

### Scenario A: ABSOLUTE CHEAPEST (still functional)

| Component    | Provider              | Cost/min        |
| ------------ | --------------------- | --------------- |
| Vapi Hosting | --                    | $0.0500         |
| Transport    | Vapi Telephony        | $0.0000         |
| STT          | Google                | $0.0006         |
| LLM          | Cerebras Llama 3.1 8B | ~$0.0000        |
| TTS          | Inworld               | $0.0020         |
| **TOTAL**    |                       | **~$0.053/min** |

Quality: Functional but likely poor voice quality (Inworld TTS) and limited LLM capability.

### Scenario B: CHEAPEST THAT SOUNDS GREAT

| Component    | Provider       | Cost/min        |
| ------------ | -------------- | --------------- |
| Vapi Hosting | --             | $0.0500         |
| Transport    | Vapi Telephony | $0.0000         |
| STT          | Deepgram       | $0.0100         |
| LLM          | GPT-4.1 Mini   | ~$0.0000        |
| TTS          | Deepgram       | $0.0108         |
| **TOTAL**    |                | **~$0.071/min** |

Quality: Good STT accuracy, strong LLM, decent TTS. Best bang for buck.

### Scenario C: HIGH QUALITY (recommended)

| Component    | Provider       | Cost/min        |
| ------------ | -------------- | --------------- |
| Vapi Hosting | --             | $0.0500         |
| Transport    | Vapi Telephony | $0.0000         |
| STT          | Deepgram       | $0.0100         |
| LLM          | GPT-4.1 Mini   | ~$0.0000        |
| TTS          | Cartesia       | $0.0216         |
| **TOTAL**    |                | **~$0.082/min** |

Quality: Excellent across all dimensions. Cartesia TTS is top-tier for voice quality.

### Scenario D: PREMIUM

| Component    | Provider       | Cost/min        |
| ------------ | -------------- | --------------- |
| Vapi Hosting | --             | $0.0500         |
| Transport    | Vapi Telephony | $0.0000         |
| STT          | Deepgram       | $0.0100         |
| LLM          | GPT-4.1        | ~$0.0001        |
| TTS          | ElevenLabs     | $0.0360         |
| **TOTAL**    |                | **~$0.096/min** |

### Scenario E: WITH TWILIO (common setup)

| Component    | Provider       | Cost/min        |
| ------------ | -------------- | --------------- |
| Vapi Hosting | --             | $0.0500         |
| Transport    | Twilio Inbound | $0.0080         |
| STT          | Deepgram       | $0.0100         |
| LLM          | GPT-4.1 Mini   | ~$0.0000        |
| TTS          | Cartesia       | $0.0216         |
| **TOTAL**    |                | **~$0.090/min** |

---

## 5. Monthly Cost Estimates

Using Scenario C (high quality: Deepgram STT + GPT-4.1 Mini + Cartesia TTS + Vapi Telephony) at ~$0.082/min:

| Monthly Minutes | Monthly Cost | Cost/Call (3 min avg) |
| --------------- | ------------ | --------------------- |
| 100             | $8.20        | $0.25                 |
| 500             | $41.00       | $0.25                 |
| 1,000           | $82.00       | $0.25                 |
| 5,000           | $410.00      | $0.25                 |
| 10,000          | $820.00      | $0.25                 |
| 25,000          | $2,050.00    | $0.25                 |
| 50,000          | $4,100.00    | $0.25                 |
| 100,000         | $8,200.00    | $0.25                 |

**Add for concurrency beyond 10 lines:** $10/line/month.

---

## 6. Phone Number Costs

Vapi itself does NOT charge for phone numbers via their built-in telephony (Vapi Telephony/SIP is listed as free transport). Phone number costs depend on provider:

- **Vapi-issued numbers:** Included with Vapi Telephony (no separate charge visible on pricing page). Cost is bundled into the free transport.
- **Twilio numbers:** ~$1-2/mo per number (paid directly to Twilio)
- **Vonage numbers:** ~$1-2/mo per number (paid directly to Vonage)
- **Telnyx numbers:** ~$1-2/mo per number (paid directly to Telnyx)
- **Custom SIP:** Bring your own (no Vapi charge for SIP transport)

---

## 7. Hidden Costs and Gotchas

### Confirmed costs not obvious from headline pricing:

1. **Concurrency lines:** 10 free, then **$10/line/month**. A busy business needing 50 concurrent calls pays $400/mo just for lines.

2. **HIPAA compliance:** **$1,000/month** add-on for zero data retention mode.

3. **Extended call history:** 14-day default. 60-day available as a dashboard add-on (price not published). Longer requires Enterprise plan.

4. **Chat history:** 30-day default on PAYG. Custom on Enterprise.

5. **No recordings included:** Call recordings are part of the call data stored during retention period. No separate recording storage cost published, but the 14-day retention means recordings disappear after 2 weeks unless you build your own storage.

6. **Analysis costs:** Post-call analysis (summaries, structured data extraction) appears as a separate line item in the API cost breakdown. Not prominently published.

7. **Knowledge base costs:** Not separately listed on Vapi's pricing page, but Retell charges $0.005/min for KB -- Vapi may have similar hidden costs.

8. **Telephony provider costs are EXTERNAL:** If using Twilio/Vonage/Telnyx, you pay them separately. Only Vapi Telephony and WebSockets are free.

9. **Mid-month prorating:** Add-on purchases mid-month are prorated. Cancellations give prorated credits (not refunds).

10. **No fixed monthly plans:** Purely usage-based. Cannot lock in a monthly rate. Credits can be preloaded and used over time.

---

## 8. Cost Tracking via API

Vapi provides detailed cost tracking through the **GET /call** endpoint:

### Per-call cost fields:

- `costBreakdown.transport` -- telephony cost
- `costBreakdown.stt` -- transcription cost
- `costBreakdown.llm` -- language model cost
- `costBreakdown.tts` -- text-to-speech cost
- `costBreakdown.vapi` -- platform fee
- `costBreakdown.total` -- total call cost in USD

### Itemized details:

- `costs[]` array with per-component breakdowns
- Token counts (prompt + completion) for LLM
- Character counts for TTS
- Minutes billed for STT and transport
- Analysis and voicemail detection costs

### Filtering for cost monitoring:

- Filter by `createdAtGt/Lt` for date ranges
- Filter by `assistantId` to track per-assistant costs
- Filter by `phoneNumberId` to track per-number costs
- Pagination with `limit` parameter (default 100)

### Recommended monitoring approach:

1. Poll GET /call with date range filters daily/hourly
2. Aggregate `costBreakdown.total` for spend tracking
3. Set up alerts when daily spend exceeds thresholds
4. Break down by assistant/phone number for cost attribution

---

## 9. Competitor Comparison: Vapi vs Retell vs Bland

### Retell AI (retellai.com/pricing -- verified 2026-03-22)

| Component              | Retell Cost          |
| ---------------------- | -------------------- |
| Platform/Infra         | $0.055/min           |
| TTS (Cartesia)         | $0.015/min           |
| TTS (ElevenLabs)       | $0.040/min           |
| LLM (GPT-4.1)          | $0.045/min           |
| LLM (Gemini 2.5 Flash) | $0.035/min           |
| Telephony (US)         | $0.015/min           |
| Phone numbers          | $2.00/mo             |
| Free credits           | $10                  |
| Concurrency            | 20 free, +$8/line/mo |
| Knowledge Base         | +$0.005/min          |
| Batch calls            | +$0.005/dial         |
| PII Removal            | +$0.01/min           |
| Branded Caller ID      | +$0.10/outbound call |
| SMS                    | $20.00/mo            |
| Verified numbers       | $10.00/mo            |

**Retell total (comparable config: Cartesia + GPT-4.1 + US telephony):**
$0.055 + $0.015 + $0.045 + $0.015 = **~$0.13/min**

### Bland AI (bland.ai)

**No public pricing.** Bland has moved to enterprise-only sales ("Book a demo" / "Talk to Us"). They no longer have a self-serve pricing page. Their positioning is enterprise call centers with proprietary models and self-hosted infrastructure.

Historical pricing (may be outdated): ~$0.09/min all-inclusive was previously advertised.

### Head-to-Head Comparison

| Feature                  | Vapi                                           | Retell          | Bland             |
| ------------------------ | ---------------------------------------------- | --------------- | ----------------- |
| **Cheapest good config** | **~$0.07/min**                                 | ~$0.13/min      | No public pricing |
| **Premium config**       | ~$0.10/min                                     | ~$0.15/min      | Enterprise only   |
| **Platform fee**         | $0.05/min                                      | $0.055/min      | Bundled           |
| **Free credits**         | $10                                            | $10             | None (enterprise) |
| **Free concurrency**     | 10 lines                                       | 20 lines        | N/A               |
| **Extra concurrency**    | $10/line/mo                                    | $8/line/mo      | Custom            |
| **Phone numbers**        | Free (Vapi Telephony)                          | $2/mo           | Custom            |
| **BYOK support**         | Yes (removes provider costs)                   | Unknown         | N/A               |
| **Free transport**       | Yes (Vapi Telephony, WebSockets, Daily WebRTC) | No ($0.015/min) | Bundled           |
| **HIPAA**                | $1,000/mo add-on                               | Custom          | Custom            |
| **Call history**         | 14 days                                        | Unknown         | Custom            |
| **SOC2**                 | Enterprise only                                | Unknown         | Yes               |
| **Self-serve**           | Yes                                            | Yes             | No                |
| **Min enterprise**       | 400K min/year                                  | Custom          | Contact sales     |

**Key insight:** Vapi is significantly cheaper than Retell primarily because of free transport and slightly lower platform fee. The $0.015/min telephony savings on Vapi vs Retell is meaningful at scale. For 10K min/mo, that is $150/mo savings on transport alone.

### Self-Hosted Comparison (e.g., Lumentra stack)

For reference, the Lumentra self-hosted stack costs approximately:

- SignalWire SIP: ~$0.005/min
- Deepgram STT: ~$0.005/min (volume pricing)
- GPT-4.1 Mini LLM: ~$0.0002/min
- Cartesia TTS: ~$0.01/min
- Server (Hetzner): ~$50/mo fixed
- **Total: ~$0.02-0.03/min + $50/mo fixed**

**Cost advantage of self-hosted vs Vapi:** At 10,000 min/mo, self-hosted costs ~$250/mo vs Vapi ~$820/mo. At 50,000 min/mo, self-hosted costs ~$1,100/mo vs Vapi ~$4,100/mo. The tradeoff is engineering time, maintenance burden, and reliability guarantees.

---

## 10. Volume Discounts and Enterprise Pricing

**Self-serve (PAYG):** No volume discounts. Pricing is fixed regardless of usage. However, Vapi passes through provider costs at "Vapi-negotiated rates" which may be better than retail.

**Enterprise plan:**

- Minimum: 400,000 minutes/year
- Volume-based pricing on hosting fee (likely $0.03-0.04/min at scale, based on industry norms)
- Model provider costs "included" (Vapi absorbs these)
- Custom concurrency, data retention, SLA
- Private Slack support, named engineer, account manager
- Annual contract required

**How to get volume pricing:**

1. Contact sales at vapi.ai/sales
2. They mention "plans that scale up and volume discounts for customers with larger call volumes"
3. BYOK with your own negotiated rates is the self-serve alternative to volume discounts

---

## 11. Free Tier and Trial Details

- **$10 free credits** on signup
- No credit card required to start
- 1 credit = 1 USD
- At the cheapest good config (~$0.07/min), $10 gets you ~143 minutes of calls
- At premium config (~$0.10/min), $10 gets you ~100 minutes
- No time limit on credit expiration mentioned
- Full platform access on free tier (all features, all providers)

---

## 12. Cost Optimization Strategies

### Immediate wins:

1. **Use Vapi Telephony (free)** instead of Twilio/Vonage/Telnyx. Saves $0.005-0.014/min.
2. **Use Deepgram TTS ($0.0108/min)** instead of Cartesia ($0.0216/min) if voice quality is acceptable. Saves $0.01/min.
3. **Use GPT-4.1 Mini** instead of GPT-4.1 or GPT-4o. LLM cost is already negligible but this ensures it stays that way.
4. **Use Assembly AI STT ($0.0025/min)** if accuracy is sufficient. Saves $0.0075/min vs Deepgram.

### Cheapest configuration that still sounds great:

- Vapi Telephony (free) + Deepgram STT ($0.01) + GPT-4.1 Mini (~$0) + Deepgram TTS ($0.0108)
- **Total: ~$0.071/min**
- Quality: Good across all dimensions. Deepgram TTS is not as expressive as Cartesia/ElevenLabs but is clear and natural.

### For the best quality at reasonable cost:

- Vapi Telephony (free) + Deepgram STT ($0.01) + GPT-4.1 Mini (~$0) + Cartesia TTS ($0.0216)
- **Total: ~$0.082/min**
- Quality: Excellent. Cartesia Sonic is one of the best TTS engines available.

### BYOK strategy:

- If you have OpenAI volume pricing, bring your own key for LLM
- If you have Deepgram volume pricing, bring your own key for STT
- The $0.05/min platform fee is the floor you cannot optimize away on Vapi

### At scale (50K+ min/mo):

- Contact Vapi sales for Enterprise pricing
- Enterprise includes model provider costs, so the effective rate could be significantly lower
- Consider self-hosting if engineering resources are available -- saves 60-75% at scale

---

## Summary

**Vapi is the cheapest mainstream voice AI platform at ~$0.07-0.08/min** with good quality. The $0.05/min platform fee is the core cost, with provider costs adding $0.02-0.05/min depending on choices. BYOK eliminates provider markup but not the platform fee. Enterprise pricing starts at 400K min/year with volume discounts. Free transport via Vapi Telephony is a significant competitive advantage over Retell ($0.015/min transport). Self-hosting remains 3-4x cheaper at scale but requires engineering investment.
