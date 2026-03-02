# Lumentra Troubleshooting Manual

**Platform:** Multi-tenant voice AI platform
**Version:** 0.1.0
**Last Updated:** 2026-03-02
**Source Files Read:** 40+ source files across lumentra-api, lumentra-agent, and infrastructure

---

## Table of Contents

1. [Exhaustive Symptom-Cause-Fix Reference](#1-exhaustive-symptom-cause-fix-reference)
2. [Voice Call Troubleshooting Deep-Dive](#2-voice-call-troubleshooting-deep-dive)
3. [API Error Reference](#3-api-error-reference)
4. [Database Troubleshooting](#4-database-troubleshooting)
5. [Authentication Troubleshooting](#5-authentication-troubleshooting)
6. [Integration Troubleshooting](#6-integration-troubleshooting)
7. [Background Job Troubleshooting](#7-background-job-troubleshooting)
8. [Performance Troubleshooting](#8-performance-troubleshooting)
9. [Log Analysis Guide](#9-log-analysis-guide)
10. [Network Troubleshooting](#10-network-troubleshooting)
11. [Disaster Recovery Procedures](#11-disaster-recovery-procedures)
12. [Health Check Script](#12-health-check-script)
13. [Common Post-Deployment Issues](#13-common-post-deployment-issues)

---

## 1. Exhaustive Symptom-Cause-Fix Reference

This table covers 60+ specific error scenarios observed in production or derivable from the source code.

### 1.1 Voice Pipeline Errors

**1.** `No tenant found for number: +1XXXXXXXXXX`
: **Cause:** Phone number not in DB or cache stale
: **Diagnose:** `docker logs agent 2>&1 | grep "No tenant found"` then `SELECT id, phone_number, is_active FROM tenants WHERE phone_number LIKE '%XXXXXXXXXX%';`
: **Fix:** Verify phone_number matches exactly (+1 prefix). Call `invalidateTenant(id)` or wait 5 min. Ensure `is_active = true`.

**2.** Agent exits silently after `Call started`
: **Cause:** `get_tenant_by_phone()` returned `None` at `agent.py` line 100
: **Diagnose:** Check logs for `Call started: dialed=X caller=Y room=Z` with no further output
: **Fix:** Same as #1 -- ensure tenant phone mapping is correct.

**3.** `Tenant lookup HTTP error: 500`
: **Cause:** `INTERNAL_API_KEY` not configured on API side
: **Diagnose:** `curl -H "Authorization: Bearer $INTERNAL_API_KEY" http://10.0.1.5:3100/internal/tenants/by-phone/+19458001233`
: **Fix:** Set `INTERNAL_API_KEY` in API env. Auth middleware at `internal.ts` line 25 checks it.

**4.** `Tenant lookup HTTP error: 401`
: **Cause:** Agent Bearer token does not match API `INTERNAL_API_KEY`
: **Diagnose:** Compare `INTERNAL_API_KEY` in agent `.env` vs API env
: **Fix:** Make both values identical. Agent sends via `api_client.py` line 9; API checks at `internal.ts` line 35.

**5.** `Tenant lookup HTTP error: 403`
: **Cause:** Bearer token present but mismatched
: **Diagnose:** Same as #4
: **Fix:** Same as #4. The 403 comes from `internal.ts` line 36.

**6.** `Tool check_availability error: ...`
: **Cause:** API `/internal/voice-tools/check_availability` threw exception
: **Diagnose:** `docker logs api 2>&1 | grep "Tool check_availability failed"`
: **Fix:** Check API logs. Common: DB failure or malformed date (not YYYY-MM-DD).

**7.** `Tool create_booking error: ...`
: **Cause:** Booking creation failed, often DB constraint violation
: **Diagnose:** `docker logs api 2>&1 | grep "Tool create_booking failed"`
: **Fix:** Ensure required fields present: `customer_name`, `customer_phone`, `date`, `time`. LLM may send "unknown" -- validated at `tools.ts` line 242.

**8.** `Tool create_order error: "I need a name"`
: **Cause:** LLM passed invalid customer_name (empty, "unknown", etc.)
: **Diagnose:** Normal validation; agent will ask caller for name
: **Fix:** No fix needed -- `isInvalidValue()` check at `tools.ts` line 242.

**9.** `Tool transfer_to_human` returns "not able to transfer"
: **Cause:** No `escalation_phone` configured for tenant
: **Diagnose:** `SELECT escalation_phone, escalation_enabled FROM tenants WHERE id = '<tenant_id>';`
: **Fix:** Set `escalation_phone` on tenant. Without it, `tools.ts` line 170 returns `transferred: false`.

**10.** `SIP transfer failed: ...`
: **Cause:** SIP REFER to escalation phone failed
: **Diagnose:** `docker logs agent 2>&1 | grep "SIP transfer failed"`
: **Fix:** 1) Verify escalation_phone is valid. 2) Check SignalWire SIP trunk. 3) Ensure SIP participant still in room.

**11.** `Failed to delete room: ...`
: **Cause:** `end_call` tool's LiveKit room delete failed
: **Diagnose:** `docker logs agent 2>&1 | grep "Failed to delete room"`
: **Fix:** Check LiveKit is running. Fallback at `tools.py` line 196 calls `session.shutdown()`.

**12.** `Call logging timed out for <room>`
: **Cause:** `log_call()` took >5s (`asyncio.wait_for` at `agent.py` line 172)
: **Diagnose:** `docker logs agent 2>&1 | grep "Call logging timed out"`
: **Fix:** Check API responsiveness. `/internal/calls/log` may be slow due to DB or post-call automation.

**13.** `Call logging failed for <room>: ...`
: **Cause:** HTTP POST to `/internal/calls/log` failed
: **Diagnose:** `docker logs agent 2>&1 | grep "Call logging failed"`
: **Fix:** Check API logs. Common: DB constraint violations on `calls` table.

**14.** `Failed to extract transcript: ...`
: **Cause:** SDK version mismatch, missing `.messages()` method
: **Diagnose:** `docker logs agent 2>&1 | grep "Failed to extract transcript"`
: **Fix:** Ensure `livekit-agents>=1.4`. See `call_logger.py` line 65.

**15.** `Duration watchdog: wrap-up nudge at Xds`
: **Cause:** Normal -- call running for `max_duration - 120` seconds
: **Diagnose:** No action unless calls cut short
: **Fix:** Increase `max_call_duration_seconds` (default 900, min 120).

**16.** `Duration limit reached (Xds) for room Y`
: **Cause:** Call exceeded max_duration, watchdog force-ending at `agent.py` line 205
: **Diagnose:** Check tenant's `max_call_duration_seconds`
: **Fix:** Increase the limit or inform business owner.

**17.** `Duration limit: transfer failed: ...`
: **Cause:** SIP REFER after duration limit failed
: **Diagnose:** Same as #10
: **Fix:** Same as #10.

**18.** `Duration limit: room deleted (no escalation)`
: **Cause:** Duration limit reached, no escalation phone set
: **Diagnose:** Normal if no escalation phone configured
: **Fix:** Configure an escalation phone number.

**19.** `No SIP participant found for transfer`
: **Cause:** `_get_sip_participant()` found no `PARTICIPANT_KIND_SIP` in room
: **Diagnose:** Caller may have hung up or call is WebRTC-originated
: **Fix:** Check if caller is still connected.

### 1.2 API Server Errors

**20.** All API routes return 500
: **Cause:** `DATABASE_URL` missing or PostgreSQL unreachable
: **Diagnose:** `curl http://localhost:3100/health` -- check `services.database.connected`
: **Fix:** Set `DATABASE_URL` env var. See `pool.ts` line 26.

**21.** `/health` returns `{"status":"degraded"}` (503)
: **Cause:** DB health check failed (`pool.ts` line 251)
: **Diagnose:** `curl -s http://localhost:3100/health | jq .services.database`
: **Fix:** Check DB connectivity. `poolStats.waiting > 0` means connection exhaustion.

**22.** `[DB] Unexpected pool error: ...`
: **Cause:** Pool connection error (network blip, DB restart)
: **Diagnose:** `docker logs api 2>&1 | grep "Unexpected pool error"`
: **Fix:** Transient -- pool recovers. If persistent, check DB health and network.

**23.** `[DB] Slow query (Xms): ...`
: **Cause:** Query took >100ms (`SLOW_QUERY_THRESHOLD_MS` at `pool.ts` line 12)
: **Diagnose:** `docker logs api 2>&1 | grep "Slow query"`
: **Fix:** Identify query from log. Add indexes if needed. Check table bloat.

**24.** `[DB] Query failed (Xms): ...`
: **Cause:** Database query threw an error
: **Diagnose:** `docker logs api 2>&1 | grep "Query failed"`
: **Fix:** Check error message. Common: constraint violations, invalid SQL, timeout.

**25.** `Missing SUPABASE_URL or SUPABASE_ANON_KEY`
: **Cause:** Auth middleware at `auth.ts` line 33 cannot init Supabase client
: **Diagnose:** Check environment variables
: **Fix:** Set both `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

**26.** `Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`
: **Cause:** Service client at `auth.ts` line 55 cannot init
: **Diagnose:** Check environment variables
: **Fix:** Set both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

**27.** `Auth context not set - is authMiddleware applied?`
: **Cause:** Route missing auth middleware
: **Diagnose:** `docker logs api 2>&1 | grep "Auth context not set"`
: **Fix:** Apply `authMiddleware()` or `userAuthMiddleware()`. See `auth.ts` lines 318-345.

**28.** `[INTERNAL] INTERNAL_API_KEY not configured`
: **Cause:** No `INTERNAL_API_KEY` env var found
: **Diagnose:** `docker logs api 2>&1 | grep "INTERNAL_API_KEY not configured"`
: **Fix:** Set `INTERNAL_API_KEY` in API environment.

**29.** `[INTERNAL] Post-call automation error: ...`
: **Cause:** `runPostCallAutomation()` threw an error
: **Diagnose:** `docker logs api 2>&1 | grep "Post-call automation error"`
: **Fix:** Non-blocking (uses `.catch()`). Check contacts, deals, or tasks tables.

**30.** `Unknown tool: <name>`
: **Cause:** Agent sent unrecognized tool to `executeTool()` (`tools.ts` line 435)
: **Diagnose:** `docker logs api 2>&1 | grep "Unknown tool"`
: **Fix:** Valid tools: `check_availability`, `create_booking`, `create_order`, `transfer_to_human`, `end_call`, `log_note`. Check `tools.py` for mismatched names.

### 1.3 Chat Widget Errors

**31.** Chat returns `"Invalid tenant_id format"`
: **Cause:** `tenant_id` is not a valid UUID
: **Fix:** Ensure widget sends a proper UUID for `tenant_id`.

**32.** Chat returns `"Invalid tenant"` (404)
: **Cause:** tenant_id not found in cache or DB
: **Diagnose:** `SELECT id FROM tenants WHERE id = '<tenant_id>' AND is_active = true;`
: **Fix:** Verify tenant exists and is active. Cache refreshes every 5 min.

**33.** Chat returns `"message is required"`
: **Cause:** Message field empty or missing
: **Fix:** Ensure `message` is non-empty. Max 10000 chars (`chat.ts` line 105).

**34.** Chat returns 500 `"All LLM providers failed"`
: **Cause:** Gemini, OpenAI, and Groq all failed
: **Diagnose:** `docker logs api 2>&1 | grep "All providers failed"`
: **Fix:** Check all API keys. At least one of `GEMINI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY` must be valid.

**35.** `[LLM] <provider> rate limited, cooling down`
: **Cause:** Provider returned 429 (rate limit)
: **Diagnose:** `docker logs api 2>&1 | grep "rate limited"`
: **Fix:** Wait 5 min (auto-cooldown). If persistent, upgrade plan or add providers.

**36.** `[LLM] <provider> error, cooling down`
: **Cause:** Provider returned non-rate-limit error
: **Diagnose:** `docker logs api 2>&1 | grep "error, cooling down"`
: **Fix:** Check API key validity. Cooldown is 60s (`multi-provider.ts` line 59).

### 1.4 Booking Errors

**37.** Booking creation 400 `"Validation failed"`
: **Cause:** Zod validation failed on required fields
: **Diagnose:** Check `details` array in error response
: **Fix:** Required: `customer_name`, `customer_phone`, `booking_type`, `booking_date` (YYYY-MM-DD), `booking_time` (HH:MM). See `bookings.ts` lines 33-50.

**38.** Booking creation 400 `"Date must be YYYY-MM-DD"`
: **Cause:** `booking_date` format invalid
: **Fix:** Send dates as `YYYY-MM-DD` strings.

**39.** Booking update 404 `"Booking not found"`
: **Cause:** Booking ID missing or wrong tenant
: **Diagnose:** `SELECT id, tenant_id FROM bookings WHERE id = '<booking_id>';`
: **Fix:** Verify booking exists and correct tenant ID is sent.

**40.** Reschedule 400 `"Validation failed"`
: **Cause:** Missing `new_date` or `new_time`
: **Fix:** Both `new_date` (YYYY-MM-DD) and `new_time` (HH:MM) are required.

**41.** Calendar 400 `"start_date and end_date required"`
: **Cause:** Missing query parameters
: **Fix:** Add `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` (`bookings.ts` line 158).

**42.** Day summary 400 `"date required"`
: **Cause:** Missing `date` query parameter
: **Fix:** Add `?date=YYYY-MM-DD` (`bookings.ts` line 180).

### 1.5 Contact Errors

**43.** Contact creation 409 `"already exists"`
: **Cause:** Phone number already exists for this tenant
: **Diagnose:** `SELECT id FROM contacts WHERE tenant_id = '<tenant_id>' AND phone = '<phone>';`
: **Fix:** Use `/api/contacts/find-or-create` instead, or update existing contact.

**44.** Contact creation 400 `"Invalid phone number format"`
: **Cause:** `isValidPhone()` failed (`contacts.ts` line 307)
: **Fix:** Ensure phone number has at least 10 digits.

**45.** Contact import 400 `"Maximum 10000 records"`
: **Cause:** Import array exceeds 10000-record limit
: **Fix:** Split into batches of 10000 or fewer (`contacts.ts` line 735).

**46.** Contact import 400 `"Content-Type must be application/json"`
: **Cause:** Wrong content type header
: **Fix:** Set `Content-Type: application/json`.

**47.** Contact merge 400 `"Validation failed"`
: **Cause:** Invalid UUIDs in `primary_id` or `secondary_ids`
: **Fix:** Both must be valid UUID format.

**48.** Contact lookup 400 `"phone query parameter is required"`
: **Cause:** Missing `?phone=` query parameter
: **Fix:** Required for fast lookup (`contacts.ts` line 217).

### 1.6 Tenant Errors

**49.** Tenant creation 400 `"Missing required fields"`
: **Cause:** Missing `business_name`, `phone_number`, or `industry`
: **Fix:** All three are required (`tenants.ts` line 160).

**50.** Tenant creation 400 `"Phone number already in use"`
: **Cause:** Another tenant has the same phone_number
: **Diagnose:** `SELECT id, business_name FROM tenants WHERE phone_number = '<phone>';`
: **Fix:** Use a different number or deactivate the existing tenant.

**51.** Tenant update 403 `"owner or admin role required"`
: **Cause:** User role is not `owner` or `admin`
: **Diagnose:** Check `tenant_members` table for user's role
: **Fix:** Only owners/admins can update settings (`tenants.ts` line 314).

**52.** Tenant deletion 403 `"owner role required"`
: **Cause:** User is not an owner
: **Fix:** Only owners can deactivate tenants (`tenants.ts` line 374).

**53.** Member removal 400 `"Cannot remove the last owner"`
: **Cause:** Attempting to remove the only owner
: **Diagnose:** `SELECT COUNT(*) FROM tenant_members WHERE tenant_id = '<id>' AND role = 'owner' AND is_active = true;`
: **Fix:** Add another owner first (`tenants.ts` line 620).

**54.** Member creation 400 `"User is already a member"`
: **Cause:** PG unique constraint violation (code `23505`)
: **Fix:** User already has active membership. Remove it first.

**55.** Tenant update 400 `"Invalid industry type"`
: **Cause:** Industry not in allowed list
: **Fix:** Valid: `hotel`, `motel`, `restaurant`, `medical`, `dental`, `salon`, `auto_service`.

### 1.7 Deal and Task Errors

**56.** Deal stage update 400 `"Invalid stage for industry"`
: **Cause:** Stage ID not in industry pipeline config
: **Fix:** Use a valid stage ID from the error response (`deals.ts` line 281).

**57.** Task creation 400 `"Title is required"`
: **Cause:** Missing `title` field
: **Fix:** `title` is required and must be non-empty.

**58.** Task creation 400 `"Due date is required"`
: **Cause:** Missing `due_date` field
: **Fix:** `due_date` is required (`tasks.ts` line 28).

### 1.8 Phone Configuration Errors

**59.** Phone provisioning 500 `"Failed to provision number"`
: **Cause:** SignalWire API rejected provisioning
: **Diagnose:** `docker logs api 2>&1 | grep "Provision error"`
: **Fix:** Check SignalWire account balance and API credentials.

**60.** SIP endpoint 500 `"Failed to create SIP endpoint"`
: **Cause:** SignalWire Relay API rejected creation
: **Diagnose:** `docker logs api 2>&1 | grep "SIP.*Failed to create endpoint"`
: **Fix:** Verify `SIGNALWIRE_SPACE_URL`, `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_API_TOKEN`.

**61.** Forwarding 400 `"No numbers available"`
: **Cause:** No numbers in requested area code
: **Fix:** Use a nearby area code or omit the area code parameter.

**62.** Port request 400 `"phone_number, current_carrier, and authorized_name are required"`
: **Cause:** Missing required fields for porting
: **Fix:** All three are required (`phone-config.ts` line 232).

### 1.9 Rate Limiting Errors

**63.** 429 `"Too many requests, please try again later"`
: **Cause:** Default rate limit (60 req/min) exceeded
: **Diagnose:** Check `X-RateLimit-Remaining` and `Retry-After` headers
: **Fix:** Wait for retry-after period. Default: 60 req/min window.

**64.** 429 `"Too many attempts, please try again later"`
: **Cause:** Strict rate limit (10 req/min) for sensitive endpoints
: **Fix:** Wait and retry. Applied to auth-related endpoints.

**65.** 429 `"Rate limit exceeded. Try again in an hour."`
: **Cause:** Critical rate limit (5 req/hour) for password reset
: **Fix:** Wait 1 hour. Intentionally strict for security.

---

## 2. Voice Call Troubleshooting Deep-Dive

### 2.1 Architecture Overview

The voice pipeline consists of these components in order:

```
Caller -> SignalWire SIP Trunk -> LiveKit SIP Bridge -> LiveKit Room -> Python Agent
                                                                          |
                                                        STT (Deepgram nova-3)
                                                        LLM (OpenAI gpt-4.1-mini)
                                                        TTS (Cartesia sonic-3)
                                                        VAD (Silero, prewarmed)
                                                        Turn Detection (Multilingual)
```

Key files:

- Agent entrypoint: `lumentra-agent/agent.py`
- Tool definitions: `lumentra-agent/tools.py`
- API client: `lumentra-agent/api_client.py`
- Tenant config fetcher: `lumentra-agent/tenant_config.py`
- Call logger: `lumentra-agent/call_logger.py`
- Internal API routes: `lumentra-api/src/routes/internal.ts`
- Tool execution: `lumentra-api/src/services/gemini/tools.ts`

### 2.2 SIP Registration Failures

**Symptoms:** Calls never reach the LiveKit room. SignalWire shows "call failed" or "no route."

**Diagnosis:**

```bash
# Check if LiveKit SIP service is running
docker ps | grep sip

# Check LiveKit SIP logs for registration errors
docker logs sip 2>&1 | tail -100

# Verify SIP trunk configuration on LiveKit
# Trunk ID: ST_SUJtKjT9TEgv
# Dispatch rule: SDR_2bZEobprwRXq

# Check if port 5060 (SIP) is open
sudo ss -tlnp | grep 5060

# Check UFW firewall
sudo ufw status | grep 5060
```

**Common causes:**

1. LiveKit SIP service not running or crashed
2. Port 5060 (UDP/TCP) blocked by Hetzner firewall or UFW
3. SIP trunk configuration mismatch between SignalWire and LiveKit
4. Redis not running (LiveKit SIP depends on Redis for coordination)

**Fix steps:**

1. Restart the SIP service: `docker restart sip`
2. Ensure port 5060 is open: `sudo ufw allow 5060/udp && sudo ufw allow 5060/tcp`
3. Check Hetzner firewall "lumentra-voice" allows port 5060
4. Verify Redis is healthy: `docker exec redis redis-cli ping` (should return PONG)

### 2.3 Codec Negotiation Failures

**Symptoms:** Call connects but no audio in either direction. SIP logs show "488 Not Acceptable Here" or codec negotiation errors.

**Diagnosis:**

```bash
# Check SIP INVITE/200 OK for codec negotiation
docker logs sip 2>&1 | grep -i "codec\|sdp\|488"
```

**The agent supports these codecs** (configured in `sip.ts` line 78):

- PCMU (G.711 u-law)
- PCMA (G.711 A-law)
- OPUS

**Fix:** Ensure the SIP trunk on SignalWire is configured to offer at least one of these codecs. PCMU/PCMA are nearly universal.

### 2.4 One-Way Audio

**Symptoms:** Agent speaks but caller hears nothing, or caller speaks but agent does not respond.

**Diagnosis:**

```bash
# Check if RTP ports are open (10000-20000 for RTP, 50000-60000 for WebRTC ICE)
sudo ss -ulnp | grep -E "(1[0-9]{4}|5[0-9]{4})"

# Check if NAT traversal is working
docker logs livekit 2>&1 | grep -i "ice\|nat\|stun\|turn"
```

**Common causes:**

1. **RTP port range blocked:** Ports 10000-20000 must be open for UDP traffic
2. **Symmetric NAT:** The server is behind NAT that prevents direct RTP
3. **Missing TURN server:** If direct connectivity fails, a TURN server is needed
4. **LiveKit not using host networking:** The docker-compose uses `network_mode: host` for LiveKit -- verify this is set

**Fix steps:**

1. Open RTP ports: `sudo ufw allow 10000:20000/udp`
2. Open WebRTC ICE ports: `sudo ufw allow 50000:60000/udp`
3. Ensure Hetzner firewall allows these port ranges
4. Verify `network_mode: host` in docker-compose for LiveKit and SIP services

### 2.5 Echo and Audio Quality

**Symptoms:** Caller or agent hears their own voice echoed back. Audio is choppy or garbled.

**The agent uses noise cancellation** (`agent.py` line 241):

```python
audio_input=room_io.AudioInputOptions(
    noise_cancellation=noise_cancellation.BVCTelephony(),
),
```

**Diagnosis:**

```bash
# Check agent CPU usage (audio processing is CPU-intensive)
docker stats agent --no-stream

# Check for packet loss on the network
ping -c 100 -i 0.01 sip.signalwire.com | tail -5
```

**Fix steps:**

1. Ensure the agent container has sufficient CPU (limit is 2 CPUs in docker-compose)
2. Check for network jitter/packet loss between the server and SignalWire
3. If echo persists, it may be on the caller's end (speakerphone, bad headset)

### 2.6 Latency Issues

**Symptoms:** Long delays between caller speaking and agent responding.

**Tuning parameters** (in `agent.py` lines 127-131):

- `preemptive_generation=True` -- starts LLM generation before speaker finishes
- `resume_false_interruption=True` -- resumes after false interruptions
- `false_interruption_timeout=1.5` -- wait 1.5s before classifying as false interruption
- `min_endpointing_delay=0.8` -- minimum wait after speech stops
- `max_endpointing_delay=2.5` -- maximum wait after speech stops

**Diagnosis:**

```bash
# Check agent metrics for latency breakdown
docker logs agent 2>&1 | grep "metrics\|latency\|TTFB"

# Check LLM response time (gpt-4.1-mini is fast but network matters)
time curl -s https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY" > /dev/null
```

**Fix steps:**

1. Reduce `max_endpointing_delay` from 2.5 to 1.5 for faster responses (tradeoff: may cut off slow speakers)
2. Check if the server is geographically close to the LLM provider (Ashburn VA is optimal for US services)
3. Monitor prompt cache hit rate -- 88% cache hits on gpt-4.1-mini significantly reduces latency
4. Check Deepgram STT latency (nova-3 with multi-language is slightly slower than english-only)

### 2.7 Agent Not Joining Room

**Symptoms:** SIP call connects (ringing stops), but no greeting is heard. LiveKit room exists but agent never joins.

**Diagnosis:**

```bash
# Check if the agent process is running
docker ps | grep agent

# Check agent logs for the specific room
docker logs agent 2>&1 | grep "<room_name>"

# Check if the agent registered with LiveKit
docker logs agent 2>&1 | grep "registered\|connected\|lumentra-voice-agent"
```

**Common causes:**

1. Agent container crashed or is not running
2. Agent cannot connect to LiveKit (wrong `LIVEKIT_URL`)
3. Agent name mismatch: dispatch rule routes to `lumentra-voice-agent` but agent registers differently
4. All agent workers are busy (no available workers)

**Fix steps:**

1. Restart agent: `docker restart agent`
2. Verify `LIVEKIT_URL=ws://172.17.0.1:7880` (or `ws://localhost:7880` if using host networking)
3. Check that `agent_name="lumentra-voice-agent"` matches the dispatch rule `SDR_2bZEobprwRXq`
4. Check agent resource limits -- if all workers are processing calls, new calls queue

### 2.8 Agent Crashing Mid-Call

**Symptoms:** Call drops unexpectedly. Agent logs show an unhandled exception.

**Diagnosis:**

```bash
# Check for Python exceptions
docker logs agent 2>&1 | grep -A5 "Traceback\|Exception\|Error"

# Check container restart count
docker inspect agent --format='{{.RestartCount}}'

# Check if OOM killed
docker inspect agent --format='{{.State.OOMKilled}}'
```

**Common causes:**

1. Out of memory (agent limit is 2GB in docker-compose)
2. Unhandled exception in tool execution
3. LiveKit SDK bug or version incompatibility
4. Network interruption to LLM provider

**Fix steps:**

1. Increase memory limit if OOM: change `memory: 2G` to `memory: 4G`
2. Check Python package versions in `requirements.txt` match expected versions
3. The shutdown callback at `agent.py` line 177 should log the call even on crash

### 2.9 TTS Not Producing Audio

**Symptoms:** Agent appears to be "thinking" (STT and LLM work) but no speech output.

**Diagnosis:**

```bash
# Check Cartesia API key
docker logs agent 2>&1 | grep -i "cartesia\|tts\|audio"

# Verify voice_id is valid
docker logs agent 2>&1 | grep "voice"
```

**The TTS configuration** (`agent.py` lines 118-123):

```python
tts=cartesia.TTS(
    model="sonic-3",
    voice=tenant_config["voice_config"]["voice_id"],
    speed=0.95,
    emotion=["Content"],
),
```

**Common causes:**

1. `CARTESIA_API_KEY` is missing or invalid
2. The `voice_id` in tenant's `voice_config` is invalid or deleted
3. Cartesia service is down
4. The `sonic-3` model is not available in your Cartesia plan

**Fix steps:**

1. Verify Cartesia API key: `curl -H "X-API-Key: $CARTESIA_API_KEY" https://api.cartesia.ai/voices`
2. Check the voice_id: `SELECT voice_config->'voice_id' FROM tenants WHERE id = '<id>';`
3. Default voice_id is `02fe5732-a072-4767-83e3-a91d41d274ca` (Madison)

### 2.10 STT Not Transcribing

**Symptoms:** Agent does not respond to anything the caller says. No "user" messages in the transcript.

**Diagnosis:**

```bash
# Check Deepgram API key
docker logs agent 2>&1 | grep -i "deepgram\|stt\|transcri"
```

**The STT configuration** (`agent.py` lines 111-116):

```python
stt=deepgram.STT(
    model="nova-3",
    language="multi",
    smart_format=True,
    keyterm=[tenant_config["business_name"]],
),
```

**Common causes:**

1. `DEEPGRAM_API_KEY` is missing or invalid
2. Audio is not reaching the STT (one-way audio issue -- see 2.4)
3. The caller's audio is too quiet or too noisy
4. Deepgram service is down

**Fix steps:**

1. Verify Deepgram API key is valid and has quota
2. Test STT independently: `curl -X POST https://api.deepgram.com/v1/listen -H "Authorization: Token $DEEPGRAM_API_KEY" ...`
3. Check that the keyterm (business name) does not contain special characters that break the API

### 2.11 Wrong Language Detection

**Symptoms:** Agent responds in the wrong language, or STT produces gibberish.

The STT uses `language="multi"` (multilingual model). The turn detection uses `MultilingualModel()`.

**Fix steps:**

1. If the business only serves English speakers, change to `language="en"` for better accuracy
2. The multilingual model may misdetect short utterances -- this is expected behavior
3. Ensure the system prompt specifies the expected language

### 2.12 Call Connects But No Speech (Silent Call)

**Symptoms:** Caller hears ringing, then silence. No greeting from the agent.

**Diagnosis flow:**

1. Check if agent joined: `docker logs agent 2>&1 | grep "Call started"`
2. Check if tenant was found: look for "No tenant found" or tenant config info
3. Check if greeting was triggered: the `on_enter()` method at `agent.py` line 55 calls `generate_reply()`
4. Check if TTS is working: see section 2.9

The greeting comes from `tenant_config["greeting_standard"]`, set via `on_enter()` at `agent.py` line 57:

```python
async def on_enter(self):
    self.session.generate_reply(
        instructions=f"Greet the caller: {self.tenant_config['greeting_standard']}"
    )
```

**Common causes:**

1. Tenant not found (agent returns early without speaking)
2. `greeting_standard` is null or empty in the tenant config
3. TTS failure (see 2.9)
4. Audio output routing issue (see 2.4)

---

## 3. API Error Reference

### 3.1 Error Response Format

All API errors follow this format:

```json
{
  "error": "Error category",
  "message": "Detailed error message"
}
```

For validation errors (Zod):

```json
{
  "error": "Validation failed",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "inclusive": true,
      "exact": false,
      "message": "Customer name is required",
      "path": ["customer_name"]
    }
  ]
}
```

For rate limiting:

```json
{
  "error": "Too Many Requests",
  "message": "Too many requests, please try again later",
  "retryAfter": 45
}
```

### 3.2 HTTP Status Code Reference

| Status | Where Returned             | Meaning             |
| ------ | -------------------------- | ------------------- |
| 200    | Successful GET/PUT/PATCH   | Success             |
| 201    | POST (create resources)    | Resource created    |
| 400    | Validation, missing fields | Bad request         |
| 401    | Auth middleware            | Missing/invalid JWT |
| 403    | Auth, tenants, internal    | No access           |
| 404    | Single-resource GET        | Resource not found  |
| 409    | Contact creation           | Conflict/duplicate  |
| 429    | Rate limit middleware      | Too many requests   |
| 500    | Catch blocks, DB, tools    | Server error        |
| 503    | Health endpoint (DB down)  | Service unavailable |

### 3.3 Route-by-Route Error Catalog

#### Health Routes (`/health`)

| Method | Path           | Possible Errors           |
| ------ | -------------- | ------------------------- |
| GET    | `/health`      | 200 (OK) or 503 (DB down) |
| GET    | `/health/ping` | Always 200 "pong"         |

#### Internal Routes (`/internal/*`)

| Method   | Path                   | Status | Error                         |
| -------- | ---------------------- | ------ | ----------------------------- |
| GET/POST | Any                    | 500    | `"Internal API not config."`  |
| GET/POST | Any                    | 401    | `"Missing Auth header"`       |
| GET/POST | Any                    | 403    | `"Invalid API key"`           |
| GET      | `.../by-phone/:phone`  | 400    | `"Phone number required"`     |
| GET      | `.../by-phone/:phone`  | 404    | `"Tenant not found"`          |
| POST     | `.../voice-tools/:act` | 400    | `"tenant_id+action needed"`   |
| POST     | `.../voice-tools/:act` | 500    | `"Tool execution failed"`     |
| POST     | `/internal/calls/log`  | 400    | `"tenant_id+call_sid needed"` |
| POST     | `/internal/calls/log`  | 500    | `"Failed to save call"`       |

#### Calls Routes (`/api/calls`)

| Method | Path                  | Status | Error                |
| ------ | --------------------- | ------ | -------------------- |
| GET    | `/api/calls`          | 500    | Database query error |
| GET    | `.../calls/stats`     | 500    | Database query error |
| GET    | `.../calls/analytics` | 500    | Fetch or DB error    |
| GET    | `.../calls/recent`    | 500    | Database query error |
| GET    | `/api/calls/:id`      | 404    | `"Call not found"`   |
| GET    | `/api/calls/:id`      | 500    | Database query error |
| GET    | `.../:id/transcript`  | 404    | `"Call not found"`   |

#### Bookings Routes (`/api/bookings`)

| Method | Path                 | Status | Error                     |
| ------ | -------------------- | ------ | ------------------------- |
| GET    | `/api/bookings`      | 400    | Missing X-Tenant-ID       |
| GET    | `/api/bookings`      | 500    | Database query error      |
| GET    | `.../calendar`       | 400    | `"start/end_date needed"` |
| GET    | `.../day-summary`    | 400    | `"date required"`         |
| GET    | `.../bookings/:id`   | 404    | `"Booking not found"`     |
| POST   | `/api/bookings`      | 400    | `"Validation failed"`     |
| PUT    | `.../bookings/:id`   | 400    | `"Validation failed"`     |
| PUT    | `.../bookings/:id`   | 404    | Contains "not found"      |
| DELETE | `.../bookings/:id`   | 404    | Contains "not found"      |
| POST   | `.../:id/reschedule` | 400    | `"Validation failed"`     |
| POST   | `.../:id/reschedule` | 404    | Contains "not found"      |

#### Contacts Routes (`/api/contacts`)

| Method | Path                  | Status | Error                     |
| ------ | --------------------- | ------ | ------------------------- |
| GET    | `/api/contacts`       | 400    | Missing X-Tenant-ID       |
| GET    | `.../contacts/lookup` | 400    | `"phone param required"`  |
| GET    | `.../lookup/email`    | 400    | `"email param required"`  |
| GET    | `.../contacts/:id`    | 404    | `"Contact not found"`     |
| POST   | `/api/contacts`       | 400    | Validation or phone fmt   |
| POST   | `/api/contacts`       | 409    | `"already exists"`        |
| PUT    | `.../contacts/:id`    | 404    | Contains "not found"      |
| DELETE | `.../contacts/:id`    | 404    | Contains "not found"      |
| POST   | `.../find-or-create`  | 400    | `"phone is required"`     |
| PATCH  | `.../:id/status`      | 400    | `"Invalid status"`        |
| PATCH  | `.../:id/tags`        | 400    | `"Invalid tags format"`   |
| POST   | `.../bulk/tags`       | 400    | `"Invalid request"`       |
| POST   | `.../contacts/import` | 400    | Type, array, or limit err |
| POST   | `.../contacts/export` | 400    | `"Invalid format"`        |
| POST   | `.../contacts/merge`  | 400    | `"Validation failed"`     |

Contacts POST `/api/contacts` 400 error details:

- `"Validation failed"` -- Zod schema validation
- `"Invalid phone number format"` -- phone has fewer than 10 digits

#### Tenants Routes (`/api/tenants`)

| Method | Path                  | Status | Error                     |
| ------ | --------------------- | ------ | ------------------------- |
| GET    | `.../tenants/current` | 404    | `"Tenant not found"`      |
| GET    | `.../tenants/:id`     | 403    | `"Forbidden"` (no member) |
| GET    | `.../tenants/:id`     | 404    | `"Tenant not found"`      |
| POST   | `/api/tenants`        | 400    | Missing fields or dup     |
| PUT    | `.../tenants/:id`     | 400    | `"Invalid industry type"` |
| PUT    | `.../tenants/:id`     | 403    | `"Forbidden"` (admin+)    |
| PUT    | `.../tenants/:id`     | 404    | `"Tenant not found"`      |
| DELETE | `.../tenants/:id`     | 403    | `"Forbidden"` (owner)     |

| Method | Path                   | Status | Error                    |
| ------ | ---------------------- | ------ | ------------------------ |
| PUT    | `.../:id/phone`        | 400    | phone required or in use |
| PUT    | `.../:id/phone`        | 403    | `"Forbidden"` (owner)    |
| PUT    | `.../:id/phone`        | 404    | `"Tenant not found"`     |
| POST   | `.../:id/members`      | 400    | user_id/role or dup      |
| POST   | `.../:id/members`      | 403    | `"Forbidden"` (owner+)   |
| GET    | `.../:id/members`      | 403    | `"Forbidden"`            |
| DELETE | `.../:id/members/:mId` | 400    | `"Cannot remove owner"`  |
| DELETE | `.../:id/members/:mId` | 403    | `"Forbidden"` (owner+)   |
| DELETE | `.../:id/members/:mId` | 404    | `"Member not found"`     |

#### Deals Routes (`/api/deals`)

| Method | Path            | Status | Error                    |
| ------ | --------------- | ------ | ------------------------ |
| GET    | `/api/deals`    | 400    | Missing X-Tenant-ID      |
| GET    | `.../deals/:id` | 404    | `"Deal not found"`       |
| POST   | `/api/deals`    | 400    | Validation (name needed) |
| PUT    | `.../deals/:id` | 404    | Contains "not found"     |
| PATCH  | `.../:id/stage` | 400    | `"Invalid stage"`        |
| PATCH  | `.../:id/stage` | 404    | Contains "not found"     |
| DELETE | `.../deals/:id` | 404    | Contains "not found"     |

#### Tasks Routes (`/api/tasks`)

| Method | Path               | Status | Error                   |
| ------ | ------------------ | ------ | ----------------------- |
| GET    | `/api/tasks`       | 400    | Missing X-Tenant-ID     |
| GET    | `.../tasks/:id`    | 404    | `"Task not found"`      |
| POST   | `/api/tasks`       | 400    | title + due_date needed |
| PUT    | `.../tasks/:id`    | 404    | Contains "not found"    |
| PATCH  | `.../:id/complete` | 404    | Contains "not found"    |
| DELETE | `.../tasks/:id`    | 404    | Contains "not found"    |

#### Setup Routes (`/api/setup`)

| Method | Path                 | Status | Error                     |
| ------ | -------------------- | ------ | ------------------------- |
| GET    | `.../setup/progress` | 500    | `"Failed to fetch"`       |
| PUT    | `.../step/:step`     | 400    | `"Invalid step"`          |
| PUT    | `.../step/business`  | 400    | name + industry needed    |
| PUT    | `.../step/capab.`    | 400    | `"capabilities needed"`   |
| PUT    | `.../step/*`         | 400    | `"No tenant found"`       |
| POST   | `.../setup/complete` | 400    | No tenant or incomplete   |
| POST   | `.../setup/complete` | 404    | `"Tenant not found"`      |
| POST   | `.../setup/go-back`  | 400    | Invalid step or no tenant |

Setup route 400 error details:

- PUT `.../step/:step` -- `"Invalid step"` means not in SETUP_STEPS list
- PUT `.../step/business` -- `"business_name and industry are required"`
- PUT `.../step/capabilities` -- `"capabilities array is required"`
- PUT `.../step/*` -- `"No tenant found. Complete business step first."`
- POST `.../setup/complete` -- `"No tenant found"` or `"Business information incomplete"`

#### Chat Routes (`/api/chat`)

| Method | Path                   | Status | Error                 |
| ------ | ---------------------- | ------ | --------------------- |
| POST   | `/api/chat`            | 400    | Zod validation error  |
| POST   | `/api/chat`            | 404    | `"Invalid tenant"`    |
| POST   | `/api/chat`            | 500    | `"Chat error"`        |
| GET    | `.../config/:tenantId` | 404    | `"Tenant not found"`  |
| GET    | `.../config/:tenantId` | 500    | `"Failed to get cfg"` |

Chat POST 400 error details:

- Bad `tenant_id` format, empty message, or other Zod schema violations
- `"Chat error"` includes detail in dev mode only

#### Phone Config Routes (`/api/phone`)

| Method | Path                  | Status | Error                    |
| ------ | --------------------- | ------ | ------------------------ |
| GET    | `.../phone/available` | 500    | SignalWire search fail   |
| POST   | `.../phone/provision` | 400    | `"phoneNumber required"` |
| POST   | `.../phone/provision` | 403    | `"Forbidden"`            |
| POST   | `.../phone/provision` | 500    | `"Provision failed"`     |
| POST   | `.../phone/port`      | 400    | Missing port fields      |
| POST   | `.../phone/port`      | 403    | `"Forbidden"`            |
| GET    | `.../port/:id/status` | 403    | `"Forbidden"`            |
| GET    | `.../port/:id/status` | 404    | `"Port req not found"`   |

| Method | Path                 | Status | Error                   |
| ------ | -------------------- | ------ | ----------------------- |
| POST   | `.../phone/forward`  | 400    | number required or none |
| POST   | `.../phone/forward`  | 403    | `"Forbidden"`           |
| POST   | `.../verify-forward` | 403    | `"Forbidden"`           |
| POST   | `.../verify-forward` | 404    | `"No fwd config found"` |
| POST   | `.../phone/sip`      | 403    | `"Forbidden"`           |
| POST   | `.../phone/sip`      | 500    | `"SIP create failed"`   |
| GET    | `.../sip/status`     | 403    | `"Forbidden"`           |
| GET    | `.../sip/status`     | 404    | `"No SIP config found"` |

Phone forward 400 error details:

- `"business_number is required"` -- missing business phone number
- `"No numbers available in that area code"` -- no numbers found

---

## 4. Database Troubleshooting

### 4.1 Connection Pool Configuration

From `pool.ts` lines 6-9:

```
max: 20                       -- Maximum 20 simultaneous connections
idleTimeoutMillis: 30000      -- Close idle connections after 30 seconds
connectionTimeoutMillis: 5000 -- Fail if cannot connect within 5 seconds
```

### 4.2 Connection Pool Exhaustion

**Symptoms:** API requests hang for 5 seconds then fail with timeout errors. `waitingCount > 0` in health check.

**Diagnosis:**

```bash
# Check pool stats via health endpoint
curl -s http://localhost:3100/health | jq '.services.database'
# Look for: "poolStats": { "total": 20, "idle": 0, "waiting": 5 }

# Check active connections from PostgreSQL side
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();"

# Check for long-running queries
psql $DATABASE_URL -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' AND query NOT ILIKE '%pg_stat_activity%' ORDER BY duration DESC LIMIT 10;"
```

**Fix steps:**

1. Kill long-running queries: `SELECT pg_cancel_backend(pid);`
2. If under sustained load, increase pool max from 20 (edit `pool.ts` line 7)
3. Check for connection leaks -- ensure all transactions call `client.release()` (handled by `finally` blocks in `pool.ts`)
4. Restart the API if the pool is in a bad state: `docker restart api`

### 4.3 Slow Query Detection

The system automatically logs slow queries exceeding 100ms.

**Log format:**

```
[DB] Slow query (150ms): SELECT ... (truncated to 100 chars)
[DB] Slow tenant query (200ms): SELECT ... (truncated to 100 chars)
```

**Finding slow queries:**

```bash
# Find all slow queries in the last hour
docker logs api --since 1h 2>&1 | grep "Slow.*query"

# Find the slowest queries
docker logs api --since 24h 2>&1 | grep "Slow.*query" | sort -t'(' -k2 -rn | head -20
```

**Common slow query patterns:**

1. `SELECT * FROM calls WHERE ...` with date range filters -- add index on `(tenant_id, created_at)`
2. `SELECT COUNT(*) FROM contacts WHERE ...` with complex filters -- consider materialized views
3. Engagement score updates touching all contacts for all tenants -- already batched by tenant

### 4.4 RLS (Row-Level Security) Policy Issues

The system uses PostgreSQL RLS with `SET LOCAL ROLE app_api` and `set_config('app.tenant_id', ...)` for tenant isolation.

**Symptoms:** Queries return 0 rows unexpectedly, or "permission denied" errors.

**Diagnosis:**

```bash
# Check if RLS is enabled on a table
psql $DATABASE_URL -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;"

# Check RLS policies
psql $DATABASE_URL -c "SELECT * FROM pg_policies WHERE tablename = 'bookings';"

# Test tenant query isolation
psql $DATABASE_URL -c "
BEGIN;
SET LOCAL ROLE app_api;
SELECT set_config('app.tenant_id', '<tenant_id>', true);
SELECT count(*) FROM bookings;
ROLLBACK;
"
```

**Common issues:**

1. The `app_api` role does not exist -- run the migration that creates it
2. `app.tenant_id` is not set before the query -- this is handled by `tenantQuery()` in `pool.ts` line 155
3. RLS policy references a column that does not exist after migration
4. The `app_api` role lacks SELECT/INSERT/UPDATE/DELETE grants on the table

### 4.5 Migration Conflicts

**Symptoms:** API fails to start with migration errors, or data is missing after deploy.

**Diagnosis:**

```bash
# Check current migration state (Supabase)
# Migrations are in the supabase/migrations/ directory

# List applied migrations
psql $DATABASE_URL -c "SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;"
```

**Fix steps:**

1. Never modify an existing migration file -- create a new one
2. If a migration is partially applied, manually fix the database state and mark the migration as applied
3. Test migrations on a staging database before production

### 4.6 Dead Tuples and Table Bloat

**Diagnosis:**

```bash
# Check dead tuple count (high numbers = autovacuum may be lagging)
psql $DATABASE_URL -c "
SELECT relname, n_live_tup, n_dead_tup,
       round(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
"

# Check table sizes
psql $DATABASE_URL -c "
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
       pg_size_pretty(pg_relation_size(relid)) AS table_size,
       pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;
"
```

**Fix steps:**

1. Manual vacuum: `VACUUM ANALYZE <table_name>;`
2. Aggressive cleanup: `VACUUM FULL <table_name>;` (requires exclusive lock)
3. Tune autovacuum settings if dead tuples consistently grow

### 4.7 Index Bloat

**Diagnosis:**

```bash
# Estimate index bloat
psql $DATABASE_URL -c "
SELECT schemaname, tablename, indexname,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;
"
```

**Fix:** Rebuild bloated indexes:

```sql
REINDEX INDEX CONCURRENTLY <index_name>;
```

---

## 5. Authentication Troubleshooting

### 5.1 Authentication Flow

1. Client sends `Authorization: Bearer <JWT>` header
2. `authMiddleware()` extracts token (`auth.ts` line 173)
3. Token is verified against Supabase: `supabase.auth.getUser(token)` (`auth.ts` line 191)
4. If `X-Tenant-ID` header is present, tenant access is verified via `tenant_members` table (`auth.ts` line 217)
5. Auth context is set on the request: `{ user, userId, tenantId, role }`

### 5.2 JWT Expiration

**Symptom:** API returns 401 `"Invalid or expired token"`.

**Diagnosis:**

```bash
# Decode the JWT (base64) to check expiration
echo "<JWT>" | cut -d. -f2 | base64 -d 2>/dev/null | jq '.exp' | xargs -I{} date -d @{}
```

**Fix:** Refresh the token using Supabase's `auth.refreshSession()`. The Supabase client in `auth.ts` has `autoRefreshToken: false` so the application must handle refresh.

### 5.3 Token Refresh Failures

**Symptom:** Dashboard shows "Session expired" or repeatedly redirects to login.

**Common causes:**

1. Refresh token has expired (Supabase default: 1 week for refresh tokens)
2. User account was disabled or deleted
3. Network issue between dashboard and Supabase

**Fix:** User must re-authenticate (log in again).

### 5.4 CORS Issues

**Symptom:** Browser console shows "CORS policy: No 'Access-Control-Allow-Origin' header" errors.

The chat widget has permissive CORS (`chat.ts` lines 36-48):

```javascript
origin: (origin) => {
    const allowedOrigins = process.env.CHAT_ALLOWED_ORIGINS;
    if (!allowedOrigins) return origin; // Allow all
    ...
}
```

**Fix for API CORS:**

1. Check if `CHAT_ALLOWED_ORIGINS` is set and includes the requesting domain
2. For the dashboard, ensure `NEXT_PUBLIC_API_URL` points to the correct API URL
3. If using Nginx proxy, ensure it forwards CORS headers

### 5.5 Supabase Auth Errors

**Symptom:** Various auth errors from Supabase.

| Supabase Error        | Meaning              | Fix                     |
| --------------------- | -------------------- | ----------------------- |
| `Invalid JWT`         | Token is malformed   | Re-authenticate         |
| `JWT expired`         | Token has expired    | Refresh or re-auth      |
| `User not found`      | User was deleted     | Contact admin           |
| `Email not confirmed` | Not confirmed yet    | Check email for link    |
| `Invalid credentials` | Wrong email/password | Retry or reset password |

### 5.6 Tenant Access Denied

**Symptom:** API returns 403 `"You do not have access to this tenant"`.

**Diagnosis:**

```bash
# Check if the user is a member of the tenant
psql $DATABASE_URL -c "
SELECT tm.user_id, tm.tenant_id, tm.role, tm.is_active
FROM tenant_members tm
WHERE tm.user_id = '<user_id>' AND tm.tenant_id = '<tenant_id>';
"
```

**Common causes:**

1. User is not a member of the tenant
2. Membership `is_active` is false (removed from tenant)
3. Wrong `X-Tenant-ID` header value

**Fix:** Add the user as a member via `POST /api/tenants/:id/members` or directly in the database.

### 5.7 Role Permission Issues

**Three middleware types control access:**

1. `authMiddleware()` -- requires JWT + X-Tenant-ID + tenant membership
2. `userAuthMiddleware()` -- requires JWT only (X-Tenant-ID optional)
3. `requireRole(...roles)` -- requires specific role(s)

| Role     | Capabilities                   |
| -------- | ------------------------------ |
| `owner`  | Full access: tenants, members  |
| `admin`  | Settings, members (not owners) |
| `member` | Read/write CRM only, no admin  |

---

## 6. Integration Troubleshooting

### 6.1 Twilio SMS Failures

**Source file:** `lumentra-api/src/services/twilio/sms.ts`

**Symptoms:** SMS messages not sent, `status: "failed"` in sms_messages table.

**Diagnosis:**

```bash
# Check for SMS errors
docker logs api 2>&1 | grep "\[SMS\]"

# Check the sms_messages table for failed messages
psql $DATABASE_URL -c "SELECT id, to_phone, status, error_message, created_at FROM sms_messages WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10;"
```

**Common errors:**

| Error Message              | Cause                     | Fix                       |
| -------------------------- | ------------------------- | ------------------------- |
| `No TWILIO_PHONE_NUMBER`   | Missing env var           | Set `TWILIO_PHONE_NUMBER` |
| `Twilio client not config` | Missing SID or token      | Set both env vars         |
| `'To' number not valid`    | Invalid recipient number  | Include country code (+1) |
| `Message body is required` | Empty body (template err) | Check `templates.ts`      |
| `Number is unverified`     | Trial account limit       | Verify number or upgrade  |

**The SMS flow** (from `sms.ts`):

1. Create record in `sms_messages` with status `"pending"` (line 59)
2. Attempt immediate send via Twilio API (line 79)
3. On success: update to status `"sent"` with Twilio SID (line 86)
4. On failure: update to status `"failed"` with error message (line 100)

### 6.2 Google Calendar OAuth Issues

**Source file:** `lumentra-api/src/services/calendar/google.ts`

**Symptoms:** Calendar operations fail, booking sync stops working.

**Diagnosis:**

```bash
# Check for calendar errors
docker logs api 2>&1 | grep -i "calendar\|google\|oauth"

# Check integration status
psql $DATABASE_URL -c "SELECT provider, status, token_expires_at FROM tenant_integrations WHERE provider = 'google_calendar';"
```

**Common errors:**

| Error                     | Cause                 | Fix                       |
| ------------------------- | --------------------- | ------------------------- |
| `Token refresh failed`    | Refresh token invalid | Re-authorize in settings  |
| `401` from Google API     | Access token expired  | Re-authorize (marked exp) |
| `No refresh token`        | Incomplete OAuth flow | Redo OAuth authorization  |
| Missing `GOOGLE_CLIENT_*` | Env vars not set      | Set both env vars         |

**Token refresh flow** (`google.ts` lines 175-242):

1. On 401 error, `refreshToken()` is called
2. Sends POST to `https://oauth2.googleapis.com/token`
3. On success: updates `tenant_integrations` with new access token
4. On failure: marks integration as `"expired"` and throws error

### 6.3 SignalWire SIP Issues

**Source files:** `lumentra-api/src/services/signalwire/sip.ts`, `signalwire/phone.ts`

**Symptoms:** SIP endpoints not working, phone numbers not provisioning.

**Required environment variables:**

- `SIGNALWIRE_SPACE_URL`
- `SIGNALWIRE_PROJECT_ID`
- `SIGNALWIRE_API_TOKEN`

**Diagnosis:**

```bash
# Check SignalWire errors
docker logs api 2>&1 | grep "\[SIP\]\|\[SIGNALWIRE\]"

# Test SignalWire API connectivity
SPACE_URL="${SIGNALWIRE_SPACE_URL}"
PROJECT_ID="${SIGNALWIRE_PROJECT_ID}"
API_TOKEN="${SIGNALWIRE_API_TOKEN}"
curl -u "$PROJECT_ID:$API_TOKEN" "https://$SPACE_URL/api/laml/2010-04-01/Accounts/$PROJECT_ID/IncomingPhoneNumbers.json"
```

**Common errors:**

| Log Message               | Cause               | Fix                       |
| ------------------------- | ------------------- | ------------------------- |
| `[SIP] Failed to create`  | API rejected endpt  | Check creds and limits    |
| `[SIP] Failed to config`  | Routing config err  | Retry or use SW dashboard |
| `[SIGNALWIRE] Search err` | Phone search failed | Check creds and region    |
| `[SIGNALWIRE] Provision`  | Purchase failed     | Check balance and avail   |

### 6.4 LiveKit Connection Failures

**Symptoms:** Agent cannot connect to LiveKit server.

**Diagnosis:**

```bash
# Check LiveKit server status
docker ps | grep livekit
docker logs livekit 2>&1 | tail -50

# Test LiveKit API
curl http://localhost:7880/healthz

# Check agent's LiveKit connection
docker logs agent 2>&1 | grep -i "livekit\|connect\|websocket"

# Verify API key
# LiveKit API key: APIc4ecf671a4b0eab56ceb2cd4
```

**Common causes:**

1. LiveKit server not running
2. Wrong `LIVEKIT_URL` in agent environment (should be `ws://172.17.0.1:7880` for Docker, or `ws://localhost:7880` for host networking)
3. Wrong `LIVEKIT_API_KEY` or `LIVEKIT_API_SECRET`
4. Port 7880 blocked by firewall
5. Redis not running (LiveKit depends on Redis)

### 6.5 LLM Provider Failures (Chat Widget)

**Source file:** `lumentra-api/src/services/llm/multi-provider.ts`

The chat widget uses a three-provider fallback chain: Gemini -> OpenAI -> Groq.

**Diagnosis:**

```bash
# Check LLM provider status
curl -s http://localhost:3100/api/chat/health | jq

# Check which providers are configured
docker logs api 2>&1 | grep "\[LLM\] Provider status"
```

**Provider status at startup** (logged at `multi-provider.ts` lines 26-29):

```
[LLM] Provider status at startup:
  - Gemini: READY
  - OpenAI: READY
  - Groq: NOT CONFIGURED
```

**Common failures:**

| Provider | Error Pattern          | Fix                           |
| -------- | ---------------------- | ----------------------------- |
| Gemini   | `RESOURCE_EXHAUSTED`   | Rate limited; auto 5-min cool |
| OpenAI   | `429`                  | Rate limited; check usage     |
| Groq     | `rate`                 | Free tier 12k TPM, exhausted  |
| All      | `All providers failed` | Check keys; need at least one |

---

## 7. Background Job Troubleshooting

### 7.1 Job Schedule

From `scheduler.ts`:

| Job                | Schedule     | Function                 |
| ------------------ | ------------ | ------------------------ |
| Booking reminders  | Every 10 min | `processReminders()`     |
| Callbacks          | Every 5 min  | `processCallbacks()`     |
| Notification queue | Every 15 min | `processQueue()` + retry |
| Due reminders      | Every hour   | `sendDueReminders()`     |
| Engagement scores  | Every hour   | `updateAllScores()`      |
| Slot generation    | Midnight     | `generateDailySlots()`   |
| Slot cleanup       | Midnight     | `cleanupOldSlots()`      |
| Review requests    | 9 AM daily   | `sendReviewRequests()`   |

What each job does:

- **Booking reminders** -- SMS for bookings 24h away
- **Callbacks** -- Missed call callback queue
- **Notification queue** -- Process and retry notifications
- **Due reminders** -- 24h and 1h booking reminders
- **Engagement scores** -- Recalculate engagement scores
- **Slot generation** -- Create upcoming availability slots
- **Slot cleanup** -- Remove expired availability slots
- **Review requests** -- Review requests for completed bookings

### 7.2 Reminders Not Sending

**Source file:** `lumentra-api/src/jobs/reminders.ts`

**Diagnosis:**

```bash
# Check scheduler logs
docker logs api 2>&1 | grep "\[REMINDERS\]\|\[SCHEDULER\]"

# Check for bookings that should have been reminded
psql $DATABASE_URL -c "
SELECT id, customer_name, customer_phone, booking_date, booking_time, reminder_sent, status
FROM bookings
WHERE status IN ('pending', 'confirmed')
  AND reminder_sent = false
  AND booking_date = (CURRENT_DATE + INTERVAL '1 day')::date
ORDER BY booking_time;
"
```

**Common causes:**

1. **Scheduler not running:** The `startScheduler()` function was not called at startup
2. **Booking status wrong:** Reminders only process bookings with status `'confirmed'` (legacy) or `'pending'`/`'confirmed'` (new)
3. **Already reminded:** `reminder_sent = true` prevents duplicate reminders
4. **SMS sending failed:** Check Twilio configuration (see section 6.1)
5. **Contact has `do_not_sms: true`:** The `sendDueReminders()` checks this flag
6. **Time window mismatch:** The reminder window is 30 minutes wide -- if the job runs outside this window, bookings are missed

### 7.3 Engagement Scores Not Updating

**Source file:** `lumentra-api/src/jobs/engagement.ts`

**Diagnosis:**

```bash
# Check engagement job logs
docker logs api 2>&1 | grep "\[ENGAGEMENT\]"

# Check a contact's engagement score
psql $DATABASE_URL -c "
SELECT id, name, engagement_score, total_calls, total_bookings, last_contact_at
FROM contacts
WHERE tenant_id = '<tenant_id>'
ORDER BY engagement_score DESC
LIMIT 20;
"
```

**Score calculation** (from `engagement.ts` lines 80-117):

- **Recency (30 pts max):** Last contact within 30 days, more recent = higher
- **Frequency (30 pts max):** 5 points per booking, capped at 30
- **Completion rate (20 pts max):** Completion rate \* 20, minus 5 per no-show
- **Value (20 pts max):** $500+ lifetime value = full 20 points

**Common causes for wrong scores:**

1. `total_bookings` or `total_completed_bookings` counters are stale
2. `last_contact_at` is null (contact has never had a call/booking logged)
3. Contact status is not `'active'` -- only active contacts are scored

### 7.4 Callbacks Not Processing

**Source file:** `lumentra-api/src/jobs/callbacks.ts`

**Diagnosis:**

```bash
# Check callback job logs
docker logs api 2>&1 | grep "\[CALLBACKS\]"

# Check callback queue
psql $DATABASE_URL -c "
SELECT id, tenant_id, phone_number, status, attempts, last_attempt_at
FROM callback_queue
WHERE status = 'pending'
ORDER BY priority DESC, created_at ASC;
"
```

**Note:** Outbound calls via SignalWire API are **not yet implemented** (marked as TODO in `callbacks.ts` line 48). The job currently logs the callback and marks it as completed.

**Callbacks stuck in pending state:**

1. Check if `attempts < 3` -- callbacks with 3+ attempts are marked as failed
2. Check if the scheduler cron is running
3. The job processes a maximum of 10 callbacks per run

### 7.5 Cache Not Refreshing

**Source file:** `lumentra-api/src/services/database/tenant-cache.ts`

The tenant cache refreshes every 5 minutes (`REFRESH_INTERVAL_MS = 5 * 60 * 1000` at line 21).

**Diagnosis:**

```bash
# Check cache stats
curl -s http://localhost:3100/health | jq '.services.tenantCache'

# Check cache refresh logs
docker logs api 2>&1 | grep "\[CACHE\]"
```

**Common issues:**

1. `"initialized": false` -- cache failed to initialize at startup
2. `"lastRefresh": null` -- no successful refresh has occurred
3. Cache miss on new tenant -- wait up to 5 minutes or call `invalidateTenant(id)`
4. `[CACHE] Failed to refresh tenant cache: ...` -- database query failed during refresh

**Manual cache invalidation:**

There is no external endpoint for this. Changes to tenants via the API automatically call `invalidateTenant()`. For direct database changes, restart the API.

---

## 8. Performance Troubleshooting

### 8.1 High Memory Usage

**Diagnosis:**

```bash
# Check container memory usage
docker stats --no-stream

# Check Node.js heap usage (API)
docker exec api node -e "console.log(process.memoryUsage())"

# Check agent memory
docker exec agent python3 -c "import psutil; print(psutil.virtual_memory())"
```

**Docker memory limits** (from `docker-compose.yml`):

- API: 2GB limit, 512MB reservation
- Agent: 2GB limit, 512MB reservation
- Redis: No limit (Alpine image, minimal footprint)

**Common memory issues:**

1. **API:** Large tenant cache with many tenants (each tenant object can be 5-10KB)
2. **API:** Chat conversation store grows unbounded (in-memory `Map`)
3. **Agent:** Multiple concurrent calls (each call uses ~200-500MB for STT/LLM/TTS buffers)
4. **Agent:** VAD model loaded at prewarm (`agent.py` line 66) -- ~100MB

### 8.2 Slow API Responses

**Diagnosis:**

```bash
# Check for slow queries (>100ms)
docker logs api --since 1h 2>&1 | grep "Slow.*query" | wc -l

# Check database pool wait queue
curl -s http://localhost:3100/health | jq '.services.database'

# Profile a specific endpoint
time curl -s -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: $TENANT_ID" http://localhost:3100/api/calls/analytics
```

**Common bottlenecks:**

1. **Database connection pool exhausted:** `waitingCount > 0` in health check
2. **Slow analytics queries:** The `/api/calls/analytics` endpoint fetches all calls in a date range
3. **Contact search with complex filters:** Full-text search without proper indexes
4. **LLM provider latency in chat:** First provider timeout before fallback kicks in
5. **Tenant cache miss:** First request for a new tenant hits the database

### 8.3 Database Bottlenecks

**Diagnosis:**

```bash
# Check active queries
psql $DATABASE_URL -c "
SELECT pid, age(clock_timestamp(), query_start), usename, query, state
FROM pg_stat_activity
WHERE state != 'idle' AND query NOT ILIKE '%pg_stat_activity%'
ORDER BY query_start;
"

# Check index usage
psql $DATABASE_URL -c "
SELECT relname, seq_scan, idx_scan,
       CASE WHEN seq_scan + idx_scan > 0 THEN
           round(100.0 * idx_scan / (seq_scan + idx_scan), 2)
       ELSE 0 END AS idx_pct
FROM pg_stat_user_tables
WHERE seq_scan + idx_scan > 100
ORDER BY seq_scan DESC
LIMIT 20;
"

# Check for missing indexes
psql $DATABASE_URL -c "
SELECT relname, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
FROM pg_stat_user_tables
WHERE seq_scan > 100 AND seq_tup_read > 10000
ORDER BY seq_tup_read DESC
LIMIT 10;
"
```

**Recommended indexes based on query patterns in the code:**

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_tenant_created ON calls (tenant_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_tenant_date ON bookings (tenant_id, booking_date, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_tenant_phone ON contacts (tenant_id, phone);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_tenant_status ON contacts (tenant_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_callback_queue_status ON callback_queue (status, priority DESC, created_at);
```

### 8.4 Agent CPU Usage

**Diagnosis:**

```bash
# Check agent container CPU
docker stats agent --no-stream

# Check if multiple calls are active
docker logs agent 2>&1 | grep "Call started" | tail -5
docker logs agent 2>&1 | grep "Call.*logged\|room deleted\|Call ended" | tail -5
```

**CPU-intensive operations in the agent:**

1. **Silero VAD:** Prewarmed at startup, runs continuously during calls
2. **Noise cancellation:** `BVCTelephony()` runs on every audio frame
3. **Turn detection:** `MultilingualModel()` runs on every audio frame
4. **Multiple concurrent calls:** Each call runs STT/TTS/VAD simultaneously

**Optimization:**

1. Increase CPU limit from 2 to 4 if handling multiple concurrent calls
2. Consider running multiple agent instances behind a load balancer
3. Monitor the `metrics_collected` event for per-call resource usage

### 8.5 LiveKit Room Capacity

**Diagnosis:**

```bash
# Check active rooms
docker logs livekit 2>&1 | grep "room\|participant" | tail -20

# Check LiveKit server resource usage
docker stats livekit --no-stream
```

LiveKit's capacity depends on server resources. Each SIP call creates a room with 2 participants (caller + agent). With the current CCX13 server (4 vCPUs, 16GB RAM), approximately 20-30 concurrent calls are feasible.

---

## 9. Log Analysis Guide

### 9.1 Log Prefixes Reference

**API log prefixes:**

| Prefix         | Source File         | Component             |
| -------------- | ------------------- | --------------------- |
| `[DB]`         | `pool.ts`           | Database pool/queries |
| `[CACHE]`      | `tenant-cache.ts`   | Tenant cache ops      |
| `[INTERNAL]`   | `internal.ts`       | Internal API (agent)  |
| `[CALLS]`      | `calls.ts`          | Calls route handlers  |
| `[SMS]`        | `sms.ts`            | Twilio SMS sending    |
| `[SIP]`        | `sip.ts`            | SignalWire SIP mgmt   |
| `[SIGNALWIRE]` | `phone.ts`          | Phone provisioning    |
| `[CHAT]`       | `chat.ts`           | Chat widget requests  |
| `[LLM]`        | `multi-provider.ts` | Multi-provider LLM    |
| `[TOOLS]`      | `tools.ts`          | Voice tool execution  |
| `[AUTOMATION]` | `post-call.ts`      | Post-call automation  |
| `[REMINDERS]`  | `reminders.ts`      | Booking reminders     |
| `[CALLBACKS]`  | `callbacks.ts`      | Callback queue        |
| `[ENGAGEMENT]` | `engagement.ts`     | Engagement scores     |
| `[SCHEDULER]`  | `scheduler.ts`      | Job scheduler status  |
| `[SETUP]`      | `setup.ts`          | Setup wizard ops      |
| `[PHONE]`      | `phone-config.ts`   | Phone configuration   |

**Agent log prefixes:**

| Prefix              | Source File        | Component           |
| ------------------- | ------------------ | ------------------- |
| `lumentra-agent`    | `agent.py`         | Main agent process  |
| `...agent.tools`    | `tools.py`         | Agent tool calls    |
| `...agent.tenant`   | `tenant_config.py` | Tenant config fetch |
| `...agent.call_log` | `call_logger.py`   | Call logging to API |
| `...agent.api`      | `api_client.py`    | Internal API client |

### 9.2 Searching Logs Effectively

```bash
# API container logs
docker logs api 2>&1 | grep "<pattern>"

# Agent container logs
docker logs agent 2>&1 | grep "<pattern>"

# LiveKit logs
docker logs livekit 2>&1 | grep "<pattern>"

# SIP bridge logs
docker logs sip 2>&1 | grep "<pattern>"

# All logs from the last hour
docker logs api --since 1h 2>&1

# Follow logs in real-time
docker logs -f api 2>&1

# Combined pattern search across containers
for c in api agent livekit sip; do echo "=== $c ==="; docker logs $c --since 1h 2>&1 | grep "error\|Error\|ERROR" | tail -5; done
```

### 9.3 Common Log Patterns Indicating Problems

**Database issues:**

```
[DB] Unexpected pool error: ...     -- Pool-level connection error
[DB] Query failed (Xms): ...        -- Individual query failure
[DB] Slow query (Xms): ...          -- Performance warning (>100ms)
[DB] Slow tenant query (Xms): ...   -- Tenant-scoped slow query
```

**Authentication issues:**

```
[tenants] GET / error: ...           -- User listing failed
[tenants] POST / error: ...          -- Tenant creation failed
```

**Voice pipeline issues:**

```
No tenant found for number: ...      -- Agent can't find tenant
Tool <name> error: ...               -- Tool execution failed
SIP transfer failed: ...             -- Call transfer failed
Call logging timed out for ...       -- Post-call logging slow
Call logging failed for ...          -- Post-call logging error
Duration limit reached ...           -- Call time exceeded
```

**Integration issues:**

```
[SMS] No TWILIO_PHONE_NUMBER ...     -- SMS not configured
[SMS] Failed to send: ...            -- SMS delivery error
[SIP] Failed to create endpoint: ... -- SignalWire SIP error
[LLM] All providers failed: ...      -- Complete LLM failure
[LLM] <provider> rate limited, ...   -- Provider throttled
```

**Job issues:**

```
[SCHEDULER] <job> failed: ...        -- Background job crash
[REMINDERS] Failed for booking ...   -- Individual reminder failure
[CALLBACKS] Failed for ...           -- Callback processing error
[ENGAGEMENT] Failed for tenant ...   -- Score calculation error
```

### 9.4 Docker Log Configuration

From `docker-compose.yml`, logging is configured as:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "50m" # API: 50MB per file
    max-file: "3" # Keep 3 rotated files (150MB total)
```

LiveKit, SIP, and Agent use 20MB per file with 3 files (60MB total each).

**Viewing older logs:**

```bash
# Docker stores logs at:
# /var/lib/docker/containers/<container_id>/<container_id>-json.log
# Rotated files: ...-json.log.1, ...-json.log.2

# Find container log files
docker inspect api --format='{{.LogPath}}'
```

---

## 10. Network Troubleshooting

### 10.1 Required Ports

**TCP Ports:**

| Port | Service     | Direction | Notes                 |
| ---- | ----------- | --------- | --------------------- |
| 22   | SSH         | Inbound   | Server access         |
| 80   | HTTP/Nginx  | Inbound   | Redirects to 443      |
| 443  | HTTPS/Nginx | Inbound   | Dashboard + API       |
| 3000 | Dashboard   | Internal  | Next.js dashboard     |
| 3100 | API         | Both      | Hono API server       |
| 6379 | Redis       | Internal  | localhost only        |
| 7880 | LiveKit API | Inbound   | LiveKit HTTP API      |
| 7881 | LiveKit WS  | Inbound   | LiveKit WebSocket API |
| 8000 | Coolify     | Inbound   | Coolify admin panel   |

**UDP/TCP Ports:**

| Port        | Protocol | Service    | Direction | Notes          |
| ----------- | -------- | ---------- | --------- | -------------- |
| 5060        | UDP/TCP  | SIP        | Inbound   | SignalWire SIP |
| 10000-20000 | UDP      | RTP        | Both      | Voice media    |
| 50000-60000 | UDP      | WebRTC ICE | Both      | ICE candidates |

### 10.2 Firewall Verification

```bash
# Check Hetzner firewall rules (via hcloud CLI)
~/.local/bin/hcloud firewall describe lumentra-voice

# Check UFW rules
sudo ufw status verbose

# Test specific port connectivity from outside
# (Run from a different machine)
nc -z -v 178.156.205.145 3100
nc -z -v -u 178.156.205.145 5060
```

### 10.3 DNS Resolution

```bash
# Check DNS resolution from the server
dig +short sip.signalwire.com
dig +short api.deepgram.com
dig +short api.openai.com
dig +short api.cartesia.ai

# Check DNS resolution from inside Docker
docker exec api nslookup sip.signalwire.com
```

### 10.4 WebSocket Failures

**Symptoms:** Dashboard real-time features not working, LiveKit connection drops.

```bash
# Test WebSocket connectivity to LiveKit
# From the server:
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:7880/

# Check if reverse proxy is passing WebSocket headers
# Nginx must have:
#   proxy_set_header Upgrade $http_upgrade;
#   proxy_set_header Connection "upgrade";
```

### 10.5 SIP NAT Traversal

**Symptoms:** SIP calls connect but audio does not flow (one-way or no audio).

SIP with NAT requires that the public IP is correctly advertised in SDP.

```bash
# Check LiveKit's advertised IP
docker logs livekit 2>&1 | grep -i "node_ip\|advertise\|public"

# Verify the server's public IP
curl -s ifconfig.me

# Check if the SIP bridge is using the correct IP
docker logs sip 2>&1 | grep -i "ip\|address\|bind"
```

**Fix:** Ensure LiveKit configuration includes the correct public IP. In the LiveKit config (`livekit.yaml`), set:

```yaml
rtc:
  use_external_ip: true
```

### 10.6 ICE/TURN Failures

**Symptoms:** WebRTC connections fail. ICE gathering times out.

```bash
# Check LiveKit ICE configuration
docker logs livekit 2>&1 | grep -i "ice\|turn\|stun"

# Verify ICE port range is open
for port in $(seq 50000 50010); do
    nc -z -u -w1 localhost $port && echo "Port $port open" || echo "Port $port closed"
done
```

**Fix:**

1. Ensure ports 50000-60000 are open for UDP
2. Configure a TURN server if behind symmetric NAT
3. LiveKit with `network_mode: host` should handle ICE correctly

---

## 11. Disaster Recovery Procedures

### 11.1 Database Corruption

**Symptoms:** PostgreSQL errors, data inconsistency, failed queries.

**Immediate steps:**

1. Stop the API to prevent further writes: `docker stop api`
2. Take a backup of the current state: `pg_dump $DATABASE_URL > /tmp/emergency_backup_$(date +%Y%m%d_%H%M%S).sql`
3. Check PostgreSQL for corruption: `psql $DATABASE_URL -c "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public';"`

**Recovery options:**

1. **Restore from Supabase backup:** Supabase maintains automatic backups. Use the Supabase dashboard to restore.
2. **Point-in-time recovery:** If using Supabase Pro, PITR is available.
3. **Manual repair:** Fix specific corrupted rows/tables based on error messages.

### 11.2 Server Crash Recovery

**If the server is unreachable:**

1. Access the Hetzner console: `hcloud server console Lumentra-ubuntu`
2. If the server is stuck, power cycle: `hcloud server reset Lumentra-ubuntu`
3. After reboot:

```bash
# SSH back in
ssh -i ~/.ssh/id_ed25519 root@178.156.205.145

# Check if services auto-started (docker restart: unless-stopped)
docker ps

# If Coolify services didn't start
cd /opt/coolify && docker compose up -d

# If LiveKit stack didn't start
cd /opt/livekit && docker compose up -d

# Check SSH is enabled (was disabled on boot once before)
systemctl status ssh
systemctl enable ssh
```

### 11.3 Total Data Loss Recovery

**Prerequisites:**

- Supabase project still exists (database is hosted there)
- Docker images can be rebuilt from Git repository
- Environment variables are documented

**Rebuilding from scratch:**

```bash
# 1. Provision new server (or use existing)
# 2. Install Docker and Docker Compose
# 3. Clone the repository
git clone <repo> /opt/callagent
cd /opt/callagent

# 4. Set up environment variables
cp .env.example .env
# Edit .env with all required values

# 5. Build and start services
docker compose up -d --build

# 6. Verify database connectivity
curl http://localhost:3100/health

# 7. Set up Coolify if needed (port 8000)
# Follow Coolify installation guide

# 8. Set up LiveKit stack
# Configure livekit.yaml and sip.yaml
# Start with docker compose

# 9. Verify voice calls
# Test a call to the configured number
```

### 11.4 Recovering from Bad Deployment

```bash
# Roll back to previous Docker image
docker compose down
git log --oneline -5  # Find the previous good commit
git checkout <good_commit>
docker compose up -d --build

# Or use Coolify's deployment history to redeploy a previous version
```

---

## 12. Health Check Script

Save this as `/opt/lumentra/healthcheck.sh` and run with `bash /opt/lumentra/healthcheck.sh`:

```bash
#!/usr/bin/env bash
# Lumentra Platform Health Check Script
# Checks all components and reports status
# Usage: bash healthcheck.sh [--verbose]

set -euo pipefail

VERBOSE="${1:-}"
API_URL="http://localhost:3100"
LIVEKIT_URL="http://localhost:7880"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
ERRORS=0
WARNINGS=0

check() {
    local name="$1"
    local status="$2"
    if [ "$status" = "OK" ]; then
        echo -e "  ${GREEN}[OK]${NC} $name"
    elif [ "$status" = "WARN" ]; then
        echo -e "  ${YELLOW}[WARN]${NC} $name"
        ((WARNINGS++))
    else
        echo -e "  ${RED}[FAIL]${NC} $name"
        ((ERRORS++))
    fi
}

echo "======================================"
echo "  Lumentra Platform Health Check"
echo "  $(date -Iseconds)"
echo "======================================"
echo ""

# 1. Docker containers
echo "--- Docker Containers ---"
for container in api agent livekit sip redis; do
    status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "not_found")
    if [ "$status" = "running" ]; then
        restarts=$(docker inspect --format='{{.RestartCount}}' "$container" 2>/dev/null || echo "0")
        if [ "$restarts" -gt 5 ]; then
            check "$container (running, $restarts restarts)" "WARN"
        else
            check "$container (running)" "OK"
        fi
    elif [ "$status" = "not_found" ]; then
        check "$container (not found)" "FAIL"
    else
        check "$container ($status)" "FAIL"
    fi
done
echo ""

# 2. API Health
echo "--- API Health ---"
api_health=$(curl -sf "$API_URL/health" 2>/dev/null || echo '{"status":"unreachable"}')
api_status=$(echo "$api_health" | jq -r '.status' 2>/dev/null || echo "unreachable")
if [ "$api_status" = "healthy" ]; then
    check "API status: healthy" "OK"
    latency=$(echo "$api_health" | jq -r '.latency' 2>/dev/null || echo "unknown")
    check "API latency: $latency" "OK"
elif [ "$api_status" = "degraded" ]; then
    check "API status: degraded" "WARN"
else
    check "API status: $api_status" "FAIL"
fi

# Ping check
ping_status=$(curl -sf "$API_URL/health/ping" 2>/dev/null || echo "failed")
if [ "$ping_status" = "pong" ]; then
    check "API ping: pong" "OK"
else
    check "API ping: failed" "FAIL"
fi
echo ""

# 3. Database
echo "--- Database ---"
db_connected=$(echo "$api_health" | jq -r '.services.database.connected' 2>/dev/null || echo "false")
db_latency=$(echo "$api_health" | jq -r '.services.database.latency' 2>/dev/null || echo "N/A")
if [ "$db_connected" = "true" ]; then
    check "Database connected (${db_latency}ms)" "OK"
else
    db_error=$(echo "$api_health" | jq -r '.services.database.error' 2>/dev/null || echo "unknown")
    check "Database disconnected: $db_error" "FAIL"
fi
echo ""

# 4. Tenant Cache
echo "--- Tenant Cache ---"
cache_init=$(echo "$api_health" | jq -r '.services.tenantCache.initialized' 2>/dev/null || echo "false")
cache_size=$(echo "$api_health" | jq -r '.services.tenantCache.size' 2>/dev/null || echo "0")
cache_refresh=$(echo "$api_health" | jq -r '.services.tenantCache.lastRefresh' 2>/dev/null || echo "null")
if [ "$cache_init" = "true" ]; then
    check "Cache initialized ($cache_size tenants)" "OK"
    if [ "$cache_refresh" != "null" ]; then
        check "Last refresh: $cache_refresh" "OK"
    else
        check "Never refreshed" "WARN"
    fi
else
    check "Cache not initialized" "WARN"
fi
echo ""

# 5. Redis
echo "--- Redis ---"
redis_ping=$(docker exec redis redis-cli ping 2>/dev/null || echo "failed")
if [ "$redis_ping" = "PONG" ]; then
    check "Redis: PONG" "OK"
else
    check "Redis: $redis_ping" "FAIL"
fi
echo ""

# 6. LiveKit
echo "--- LiveKit ---"
livekit_health=$(curl -sf "$LIVEKIT_URL/healthz" 2>/dev/null || echo "unreachable")
if echo "$livekit_health" | grep -qi "ok\|healthy\|200" 2>/dev/null; then
    check "LiveKit server: healthy" "OK"
else
    check "LiveKit server: $livekit_health" "FAIL"
fi
echo ""

# 7. Network ports
echo "--- Network Ports ---"
for port in 3100 5060 7880 8000; do
    if ss -tlnp 2>/dev/null | grep -q ":${port} " || ss -ulnp 2>/dev/null | grep -q ":${port} "; then
        check "Port $port: listening" "OK"
    else
        check "Port $port: not listening" "FAIL"
    fi
done
echo ""

# 8. Disk space
echo "--- Disk Space ---"
disk_usage=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$disk_usage" -lt 80 ]; then
    check "Disk usage: ${disk_usage}%" "OK"
elif [ "$disk_usage" -lt 90 ]; then
    check "Disk usage: ${disk_usage}%" "WARN"
else
    check "Disk usage: ${disk_usage}%" "FAIL"
fi

docker_size=$(docker system df --format '{{.Size}}' 2>/dev/null | head -1 || echo "unknown")
check "Docker images: $docker_size" "OK"
echo ""

# 9. Memory
echo "--- Memory ---"
mem_total=$(free -m | awk '/^Mem:/ {print $2}')
mem_used=$(free -m | awk '/^Mem:/ {print $3}')
mem_pct=$((mem_used * 100 / mem_total))
if [ "$mem_pct" -lt 80 ]; then
    check "Memory: ${mem_used}MB / ${mem_total}MB (${mem_pct}%)" "OK"
elif [ "$mem_pct" -lt 90 ]; then
    check "Memory: ${mem_used}MB / ${mem_total}MB (${mem_pct}%)" "WARN"
else
    check "Memory: ${mem_used}MB / ${mem_total}MB (${mem_pct}%)" "FAIL"
fi
echo ""

# 10. Recent errors
echo "--- Recent Errors (last 30 min) ---"
api_errors=$(docker logs api --since 30m 2>&1 | grep -ic "error\|Error\|ERROR" 2>/dev/null || echo "0")
agent_errors=$(docker logs agent --since 30m 2>&1 | grep -ic "error\|Error\|ERROR" 2>/dev/null || echo "0")
if [ "$api_errors" -lt 5 ]; then
    check "API errors: $api_errors" "OK"
elif [ "$api_errors" -lt 20 ]; then
    check "API errors: $api_errors" "WARN"
else
    check "API errors: $api_errors" "FAIL"
fi
if [ "$agent_errors" -lt 5 ]; then
    check "Agent errors: $agent_errors" "OK"
elif [ "$agent_errors" -lt 20 ]; then
    check "Agent errors: $agent_errors" "WARN"
else
    check "Agent errors: $agent_errors" "FAIL"
fi
echo ""

# 11. Chat LLM providers
echo "--- LLM Providers (Chat) ---"
chat_health=$(curl -sf "$API_URL/api/chat/health" 2>/dev/null || echo '{}')
for provider in gemini openai groq; do
    provider_status=$(echo "$chat_health" | jq -r ".providers.${provider}.status" 2>/dev/null || echo "unknown")
    provider_model=$(echo "$chat_health" | jq -r ".providers.${provider}.model" 2>/dev/null || echo "null")
    if [ "$provider_status" = "available" ]; then
        check "$provider: $provider_status ($provider_model)" "OK"
    elif [ "$provider_model" = "null" ]; then
        check "$provider: not configured" "WARN"
    else
        check "$provider: $provider_status" "FAIL"
    fi
done
echo ""

# Summary
echo "======================================"
if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    echo -e "  ${GREEN}All checks passed${NC}"
elif [ "$ERRORS" -eq 0 ]; then
    echo -e "  ${YELLOW}$WARNINGS warning(s), 0 failures${NC}"
else
    echo -e "  ${RED}$ERRORS failure(s), $WARNINGS warning(s)${NC}"
fi
echo "======================================"

exit $ERRORS
```

---

## 13. Common Post-Deployment Issues

### 13.1 First-Time Setup Gotchas

**Problem:** API starts but returns 500 on all routes.
**Cause:** `DATABASE_URL` not set or database unreachable.
**Fix:** Set `DATABASE_URL` and verify connectivity: `psql $DATABASE_URL -c "SELECT 1;"`

**Problem:** API starts but auth always fails.
**Cause:** Missing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY`.
**Fix:** Set all three environment variables from the Supabase dashboard.

**Problem:** Voice calls connect but no agent response.
**Cause:** `INTERNAL_API_KEY` mismatch between agent and API.
**Fix:** Set identical `INTERNAL_API_KEY` in both environments.

**Problem:** Agent logs "Using OpenAI gpt-4.1-mini" but tool calls fail.
**Cause:** `OPENAI_API_KEY` works for the LLM but the API's `INTERNAL_API_KEY` is wrong.
**Fix:** Check both the LLM API key and the internal API key.

**Problem:** Chat widget shows "No response" or "Error".
**Cause:** No LLM API keys are configured (Gemini, OpenAI, or Groq).
**Fix:** Set at least one of `GEMINI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`.

### 13.2 Missing Environment Variables

Complete list of environment variables with their purpose:

**Required:**

| Variable                    | Used By     | Purpose                   |
| --------------------------- | ----------- | ------------------------- |
| `DATABASE_URL`              | API         | PostgreSQL connection     |
| `SUPABASE_URL`              | API         | Supabase project URL      |
| `SUPABASE_ANON_KEY`         | API         | Anon key (JWT verify)     |
| `SUPABASE_SERVICE_ROLE_KEY` | API         | Service key (bypass RLS)  |
| `INTERNAL_API_KEY`          | API + Agent | Shared agent-API secret   |
| `LIVEKIT_API_KEY`           | Agent       | LiveKit server API key    |
| `LIVEKIT_API_SECRET`        | Agent       | LiveKit server API secret |
| `LIVEKIT_URL`               | Agent       | LiveKit WS URL            |
| `INTERNAL_API_URL`          | Agent       | API base URL for agent    |
| `OPENAI_API_KEY`            | Both        | OpenAI key (voice + chat) |
| `DEEPGRAM_API_KEY`          | Agent       | Deepgram API key (STT)    |
| `CARTESIA_API_KEY`          | Agent       | Cartesia API key (TTS)    |

**Optional (part 1 -- LLM and messaging):**

| Variable              | Used By | Purpose              | Default                |
| --------------------- | ------- | -------------------- | ---------------------- |
| `GEMINI_API_KEY`      | API     | Gemini (chat LLM)    | None (skipped)         |
| `GEMINI_MODEL`        | API     | Gemini model name    | `gemini-2.5-flash`     |
| `OPENAI_MODEL`        | API     | OpenAI chat model    | `gpt-4o-mini`          |
| `GROQ_API_KEY`        | API     | Groq (chat fallback) | None (skipped)         |
| `GROQ_CHAT_MODEL`     | API     | Groq chat model      | `llama-3.1-8b-instant` |
| `GROQ_TOOL_MODEL`     | API     | Groq tool model      | `llama-3.3-70b`        |
| `TWILIO_ACCOUNT_SID`  | API     | Twilio SID (SMS)     | None (SMS off)         |
| `TWILIO_AUTH_TOKEN`   | API     | Twilio auth token    | None (SMS off)         |
| `TWILIO_PHONE_NUMBER` | API     | Twilio from number   | None (SMS off)         |

**Optional (part 2 -- integrations and config):**

| Variable                | Used By | Purpose              | Default                 |
| ----------------------- | ------- | -------------------- | ----------------------- |
| `SIGNALWIRE_PROJECT_ID` | API     | SignalWire project   | None                    |
| `SIGNALWIRE_API_TOKEN`  | API     | SignalWire token     | None                    |
| `SIGNALWIRE_SPACE_URL`  | API     | SignalWire space URL | None                    |
| `SIGNALWIRE_WEBHOOK_*`  | API     | Webhook secret       | None                    |
| `GOOGLE_CLIENT_ID`      | API     | Google OAuth ID      | None                    |
| `GOOGLE_CLIENT_SECRET`  | API     | Google OAuth secret  | None                    |
| `CHAT_ALLOWED_ORIGINS`  | API     | Allowed CORS origins | All origins             |
| `BACKEND_URL`           | API     | Public API URL       | `http://localhost:3100` |
| `NODE_ENV`              | Both    | Environment mode     | `development`           |
| `PORT`                  | API     | API listen port      | `3100`                  |

### 13.3 Wrong Permissions

**Problem:** Agent cannot write to Docker socket.
**Fix:** Ensure the user running Docker has the `docker` group: `usermod -aG docker <user>`

**Problem:** LiveKit config files not readable.
**Fix:** Check file permissions on mounted volumes:

```bash
ls -la /opt/livekit/livekit.yaml
ls -la /opt/livekit/sip.yaml
chmod 644 /opt/livekit/*.yaml
```

**Problem:** SSL certificates not readable by Nginx.
**Fix:** Check cert permissions:

```bash
ls -la /etc/nginx/certs/
chmod 644 /etc/nginx/certs/*.pem
chmod 600 /etc/nginx/certs/*.key
```

### 13.4 DNS Propagation Delays

**Problem:** Domain points to old IP after server migration.

**Diagnosis:**

```bash
# Check DNS propagation
dig +short your-domain.com
dig +short your-domain.com @8.8.8.8
dig +short your-domain.com @1.1.1.1

# Check TTL
dig your-domain.com | grep TTL
```

**Fix:** Wait for TTL to expire. Force local DNS refresh:

```bash
# Linux
sudo systemd-resolve --flush-caches

# macOS
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

### 13.5 Docker Networking Issues

**Problem:** Agent cannot reach API at `http://api:3100`.

**Diagnosis:**

```bash
# Check if containers are on the same network
docker network inspect lumentra-network

# Test connectivity from agent to API
docker exec agent python3 -c "import httpx; print(httpx.get('http://api:3100/health').json())"
```

**Common causes:**

1. Containers are not on the same Docker network
2. The API container name changed (default is `api` from docker-compose)
3. Using `network_mode: host` on some containers breaks Docker DNS resolution

**Fix:** Ensure all containers that need to communicate are on the same Docker network. The `docker-compose.yml` creates `lumentra-network` by default.

### 13.6 Docker Compose Variable Expansion

**CRITICAL NOTE from MEMORY.md:** Do NOT use `${VAR}` syntax in docker-compose files that are written over SSH. The local shell expands them to empty strings.

Instead, use `env_file: .env` in the docker-compose, and put variables in a `.env` file:

```yaml
# WRONG (over SSH):
environment:
  - INTERNAL_API_KEY=${INTERNAL_API_KEY} # Becomes empty!

# RIGHT:
env_file: .env
```

### 13.7 Coolify Deployment

The API and Dashboard are deployed via Coolify (port 8000).

**Coolify deploy command (via SSH):**

```bash
docker exec coolify php artisan tinker --execute="\$app = App\Models\Application::where('uuid', '<UUID>')->first(); \$result = queue_application_deployment(application: \$app, deployment_uuid: (string) Str::uuid(), force_rebuild: false); echo json_encode(\$result);"
```

**UUIDs:**

- API: `scog8ocs4884cos8gscw0kss`
- Dashboard: `hc44wc84swwo80s8k4gw88oo`

**Note:** Coolify API auth tokens are broken in the installed version. Use the artisan tinker command above instead.

**Coolify container networking:** API runs on the Coolify network at `10.0.1.5:3100`. The LiveKit agent must use this IP (not `localhost`) to reach the API when the agent runs outside the Coolify network.

### 13.8 Post-Deployment Verification Checklist

After any deployment, verify the following:

1. **API health:** `curl -s http://localhost:3100/health | jq .status` should return `"healthy"`
2. **Ping:** `curl -s http://localhost:3100/health/ping` should return `pong`
3. **Database:** Health endpoint shows `database.connected: true`
4. **Tenant cache:** Health endpoint shows `tenantCache.initialized: true`
5. **Chat LLM providers:** `curl -s http://localhost:3100/api/chat/health | jq .providers` shows at least one available
6. **Agent running:** `docker ps | grep agent` shows running
7. **LiveKit running:** `docker ps | grep livekit` shows running
8. **SIP running:** `docker ps | grep sip` shows running
9. **Redis running:** `docker exec redis redis-cli ping` returns PONG
10. **Test call:** Make a test call to the configured number and verify greeting plays
11. **Test chat:** Send a test message via the chat widget
12. **Test booking:** Create a test booking via the API
13. **Check logs:** `docker logs api --since 5m 2>&1 | grep -c ERROR` should be 0

---

## Appendix A: Quick Reference Commands

### View All Container Statuses

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Restart All Services

```bash
docker compose down && docker compose up -d
```

### View Combined Error Logs

```bash
for c in api agent livekit sip; do
    echo "=== $c ==="
    docker logs "$c" --since 1h 2>&1 | grep -i "error\|fail\|crash" | tail -10
    echo ""
done
```

### Check Resource Usage

```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
```

### Force Rebuild and Restart

```bash
docker compose build --no-cache && docker compose up -d
```

### Database Quick Checks

```bash
# Connection count
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Table sizes
psql $DATABASE_URL -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 10;"

# Active queries
psql $DATABASE_URL -c "SELECT pid, query_start, state, query FROM pg_stat_activity WHERE state = 'active' AND query NOT LIKE '%pg_stat%';"
```

### Voice Pipeline Quick Checks

```bash
# Agent status
docker logs agent --since 5m 2>&1 | tail -20

# Recent calls
docker logs agent --since 1h 2>&1 | grep "Call started\|Call.*logged\|room deleted"

# Tool usage
docker logs agent --since 1h 2>&1 | grep "Tool called\|Tool.*result\|Tool.*error"
```

---

## Appendix B: Environment Variable Validation Script

```bash
#!/usr/bin/env bash
# Validates all required environment variables are set
# Usage: source .env && bash validate-env.sh

MISSING=0

check_var() {
    local name="$1"
    local required="$2"
    local value="${!name}"

    if [ -z "$value" ]; then
        if [ "$required" = "required" ]; then
            echo "MISSING (required): $name"
            ((MISSING++))
        else
            echo "NOT SET (optional): $name"
        fi
    else
        local masked="${value:0:4}...${value: -4}"
        echo "SET: $name = $masked"
    fi
}

echo "=== Required Variables ==="
check_var DATABASE_URL required
check_var SUPABASE_URL required
check_var SUPABASE_ANON_KEY required
check_var SUPABASE_SERVICE_ROLE_KEY required
check_var INTERNAL_API_KEY required
check_var LIVEKIT_API_KEY required
check_var LIVEKIT_API_SECRET required
check_var OPENAI_API_KEY required
check_var DEEPGRAM_API_KEY required
check_var CARTESIA_API_KEY required

echo ""
echo "=== Optional Variables ==="
check_var GEMINI_API_KEY optional
check_var GROQ_API_KEY optional
check_var TWILIO_ACCOUNT_SID optional
check_var TWILIO_AUTH_TOKEN optional
check_var TWILIO_PHONE_NUMBER optional
check_var SIGNALWIRE_PROJECT_ID optional
check_var SIGNALWIRE_API_TOKEN optional
check_var SIGNALWIRE_SPACE_URL optional
check_var GOOGLE_CLIENT_ID optional
check_var GOOGLE_CLIENT_SECRET optional

echo ""
if [ "$MISSING" -gt 0 ]; then
    echo "ERROR: $MISSING required variable(s) missing!"
    exit 1
else
    echo "All required variables are set."
fi
```
