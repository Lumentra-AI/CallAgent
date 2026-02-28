# Lumentra - Known Issues and Next Steps

---

## Voice Quality

### Audio Latency on Long Calls

During longer conversations (3+ minutes), occasional audio latency can occur due to the real-time streaming pipeline having multiple async stages (STT -> LLM -> TTS). This is a well-known challenge in custom voice AI pipelines and affects all platforms in this space to varying degrees.

Significant work has been done to optimize this:

- State machine architecture for audio pipeline
- Greedy cancel and layered endpointing for turn-taking
- Sentence buffer for smoother TTS delivery
- Codec-safe silence padding
- Forced final-transcript turn end
- Speech-end fallback tuning
- Barge-in false positive prevention
- Dialog memory and anti-repetition shaping
- Provider timeouts and cleanup safeguards

Further optimization paths:

- Tuning LLM response length for voice (shorter responses = lower latency)
- Pre-buffering more TTS audio before starting playback
- Testing newer low-latency LLM models as they release
- Adjusting silence detection thresholds per industry/use case

### Turn-Taking

Turn-taking (deciding when the caller is done speaking vs just pausing) is inherently imperfect in all voice AI systems. The turn manager handles silence detection, barge-in, transcript accumulation, and turn completion. It works well for typical conversations but edge cases exist with fast talkers, long pauses, or noisy environments.

---

## Security Hardening (Pre-Production)

Before onboarding paying customers, these items should be addressed:

- Webhook signature verification should be fully implemented for production security
- WebSocket stream authentication should use token-based validation
- Sensitive fields (OAuth tokens, carrier credentials) should use the existing encryption helper consistently
- Debug endpoints should be removed or gated behind admin auth
- Rate limiting should be moved to a persistent store (Redis) for multi-instance deployments
- CORS on the chat route should be restricted to known widget domains

---

## Not Yet Implemented

- Automated test suite (CI checks type safety and builds, but no unit/integration/e2e tests)
- Billing/subscription enforcement (database field exists but no payment flow is active)
- Calendar integrations need per-tenant OAuth credential setup to be fully functional

---

## Architecture Notes

- The custom voice pipeline (Deepgram + LLM + Cartesia over SignalWire) was chosen specifically for cost efficiency at scale. Managed voice AI platforms like Vapi charge $0.15/min which is not viable for a B2B SaaS margin structure where customers make hundreds of calls per month.
- Both Vapi integration and the custom pipeline exist in the codebase. The custom pipeline is what is actively used and maintained.
- Database migrations have some overlapping numbers (two 007, two 011). The consolidated schema in `infrastructure/init-scripts/` is the cleanest reference.
