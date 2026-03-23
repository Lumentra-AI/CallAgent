# Vapi.ai Gotchas, Limitations & Known Issues (2026)

**Research date:** 2026-03-22
**Sources:** 25+ searches across Trustpilot, Vapi community forums, status page, GitHub issues, comparison sites, review sites, official docs
**Purpose:** Due diligence before committing to Vapi as a platform dependency

---

## Executive Summary

Vapi is the most popular voice AI orchestration platform in 2026, but comes with significant gotchas that are not obvious from marketing materials. The biggest risks are: (1) true costs are 4-6x the advertised $0.05/min, (2) platform updates break production agents without warning, (3) webhook reliability is inconsistent, (4) no self-service account cancellation, (5) data retention as short as 14 days on pay-as-you-go, and (6) Trustpilot rating of 2.3/5 with 83% one-star reviews. For a multi-tenant SaaS like Lumentra, the multi-vendor billing complexity and lack of native multi-tenant support are particularly concerning.

---

## 1. Billing Surprises & Hidden Costs

### The $0.05/min Lie

Vapi advertises $0.05/min as their base rate. This is **only the orchestration fee**. Real costs:

| Component                   | Cost/min           |
| --------------------------- | ------------------ |
| Vapi orchestration          | $0.05              |
| STT (Deepgram/AssemblyAI)   | $0.01-0.015        |
| LLM (GPT-4o-mini to GPT-4o) | $0.02-0.20         |
| TTS (ElevenLabs/Cartesia)   | $0.02-0.04         |
| Telephony (Twilio/Vonage)   | $0.01-0.02         |
| **Realistic total**         | **$0.13-0.35/min** |

- For 10,000 minutes/month, expect ~$2,900/month, not the $500 you'd estimate from the headline rate
- Enterprise deployments typically run $3,000-6,000/month for moderate usage
- Annual budget for serious deployment: $40,000-70,000
- You get 4-6 separate invoices from different vendors, not one bill

### Concurrency Charges

- Default: 10 concurrent call slots
- Additional lines: $10/line/month
- At 50 concurrent lines, that is an extra $400/month just for capacity

### HIPAA Compliance

- $1,000/month add-on (Retell and Bland include this for free)
- Enabling HIPAA disables call log storage, recording review, and transcript access
- Only `/call` endpoint can process PHI -- cannot put PHI in assistant prompts or phone number labels
- Limited provider options when HIPAA enabled (must use Azure OpenAI, Deepgram, etc.)

### Billing Gotchas Reported by Users

- Duplicate analysis charges appearing on invoices
- Extra voice costs despite using own ElevenLabs key
- Vapi fees appearing on free plan accounts
- UK users pay double -- must import Twilio number AND pay Vapi, since Vapi does not sell UK numbers directly
- Refund delays reported: weeks of waiting after promised refunds
- One Trustpilot reviewer claims "$1000 stolen" with refund promised but never delivered
- Another claims "$50k in damages" from downtime bugs

