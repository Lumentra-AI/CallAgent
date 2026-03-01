# Lumentra - Known Issues and Next Steps

**Updated:** 2026-03-01

---

## Resolved Issues (March 1)

These were listed as issues previously but are now fixed and verified:

- **Tools work** -- check_availability, create_booking confirmed working in live calls
- **Transcript logging works** -- `session.history.messages()` (note: method, not property) extracts full conversation
- **Call duration works** -- `call_started_at` tracked in agent.py, accurate in DB
- **Agent connectivity** -- Fixed by switching to `network_mode: host` and `env_file: .env`
- **Empty env vars over SSH** -- Fixed by using `env_file:` directive instead of `${VAR}` interpolation in docker-compose

---

## Active Issues

### Backchannel / silence handling (MEDIUM)

"Umhmm", "uh huh", and other backchannel acknowledgments don't trigger an agent response. If the caller goes silent expecting the agent to continue or clarify, the agent stays silent too. Real customers won't know to speak up.

Possible fixes:

- Add a silence timeout in the agent that prompts "Are you still there?" after N seconds
- Tune `min_endpointing_delay` and `max_endpointing_delay` (currently 0.6s / 3.0s)
- Add backchannel detection in the system prompt telling the LLM to treat silence as "please continue"

### Groq rate limits on free tier (LOW -- only matters if switching back to Groq)

Groq free tier: 12,000 TPM for Llama 3.3 70B. System prompt is ~5,600 tokens. That means max 2 LLM calls per minute -- completely unusable for voice. Agent goes mute after the greeting + 1 response.

Fix: Upgrade to Groq Developer tier (free, needs credit card) for 10x higher limits. Or stay on OpenAI gpt-4.1-mini which has no practical rate limits.

### SIP REFER transfer untested (MEDIUM)

`transfer_to_human` tool uses LiveKit SIP REFER to transfer calls to the escalation phone number. Code is deployed but never tested with a real escalation number. Needs a real number configured in the tenant's `escalation_phone` field.

### SignalWire IPs are dynamic (HIGH -- can break calls)

Firewall rules restrict SIP (5060) and RTP (10000-20000) to SignalWire IPs resolved from `dig sip.signalwire.com`. If SignalWire rotates IPs, calls will stop connecting silently.

Fix when calls stop:

```bash
dig sip.signalwire.com  # get current IPs
# Update both Hetzner cloud firewall and UFW on server
```

### Coolify API IP may change (MEDIUM)

Agent uses `INTERNAL_API_URL=http://10.0.1.5:3100` (Coolify docker network IP). If Coolify redeploys the API on a different network, agent tool calls will fail silently.

Check with: `docker inspect <coolify-api-container> | grep IPAddress`

### `failed to fetch server settings: http status: 404` on agent startup (LOW)

Appears every time the agent starts. It's a LiveKit Cloud endpoint that doesn't exist on self-hosted. Harmless but noisy in logs.

### First call TTFT is slow (~1.1s) (LOW)

First LLM call on a new conversation has no prompt cache, so TTFT is ~1.1s. Subsequent calls in the same conversation hit cache and are ~0.4-0.7s. This is acceptable but noticeable on the greeting.

---

## Not Yet Implemented

- Automated test suite (CI checks types and builds, but no unit/integration/e2e tests)
- Billing/subscription enforcement (database field exists but no payment flow)
- Calendar integrations need per-tenant OAuth credential setup
- Outbound calling (only inbound calls work)
- Multi-language voice (STT is set to `language="multi"` but TTS voice and system prompt are English only)

---

## Security (Pre-Production)

Before onboarding paying customers:

- Rate limiting should use a persistent store (Redis) for multi-instance deployments
- CORS on the chat route should be restricted to known widget domains
- Debug endpoints should be removed or gated behind admin auth
- Sensitive fields should use the existing encryption helper consistently
