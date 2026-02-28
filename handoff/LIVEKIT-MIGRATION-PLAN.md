# Migration Plan: Custom Voice Pipeline to LiveKit Agents (Self-Hosted)

## Context

Lumentra's custom voice pipeline (2300+ line TurnManager, manual Deepgram/Cartesia WebSocket management, SignalWire media streams) suffers from audio chop and latency issues on longer calls. LiveKit Agents replaces all this plumbing with a battle-tested framework (powers ChatGPT voice, 9.5k stars) that includes ML-based turn detection, WebRTC transport, and built-in barge-in handling -- at roughly the same per-minute cost ($0.032 vs $0.030).

**Decisions made:**

- Python SDK (most mature, 50+ plugins, v1.4)
- Self-hosted LiveKit on Hetzner (no cloud fees)
- LiveKit SIP with SignalWire as SIP trunk
- New service, parallel run with feature flag per tenant

---

## Architecture Change

```
BEFORE:  Phone -> SignalWire webhook -> lumentra-api (Node.js) -> WS media stream
         -> Deepgram STT -> TurnManager (2300 lines) -> LLM -> Cartesia TTS -> WS back

AFTER:   Phone -> SignalWire SIP trunk -> LiveKit SIP -> LiveKit Room
         -> Python Agent joins room -> Deepgram plugin -> EOU turn detector -> LLM -> Cartesia plugin
         -> WebRTC audio back -> SIP -> SignalWire -> caller
         -> Tool calls via REST to lumentra-api
```

**What gets replaced:** `services/voice/` (turn-manager, audio-pipeline-state, sentence-buffer, session-manager, conversation-state), `services/deepgram/transcriber.ts`, `services/cartesia/tts.ts`, `services/signalwire/media-stream.ts`, `routes/signalwire-stream.ts`

**What stays:** All database ops, CRM, dashboard, booking/availability logic, system prompt builder, tool execution functions, call logger -- exposed to Python agent via new internal REST endpoints

---

## Latency Improvement

| Factor                      | Current Pipeline               | LiveKit Agents               |
| --------------------------- | ------------------------------ | ---------------------------- |
| Turn detection              | ~500-800ms (silence threshold) | ~50-200ms (ML model)         |
| Transport (both directions) | ~200-400ms (TCP WebSocket)     | ~60-160ms (UDP WebRTC)       |
| TTS start                   | After full LLM sentence        | Preemptive (first few words) |
| Echo cancellation           | None (causes false triggers)   | WebRTC built-in              |
| **Total E2E latency**       | **~1.5s+**                     | **~600-800ms**               |

---

## Phase 1: Infrastructure (LiveKit Server + SIP + Redis)

### New files to create:

- `lumentra-agent/livekit/livekit.yaml` -- LiveKit server config (ports, Redis, API keys)
- `lumentra-agent/livekit/sip.yaml` -- SIP server config (SIP port 5060, RTP ports, Redis)
- `lumentra-agent/livekit/inbound-trunk.json` -- SignalWire inbound SIP trunk definition
- `lumentra-agent/livekit/outbound-trunk.json` -- SignalWire outbound trunk (for transfers)
- `lumentra-agent/livekit/dispatch-rule.json` -- Route inbound calls to agent

### Docker Compose additions (modify existing docker-compose.yml):

- `redis` service (redis:7-alpine, port 6379 internal)
- `livekit` service (livekit/livekit-server:v1.8, host networking, ports 7880/7881/50000-60000)
- `sip` service (livekit/sip:latest, host networking, ports 5060/10000-20000)

### Hetzner firewall:

- Open 5060/UDP+TCP (SIP), 7880/TCP (LiveKit API), 7881/TCP (WebRTC TCP), 10000-20000/UDP (RTP), 50000-60000/UDP (ICE)

### Verification:

- `lk room list` returns empty list (server running)
- `lk sip trunk list` shows configured trunks

---

## Phase 2: Python Agent Service

### New files to create:

```
lumentra-agent/
  agent.py              # Main: AgentServer + entrypoint + LumentraAgent class
  tools.py              # 5 @function_tool definitions calling lumentra-api REST
  tenant_config.py      # httpx client for GET /internal/tenants/by-phone/:phone
  call_logger.py        # httpx client for POST /internal/calls/log
  prompt_builder.py     # Minimal -- API returns full system_prompt in tenant config
  requirements.txt      # livekit-agents, plugins, httpx, python-dotenv
  Dockerfile            # python:3.12-slim, pip install, CMD python agent.py start
  .env.example          # LIVEKIT_URL, API keys, INTERNAL_API_KEY
```

### Agent core (~200 lines):

```python
class LumentraAgent(Agent):
    def __init__(self, tenant_config, caller_phone):
        super().__init__(
            instructions=tenant_config["system_prompt"],
            tools=[check_availability, create_booking, create_order, transfer_to_human, end_call]
        )

@server.rtc_session(agent_name="lumentra-voice-agent")
async def entrypoint(ctx: JobContext):
    participant = await ctx.wait_for_participant()
    dialed_number = participant.attributes.get("sip.trunkPhoneNumber", "")
    tenant_config = await get_tenant_by_phone(dialed_number)

    session = AgentSession(
        stt="deepgram/nova-3:multi",
        llm="openai/gpt-4.1-mini",
        tts=cartesia.TTS(model="sonic-3", voice=tenant_config["voice_config"]["voice_id"]),
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )
    agent = LumentraAgent(tenant_config, caller_phone)
    await session.start(agent=agent, room=ctx.room)
    await session.generate_reply(instructions=f"Greet: {tenant_config['greeting_standard']}")
```