**Source:** [CallBotics pricing breakdown](https://callbotics.ai/blog/vapi-pricing), [Ringg hidden costs](https://www.ringg.ai/blogs/vapi-ai-review), [Trustpilot reviews](https://www.trustpilot.com/review/vapi.ai)

---

## 2. Reliability & Uptime

### Status Page Data (Last 90 Days as of 2026-03-22)

- **63 incidents total**: 39 major outages + 24 minor incidents
- Median incident duration: 20 minutes
- Most recent outage: March 19, 2026 ("Elevated errors in daily and weekly channels")

### Major Incidents (Q1 2026)

| Date                 | Duration                           | Description                                                   |
| -------------------- | ---------------------------------- | ------------------------------------------------------------- |
| Jan 19 - Feb 3, 2026 | ~15 days                           | Google Gemini provider extended capacity/rate-limiting issues |
| Feb 11-12, 2026      | ~8 hours                           | Authentication service disruption                             |
| Feb 22-24, 2026      | Multiple events totaling ~10 hours | Degraded call success rates, ~211 calls dropped in one event  |
| Feb 24-25, 2026      | ~13 hours                          | Authentication issues (second round)                          |
| Mar 9-19, 2026       | ~18+ hours intermittent            | OpenAI provider degradation                                   |

### The Real Risk: Silent Breaking Changes

The most dangerous reliability issue is not outages -- it is **platform updates that break working agents without warning**. Multiple users on the community forum and Trustpilot report:

- "Agent quit working -- no changes on our end" (June 2025, documented thread)
- "Tools stopped working!" -- custom tools suddenly returned "tool response no result returned" with no tool calls in logs
- "Tool calls suddenly not working -- they worked fine yesterday"
- June 2025: Breaking change to Success Evaluation field type (string|null changed to string|number|boolean|null) broke all customers with strict type validation for ~30 hours
- Users report being told bugs would be fixed "tomorrow...then tomorrow...then tomorrow"

**Source:** [Vapi Status Page](https://status.vapi.ai/), [SaaSHub status](https://www.saashub.com/vapi-status), Vapi community forums

---

## 3. Latency

### Baseline Performance

- Typical: 500-800ms end-to-end (acceptable for conversation)
- Retell: ~600ms (faster)
- Vapi: ~700ms (middle)
- Bland: ~800ms (slower)
- Achievable optimized: ~465ms with careful tuning

### Latency Traps

1. **Turn detection defaults add 1.5+ seconds**: Vapi's default turn detection includes wait times that can add 1.5s to response time. Since STT has formatting disabled, the system defaults to a 1.5s "no punctuation" delay
2. **Network routing**: Must host webhook server close to us-west-2 (Vapi's region). If your server is in EU or Asia, add 100-300ms
3. **LLM choice**: Using GPT-4o instead of GPT-4o-mini can add 500ms+. Semantic caching can answer in ~50ms vs seconds for LLM
4. **TTS cold start**: First utterance from TTS is slower. Warming voices at session start saves 100-200ms
5. **Legacy PBX chains**: If going through existing phone systems, adds 200-800ms
6. **Under load, quality degrades**: "When concurrency is pushed, the phone agent missed small cues, short pauses became long pauses, and conversations didn't feel natural anymore"

### Optimization Checklist (from AssemblyAI + Vapi blogs)

- Use streaming STT (Deepgram/AssemblyAI Universal-Streaming at ~90ms)
- Reduce turn detection wait times
- Use WebRTC over TCP
- Implement audio caching for common phrases
- Use fastest LLM that meets quality bar
- Host everything in us-west-2

**Source:** [AssemblyAI optimization guide](https://www.assemblyai.com/blog/how-to-build-lowest-latency-voice-agent-vapi), [Vapi latency blog](https://vapi.ai/blog/speech-latency), [VoiceAIWrapper optimization](https://voiceaiwrapper.com/insights/vapi-voice-ai-optimization-performance-guide-voiceaiwrapper)

---

## 4. Webhook Reliability

### Known Issues

1. **Intermittent missing end-call webhooks**: Known bug where end-of-call-report webhooks are sometimes not generated even when calls end normally
2. **Incomplete call status coverage**: Webhooks only fire for completed calls by default. Busy, failed, no-answer outcomes may not trigger events
3. **API-created calls may not fire webhooks**: Assistant-level webhooks may not work for API-created calls. May need phone number-level webhook configuration
4. **No retry mechanism documented**: If your server is down when Vapi fires a webhook, the event appears to be lost

### Timeout Constraints

- **7.5-second hard limit** on assistant-request webhook response time (telephony provider enforces 15s, Vapi uses ~7.5s for setup)
- Tool call timeouts are configurable via `timeoutSeconds` (e.g., 45s for slow endpoints)
- If response format is wrong, assistant goes silent then eventually times out

### Workarounds

- Configure ONLY "end-of-call-report" and "status-update" in serverMessages (deselect all others) to get events for non-completed calls
- Set webhook at phone number level, not assistant level, for API-created calls
- Always poll the Vapi API as a fallback -- do not rely solely on webhooks for critical data
- Host webhook server in us-west-2 region

**Source:** [Vapi server events docs](https://docs.vapi.ai/server-url/events), Vapi community forums (multiple threads)

---

## 5. Concurrent Call Limits & Rate Limits

### Default Limits

- **10 concurrent call slots** per account (both inbound and outbound share the pool)
- When full, new calls wait in queue (no error, just delay)
- Additional lines: $10/line/month
- No documented API rate limits beyond concurrency

### Monitoring

- POST /call response includes `subscriptionLimits` object with `concurrencyBlocked`, `concurrencyLimit`, `remainingConcurrentCalls`
- Analytics API has subscription table with concurrency column for historical data

### Scaling Gotchas

- Must proactively purchase lines BEFORE traffic surges
- Outbound campaigns hit limits fast -- batch in groups of 50-100
- Organizations over 50,000 minutes/month should negotiate custom plans
- Changes apply immediately (no provisioning delay)

**Source:** [Vapi concurrency docs](https://docs.vapi.ai/calls/call-concurrency), Vapi community forums

---

## 6. Voice Quality Issues

### Background Noise & Echo

- Background speech (TV, other people) can severely impact conversation quality
- Vapi offers Smart Denoising (Krisp-based) and Fourier denoising
- Background voice filtering claims 73% reduction in call center environments
- Configuration required via `backgroundSpeechDenoisingPlan` on assistant

### Speech Accuracy

- Accuracy depends entirely on chosen STT provider (Vapi has no native STT)
- Cheaper/faster STT models may mishear domain-specific terms (HVAC, medical terms, etc.)
- Confidence threshold default (0.4) can filter out valid transcripts -- may need to lower to 0.2

### Under Load

- Voice sounds robotic when concurrency is pushed
- Small cues get missed, short pauses become long pauses
- Conversations feel less natural at scale

### Transcript Issues

- Voice input sometimes not transcribed at all despite clear audio in recording
- Silence timeouts and missing transcripts reported on calls where both parties spoke
- Transcripts may not be available immediately after call -- need 60-second delay + API fetch
- Adding a closing phrase before ending call helps ensure last utterance is captured

**Source:** [Vapi denoising blog](https://vapi.ai/blog/revolutionize-voice-clarity-with-vapi-s-ai-driven-noise-reduction-tools), [Vapi speech config docs](https://docs.vapi.ai/customization/speech-configuration), Vapi community forums

---

## 7. Tool/Function Call Limitations

### Timeout

- Configurable via `timeoutSeconds` on the tool definition
- Default is relatively short -- if your API takes 15-20s, set timeout to 45s
- If response format is wrong (missing `toolCallId`, wrong JSON structure), assistant goes silent

### Known Bugs

- Custom tools randomly stop working with "tool response no result returned"
- No tool calls appearing in logs despite assistant saying it is "fetching data"
- Converting from Squads to single assistant has resolved tool calling issues for some users
- GoHighLevel integrations lose auth silently -- need to reauthorize periodically

### Limitations

- No built-in limit on tool calls per call (must enforce in server logic)
- No async tool pattern -- tool must return synchronously within timeout
- Complex multi-step workflows require custom orchestration on your server
- Squads (multi-agent) and workflow builder are separate features that do not interoperate well

**Source:** [Vapi custom tools docs](https://docs.vapi.ai/tools/custom-tools), Vapi community forums (multiple threads)

---

## 8. Multi-Tenant Gotchas

### No Native Multi-Tenancy

- Vapi's model is "similar to Stripe" -- your application handles tenant isolation
- No built-in concept of sub-accounts, workspaces, or tenant-level billing
- No API for cloning/templating assistants across tenants
- No per-tenant analytics or reporting

### What You Must Build Yourself

- Sub-account management and isolation
- Per-tenant billing and usage tracking
- Assistant cloning from base templates
- Tenant-specific webhook routing
- Branded/white-label dashboard
- CRM and calendar integrations per tenant

### Third-Party Solutions

- VapiWrap and Voicerr AI offer white-label wrappers, but add another vendor dependency
- VoiceAIWrapper provides agency-focused multi-tenant dashboard

### Agency/Reseller Challenges

- No automated billing integration for reselling
- Vapi branding cannot be fully removed on non-enterprise plans
- Client-facing reporting is developer-only (no manager-friendly dashboard)

**Source:** [Vapi FAQ](https://docs.vapi.ai/faq), [VapiWrap](https://www.vapiwrap.com/), Vapi community forums

---

## 9. Data Retention

### Retention Periods (as of August 2025)

| Plan          | Call History | Chat History |
| ------------- | ------------ | ------------ |
| Pay-as-you-go | 14 days      | 30 days      |
| Enterprise    | Configurable | Configurable |

### Gotchas

- Retention policy was added mid-2025 with minimal announcement
- Not clearly documented in ToS initially -- users discovered it when data disappeared
- "Call log data disappearing" is a documented community complaint
- If you need call recordings or transcripts beyond 14 days, you MUST store them yourself
- HIPAA mode disables all Vapi-side storage entirely

**Source:** [Vapi community data retention thread](https://vapi.ai/community/m/1374041372260175993), [Vapi call recording docs](https://docs.vapi.ai/assistants/call-recording)

---

## 10. Geographic & Regulatory Limitations

### Phone Numbers

- Free Vapi numbers: US only, max 10 per account
- International numbers: Must import from Twilio/Vonage (extra cost + complexity)
- UK users effectively pay double (Twilio + Vapi)
- No number porting TO Vapi documented

### Compliance

- HIPAA: $1,000/month add-on, disables call logs/transcripts
- SOC 2 Type II: Certified
- GDPR: Claimed compliant, but:
  - DPA only available to enterprise customers
  - No EU servers
  - Not certified under EU-US Data Privacy Framework
  - Non-enterprise users have no access to signed DPA
- PCI: Available but with restrictions

### Data Residency

- All processing in US (us-west-2 region)
- No EU or other regional hosting options on standard plans
- Enterprise may negotiate on-premise deployment

**Source:** [Vapi HIPAA docs](https://docs.vapi.ai/security-and-privacy/hipaa), [Vapi FAQ](https://docs.vapi.ai/faq), [Vapi phone calling docs](https://docs.vapi.ai/phone-calling)

---

## 11. Account Management & Support

### Trustpilot Rating: 2.3/5 (83% one-star)

Notable reviews:

- "Support is non-existent and documentation is extremely poor"
- "No way to remove or cancel your account, no control to remove data or credit card information"
- "DTMF tones don't function, saving assistant modifications fails like 50% of the time"
- "Vapi has cost them $50k in damages from downtime"
- "Stolen over $1000 from me with a refund promised but have been waiting weeks"

### Cancellation Issues

- No self-service cancellation
- Must go through support (which is bot-driven)
- Cannot remove payment information independently
- Refund processing can take weeks

### Support Channels

- Email and Discord only
- Multi-day response times common
- No phone support
- No SLA on response times for non-enterprise

**Source:** [Trustpilot](https://www.trustpilot.com/review/vapi.ai), [Dialora reviews roundup](https://www.dialora.ai/blog/vapi-ai-reviews)

---

## 12. Developer Experience & Migration Challenges

### What Works Well

- REST API is comprehensive and well-designed
- WebSocket support for real-time events
- Provider flexibility (bring your own STT/TTS/LLM keys)
- Dashboard for quick prototyping
- Client SDKs (web, iOS, Android, Python, Flutter, React Native)

### What Does Not

- "Developer-first" means non-developers cannot operate it at all
- No simple dashboard for office managers to review calls or manage leads
- No omnichannel (voice only -- no SMS, email, chat from same platform)
- No native calendar, CRM, or payment integrations
- No industry-specific semantics (service windows, job tickets, dispatch)
- Documentation quality frequently criticized

### Vendor Lock-In Risk

- Vapi-specific assistant configuration format (not portable)
- Webhook response format is Vapi-proprietary
- Tool definitions use Vapi schema (similar to but not identical to OpenAI function calling)
- Call recordings stored on Vapi infrastructure
- Migration away requires rebuilding: prompt engineering, tool integrations, telephony routing, analytics

### Squad (Multi-Agent) Issues

- Cannot reuse existing assistants in workflow builder -- must recreate from scratch
- Voice selection broken in squad UI -- must use JSON with voice IDs
- Squads and workflow builder do not interoperate
- Tool calling bugs specific to squad configurations

### Client SDK Bugs (GitHub)

- `vapi.stop()` does not work while call is still connecting (race condition)
- `vapi.send()` also fails in some states
- Browser compatibility issues (Brave on Windows)
- Multiple open issues dating back to June 2025 unresolved

**Source:** [GitHub VapiAI/client-sdk-web issues](https://github.com/VapiAI/client-sdk-web/issues), [ServiceAgent review](https://serviceagent.ai/blogs/vapi-ai-review/), Vapi community forums

---

## 13. What People Wish They Knew Before Starting

Aggregated from reviews, community posts, and comparison articles:

1. **The $0.05/min is a lie.** Budget $0.20-0.35/min for realistic costs, or $0.13/min absolute minimum with cheapest providers.

2. **You need a developer on staff permanently.** Vapi agents break when the platform updates. There is no "set and forget."

3. **Store your own data.** Call logs disappear after 14 days. Webhooks can be missed. Always maintain your own database of calls, transcripts, and recordings.

4. **Test webhook reliability from day one.** Build polling fallbacks. Do not trust webhooks as sole source of truth for call outcomes.

5. **Multi-tenant is on you.** There is no sub-account system. You build all tenant isolation, billing, and management yourself.

6. **Cancellation is painful.** Test with a prepaid card or virtual card. Getting your account closed and payment info removed requires fighting through support.

7. **HIPAA costs real money and removes features.** $1,000/month and you lose call logs, transcript review, and recording access in the dashboard.

8. **International is second-class.** US-only free numbers. No EU servers. No DPA for non-enterprise. UK users pay double.

9. **Latency is tunable but not out of the box.** Default turn detection adds 1.5s. You must actively optimize STT, LLM, TTS, and turn detection settings.

10. **Support will not save you in a crisis.** Multi-day response times. No phone support. When production breaks at 2am, you are on your own.

11. **Squads (multi-agent) is half-baked.** Voice selection is broken in UI, cannot reuse existing assistants, tool calling has squad-specific bugs.

12. **The dashboard saves fail ~50% of the time** (per Trustpilot review). Always verify changes persisted.

---

## Comparison to Self-Hosted (Lumentra Current Stack)

| Dimension               | Vapi                       | Lumentra (Self-Hosted LiveKit) |
| ----------------------- | -------------------------- | ------------------------------ |
| Per-minute cost         | $0.13-0.35                 | ~$0.02-0.03                    |
| Concurrent call control | Pay per line ($10/mo each) | Unlimited (own infra)          |
| Data retention          | 14 days (PAYG)             | Unlimited (own DB)             |
| Multi-tenant            | Build yourself             | Built into platform            |
| HIPAA cost              | $1,000/month               | Self-managed (no add-on)       |
| Vendor lock-in          | High (proprietary format)  | Low (open protocols)           |
| Breaking changes        | Platform-controlled        | Self-controlled                |
| Latency optimization    | Limited knobs              | Full stack control             |
| Support                 | Email/Discord, multi-day   | Self (full control)            |
| EU compliance           | Enterprise-only DPA        | Self-managed                   |
| Setup effort            | Lower (orchestration done) | Higher (but already done)      |

---

## Bottom Line

Vapi is a good prototyping and MVP tool for teams without voice AI expertise. For a production multi-tenant SaaS like Lumentra that already has a working LiveKit-based pipeline:

**Reasons to avoid Vapi:**

- Cost is 5-15x higher per minute than current stack
- No native multi-tenant support (would need to rebuild what already exists)
- Platform updates break production agents (unacceptable for B2B SaaS)
- Data retention limits require building your own storage anyway
- Webhook unreliability requires building polling fallbacks anyway
- $1,000/month HIPAA tax
- Vendor lock-in with proprietary formats

**Reasons someone might choose Vapi:**

- Starting from zero with no voice AI expertise
- Need to prototype quickly (days, not weeks)
- Small scale (under 1,000 minutes/month where cost premium is manageable)
- Do not need multi-tenant, HIPAA, or EU compliance
- Have developer resources to handle ongoing maintenance from platform changes

---

## Sources

- [Vapi Status Page](https://status.vapi.ai/)
- [Vapi Trustpilot Reviews](https://www.trustpilot.com/review/vapi.ai)
- [Vapi Call Concurrency Docs](https://docs.vapi.ai/calls/call-concurrency)
- [Vapi HIPAA Docs](https://docs.vapi.ai/security-and-privacy/hipaa)
- [Vapi Server Events Docs](https://docs.vapi.ai/server-url/events)
- [Vapi Custom Tools Docs](https://docs.vapi.ai/tools/custom-tools)
- [Vapi Call Recording Docs](https://docs.vapi.ai/assistants/call-recording)
- [Vapi FAQ](https://docs.vapi.ai/faq)
- [Vapi Community: Agent quit working](https://vapi.ai/community/m/1385082061152456765)
- [Vapi Community: Tools stopped working](https://vapi.ai/community/m/1447786931264946328)
- [Vapi Community: Webhook missing events](https://vapi.ai/community/m/1422115496903311463)
- [Vapi Community: Webhook not sent for API calls](https://vapi.ai/community/m/1424999154794500167)
- [Vapi Community: Data retention policy](https://vapi.ai/community/m/1374041372260175993)
- [Vapi Community: Squad voice limitations](https://vapi.ai/community/m/1365276844449988618)
- [GitHub: VapiAI/client-sdk-web issues](https://github.com/VapiAI/client-sdk-web/issues)
- [CallBotics: Vapi Pricing 2026](https://callbotics.ai/blog/vapi-pricing)
- [Ringg: Vapi AI Review 2026](https://www.ringg.ai/blogs/vapi-ai-review)
- [ServiceAgent: Vapi AI Review](https://serviceagent.ai/blogs/vapi-ai-review/)
- [White Space Solutions: Bland vs Vapi vs Retell](https://www.whitespacesolutions.ai/content/bland-ai-vs-vapi-vs-retell-comparison)
- [AssemblyAI: Lowest Latency Vapi Agent](https://www.assemblyai.com/blog/how-to-build-lowest-latency-voice-agent-vapi)
- [Vapi: Speech Latency Solutions](https://vapi.ai/blog/speech-latency)
- [VoiceAIWrapper: Optimization Guide](https://voiceaiwrapper.com/insights/vapi-voice-ai-optimization-performance-guide-voiceaiwrapper)
- [Oreate AI: Mixed Reviews of Vapi](https://www.oreateai.com/blog/navigating-the-mixed-reviews-of-vapi-ai-what-users-are-saying/3504b1c6c47a367190022c2bd2d3a7e2)
- [Dialora: Vapi AI Reviews 2025](https://www.dialora.ai/blog/vapi-ai-reviews)
- [Retell: Vapi AI Review](https://www.retellai.com/blog/vapi-ai-review)
- [Lindy: Vapi AI Alternatives](https://www.lindy.ai/blog/vapi-ai-alternatives)
- [SaaSHub: Vapi Status](https://www.saashub.com/vapi-status)
- [VapiWrap: White-Label Platform](https://www.vapiwrap.com/)
- [Vapi Breaking Changes Incident](https://status.vapi.ai/incident/605961)
