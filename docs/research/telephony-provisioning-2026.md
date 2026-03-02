# Telephony Provisioning for AI Voice Agents (March 2026)

Research covering phone provisioning, call routing, abuse prevention, and onboarding businesses with no existing phone system.

## Key Findings

### No OSS project handles end-to-end phone provisioning for AI agents

Phone number provisioning is universally treated as an external concern. Every project either tells you to buy a Twilio/SignalWire number and configure webhooks, or wraps a provider's API without abstracting provisioning itself.

**Closest alternatives:**

- **jambonz** (~90 stars) -- full open-source CPaaS with multi-tenant number management, LCR routing, carrier failover. Built by drachtio creator. Overkill complexity for SaaS platforms.
- **LiveKit Phone Numbers** -- first-party number purchase via cloud dashboard/CLI. US only, inbound only, cloud-only (not self-hostable).
- **SignalWire Agents SDK** (41 stars) -- supports multi-tenant per-request customization, but locked to SignalWire carrier.

### Voice agent frameworks (for reference)

| Project        | Stars | Telephony                         | Multi-Tenant |
| -------------- | ----- | --------------------------------- | ------------ |
| Pipecat        | 10.5k | BYO Twilio/Vonage/Telnyx          | No           |
| LiveKit Agents | 9.5k  | BYO SIP trunk or LK Phone Numbers | No           |
| TEN Framework  | 10.1k | BYO Twilio extension              | No           |
| Bolna          | 587   | Twilio/Plivo                      | No           |
| Dograh         | 193   | BYO Twilio/Vonage                 | No           |
| AVA (Asterisk) | 788   | Existing PBX (no provisioning)    | Partial      |
| Vocode         | 3.7k  | STALE (last release June 2024)    | No           |

### Call duration limits & abuse prevention

**Five enforcement layers (use multiple):**

1. **SIP-level (RFC 4028):** Session-Expires header, 30-min default sessions, transparent re-INVITE.
2. **Telephony provider-level:** Twilio defaults 4 hours (trial: 10 min). Bandwidth: 5 CPS, 100 active sessions. SignalWire: no documented limits.
3. **Platform/agent-level:** Where real enforcement happens. Vapi: `maxDurationSeconds`. Retell: `max_call_duration_ms` (default 1 hour). Bland: `max_duration` in minutes. All do abrupt disconnect.
4. **Billing-level:** Concurrency limits (Vapi: 10, Retell: 20, Bland: 10 free). Daily caps (Bland: 100/day free). Monthly minute pools with overage rates.
5. **Multi-tenant governance:** Token bucket per tenant, concurrent call counters, per-tier minute allocation.

**LiveKit `max_call_duration` is buggy** -- open GitHub issue #353 (Jan 2026) reports it sometimes controls "max ring duration" instead of total call duration. Community workaround: external asyncio timer with `DeleteRoomRequest`.

**No platform does graceful pre-disconnect warnings.** All do abrupt hangup. This is a differentiation opportunity.

### Carrier comparison for number provisioning

| Feature                | SignalWire  | Telnyx       | Twilio    | Plivo    |
| ---------------------- | ----------- | ------------ | --------- | -------- |
| DID monthly (US local) | $0.20       | ~$1.00       | $1.00     | $0.50    |
| Inbound voice/min      | $0.0036     | $0.0055      | $0.0085   | ~$0.0065 |
| Infrastructure         | Own network | Own backbone | Reseller  | Reseller |
| At 1000 tenants        | ~$200/mo    | ~$1000/mo    | ~$1000/mo | ~$500/mo |

**SignalWire is the clear winner** for Lumentra -- already integrated, lowest cost, own network.

### Business onboarding paths (no existing phone system)

Five viable approaches, ordered by simplicity:

1. **Platform-provisioned number** -- Buy DID via API, assign to tenant, connect to SIP trunk. Fastest path.
2. **Call forwarding** -- Business keeps carrier, forwards busy/unanswered to platform number. Zero downtime.
3. **Number porting** -- Transfer ownership to platform carrier. 5-15 business days. Provision temp number immediately.
4. **BYOD SIP trunk** -- Business connects their PBX. Enterprise use case.
5. **WebRTC widget** -- Browser-based, no PSTN needed. LiveKit supports both SIP and WebRTC in same room.

### Regulatory requirements

- **STIR/SHAKEN:** Handled by carrier (SignalWire). No Lumentra-side certs needed.
- **A2P 10DLC:** Only if adding SMS. Brand registration $4.50, vetting $41.50.
- **AI Disclosure:** EU AI Act Article 50 requires it. Multiple US states have pending legislation. Best practice: always disclose.

## What We Built

Based on this research, implemented:

1. **All 4 phone setup options working** in the setup wizard (new number, forward, port, SIP trunk)
2. **Conditional forwarding instructions** (busy/no-answer, not unconditional \*72) with carrier-specific codes
3. **15-minute call duration limit** with graceful escalation:
   - 2 min before limit: agent nudged to wrap up
   - 30 sec before limit: agent offers transfer to human
   - At limit: SIP REFER transfer to escalation phone (or end call if no escalation configured)
4. **SignalWire API integration** for programmatic number provisioning via `POST /api/phone/provision`

## Sources

- jambonz: https://github.com/jambonz
- LiveKit Agents: https://github.com/livekit/agents
- LiveKit Phone Numbers: https://docs.livekit.io/telephony/start/phone-numbers/
- Pipecat: https://github.com/pipecat-ai/pipecat
- Bolna: https://github.com/bolna-ai/bolna
- Dograh: https://github.com/dograh-hq/dograh
- AVA Asterisk: https://github.com/hkjarral/Asterisk-AI-Voice-Agent
- SignalWire Agents: https://github.com/signalwire/signalwire-agents
- LiveKit max_call_duration issue: https://github.com/livekit/sip/issues/353
- Twilio Phone Number API: https://www.twilio.com/docs/phone-numbers/api
- Beside (competitor): https://beside.so
- Upfirst (competitor): https://upfirst.ai