### Tool implementation pattern (each tool calls lumentra-api):

```python
@function_tool()
async def check_availability(context: RunContext, date: str, service_type: str = ""):
    response = await httpx.post(f"{API_URL}/internal/voice-tools/check_availability", json={
        "tenant_id": context.agent.tenant_config["id"],
        "caller_phone": context.agent.caller_phone,
        "args": {"date": date, "service_type": service_type}
    }, headers={"Authorization": f"Bearer {INTERNAL_API_KEY}"})
    return response.json()["message"]
```

### Special tools:

- `transfer_to_human`: Calls API to log escalation, then LiveKit `transfer_sip_participant()` for SIP REFER
- `end_call`: Calls API to log completion, then LiveKit `delete_room()`

### Docker Compose addition:

- `agent` service (build from ./lumentra-agent, depends on api + livekit)

### Verification:

- `python agent.py console` -- test locally with microphone
- Agent connects to LiveKit, shows in `lk room list`

---

## Phase 3: Internal API Endpoints on lumentra-api

### New file: `lumentra-api/src/routes/internal.ts`

Three endpoints behind `INTERNAL_API_KEY` bearer auth:

1. **`GET /internal/tenants/by-phone/:phone`**

   - Uses existing `getTenantByPhoneWithFallback()` from `lumentra-api/src/services/database/tenant-cache.ts`
   - Calls existing `buildSystemPrompt()` from `lumentra-api/src/services/gemini/chat.ts` to include assembled `system_prompt` in response
   - Returns: tenant config + voice config + greeting + system_prompt

2. **`POST /internal/voice-tools/:action`**

   - Routes to existing `executeTool()` from `lumentra-api/src/services/gemini/tools.ts`
   - Accepts: `{tenant_id, call_sid, caller_phone, args}`
   - Returns: tool result

3. **`POST /internal/calls/log`**
   - Uses existing `saveCallRecord()` pattern from `lumentra-api/src/services/calls/call-logger.ts`
   - Accepts: `{tenant_id, call_sid, caller_phone, duration, transcript, outcome, ...}`

### Modifications to existing files:

- `lumentra-api/src/index.ts`: Register `/internal` route with internal auth middleware
- `lumentra-api/.env.example`: Add `INTERNAL_API_KEY`

### Verification:

- `curl -H "Authorization: Bearer $KEY" http://localhost:3100/internal/tenants/by-phone/+15551234567` returns tenant config

---

## Phase 4: Database Migration

### New migration: `018_voice_pipeline_flag.sql`

```sql
ALTER TABLE tenants ADD COLUMN voice_pipeline TEXT NOT NULL DEFAULT 'custom'
  CHECK (voice_pipeline IN ('custom', 'livekit'));
```

### SignalWire routing per tenant:

- `voice_pipeline: 'custom'` -- phone webhook stays at `POST /signalwire/voice` (current behavior)
- `voice_pipeline: 'livekit'` -- phone configured with SWML routing to LiveKit SIP at `sip:number@HETZNER_IP:5060`
- Routing change is done via SignalWire API (update phone number webhook config)

---

## Phase 5: Dashboard Update

### Minimal change: Add pipeline toggle

- In `lumentra-dashboard/components/settings/IntegrationsTab.tsx` or new section in settings
- Simple toggle: "Voice Pipeline: Custom / LiveKit"
- PATCH to `/api/tenants/:id` with `{voice_pipeline: 'livekit'}`
- No other dashboard changes needed -- call logs, CRM, bookings all use same database tables

---

## Phase 6: Testing & Verification

1. **Smoke test**: Call a number -> hear greeting -> have a conversation -> tools work -> hang up
2. **Transfer test**: Say "speak to a human" -> SIP REFER to escalation number
3. **Multi-tenant test**: Two tenants, one on each pipeline, both work correctly
4. **Latency test**: Measure time from end-of-speech to start-of-response (target: <800ms)
5. **Barge-in test**: Interrupt mid-response -> agent stops cleanly, no audio chop
6. **Long call test**: 5+ minute conversation -> no degradation (the main problem being solved)
7. **Dashboard verification**: Call records appear correctly in dashboard for both pipelines

---

## Environment Variables to Add

```
# LiveKit (both .env files)
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# Internal API communication
INTERNAL_API_KEY=replace-with-long-random-secret
```

---

## Risks

| Risk                                         | Mitigation                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Self-hosted SIP drops calls (NAT/firewall)   | Test with SIP debug logging, use TCP transport, verify public IP                     |
| Turn detection worse than custom TurnManager | LiveKit's EOU model is actually better (85% fewer false interrupts); tune thresholds |
| Tool call latency via REST (+5-10ms)         | Acceptable for voice; keep endpoints lightweight                                     |
| LiveKit host networking port conflicts       | Audit existing ports; no conflicts with API:3100 / dashboard:3000                    |
| Feature flag routing complexity              | Simple: just change SignalWire phone webhook config per tenant                       |

---

## Implementation Order

1. Infrastructure (LiveKit server + SIP + Redis in Docker)
2. Internal API endpoints on lumentra-api
3. Database migration
4. Python agent service (core agent + tools)
5. SignalWire SIP trunk config + test call
6. Dashboard toggle
7. Gradual tenant migration

---

## Cost Comparison

| Stack                                                            | $/min       |
| ---------------------------------------------------------------- | ----------- |
| Current (SignalWire + Deepgram Nova-2 + GPT-4.1 mini + Cartesia) | $0.030      |
| LiveKit self-hosted + Deepgram Nova-3 + GPT-4.1 mini + Cartesia  | $0.032      |
| Vapi (managed, for reference)                                    | $0.11-$0.15 |
