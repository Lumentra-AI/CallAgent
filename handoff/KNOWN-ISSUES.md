# Lumentra - Known Issues and Next Steps

---

## LiveKit Agent Issues (2026-02-28)

### Tools need live call verification (HIGH PRIORITY)

The `context.session.current_agent` and `context.session.room_io.room.name` fixes are deployed but need verification with a live call. Call +19458001233 and ask about availability to confirm tools work.

### Transcript logging needs verification

`call_logger.py` uses `session.history.messages` (livekit-agents v1.4+). Deployed but needs live call verification.

### Call duration needs verification

`agent.py` tracks `call_started_at` and passes it to `log_call()`. Deployed but needs live call verification.

### SIP REFER transfer untested

`transfer_to_human` tool now uses LiveKit SIP REFER to transfer calls to the escalation phone. Needs testing with a real escalation phone number configured.

### Coolify API IP may change

The agent uses `INTERNAL_API_URL` env var (currently `http://api:3100` via docker-compose service name). If Coolify redeploys the API on a different network, agent-to-API calls may fail. Check with `docker inspect` if tools start failing.

### SignalWire IPs are dynamic

Firewall rules restrict SIP (5060) and RTP (10000-20000) to SignalWire IPs resolved from `dig sip.signalwire.com`. If SignalWire rotates IPs, calls will stop connecting. Need to re-resolve and update both Hetzner cloud firewall and UFW.

### `failed to fetch server settings: http status: 404`

Appears on every agent startup. This is a LiveKit Cloud endpoint that doesn't exist on self-hosted. Harmless but noisy.

---

## Security Hardening (Pre-Production)

Before onboarding paying customers:

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

- Voice pipeline: LiveKit Agents (Python) with Deepgram STT, OpenAI LLM, Cartesia TTS
- Telephony: SignalWire provides phone numbers and SIP trunking to LiveKit SIP bridge
- The old custom pipeline code has been removed from the codebase
- Database migrations have some overlapping numbers (two 007, two 011). The consolidated schema in `infrastructure/init-scripts/` is the cleanest reference.
