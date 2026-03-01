# Lumentra - Project Handoff

**Date:** 2026-03-01 (updated)
**Project:** Lumentra Voice Agent Platform
**Status:** Fully migrated to LiveKit Agents, old custom pipeline removed

---

## What This Is

Lumentra is a multi-tenant voice AI platform that answers phone calls for businesses 24/7. It handles bookings, FAQs, escalations, and CRM - all through natural voice conversation.

The system consists of two main applications:

1. **lumentra-api** - Node.js/Hono backend with REST API, tool execution, phone provisioning, and internal API for the voice agent
2. **lumentra-agent** - Python LiveKit Agents service handling voice calls (Deepgram STT, OpenAI LLM, Cartesia TTS)
3. **lumentra-dashboard** - Next.js 16 frontend with setup wizard, CRM, call management, analytics, and settings

---

## Handoff Documents

| Document                           | Description                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, tech stack, data flow, and service breakdown                   |
| [DEPLOYMENT.md](DEPLOYMENT.md)     | How to run locally, deploy to production, and manage the infrastructure             |
| [ENV-SETUP.md](ENV-SETUP.md)       | Every environment variable, what it does, and which third-party accounts are needed |
| [KNOWN-ISSUES.md](KNOWN-ISSUES.md) | Current bugs, limitations, and what remains to be done                              |
| [WORK-LOG.md](WORK-LOG.md)         | Detailed daily work log with commit history and hour estimates                      |

---

## Quick Start

```bash
# API
cd lumentra-api
cp .env.example .env   # Fill in all values (see ENV-SETUP.md)
npm install
npm run dev             # Runs on port 3100

# Dashboard
cd lumentra-dashboard
cp .env.example .env   # Fill in values
npm install
npm run dev             # Runs on port 3000
```

For voice calls to work, the API must be publicly accessible (ngrok or deployed server) because telephony webhooks need to reach it.

---

## Codebase Stats

- **132 commits** across 17 working days (Jan 9 - Feb 26, 2026)
- **~108 estimated hours** of development work
- **32,634 lines** of API source code (TypeScript)
- **54,557 lines** of dashboard source code (TypeScript/React)
- **104 API source files** across 27 service modules
- **233 dashboard source files** with 150+ React components
- **17 database migrations** for PostgreSQL via Supabase

---

## Third-Party Services Required

| Service       | Purpose                        | Required    |
| ------------- | ------------------------------ | ----------- |
| Supabase      | Database (PostgreSQL) + Auth   | Yes         |
| Deepgram      | Speech-to-text (STT)           | Yes         |
| Cartesia      | Text-to-speech (TTS)           | Yes         |
| SignalWire    | Telephony (inbound calls, SIP) | Yes         |
| OpenAI        | LLM for voice conversations    | Yes         |
| Groq          | LLM fallback provider          | Recommended |
| Google Gemini | LLM fallback + chat widget     | Recommended |
| Twilio        | SMS confirmations              | Optional    |
| Resend        | Email notifications            | Optional    |

---

## What Works

- Full setup wizard that configures a tenant from scratch
- Multi-tenant architecture with tenant isolation
- Inbound call handling via LiveKit Agents (SignalWire SIP -> LiveKit -> Python agent)
- Voice pipeline: Deepgram STT (nova-3) -> OpenAI LLM (gpt-4.1-mini) -> Cartesia TTS (Sonic-3)
- Tool calling for bookings, availability checks, orders, escalation
- SIP REFER transfer to human agents
- Call logging with transcripts and duration tracking
- CRM with contacts, call history, analytics
- Dashboard with settings, call logs, notifications
- Chat widget with multi-provider LLM (Gemini -> GPT -> Groq)
- CI/CD pipeline via GitHub Actions
- Docker Compose for deployment

## Voice Architecture (LiveKit Agents)

### New voice architecture

```
Caller -> SignalWire -> SIP (port 5060) -> LiveKit SIP Bridge -> LiveKit Room -> Python Agent
                                                                                    |
                                                                          lumentra-api (10.0.1.5:3100)
                                                                                    |
                                                                              Supabase DB
```

### New service: lumentra-agent/ (Python)

| File               | What                                                               |
| ------------------ | ------------------------------------------------------------------ |
| `agent.py`         | Entrypoint, session setup, voice pipeline config                   |
| `tools.py`         | LLM tools (check_availability, create_booking, SIP transfer, etc.) |
| `call_logger.py`   | Posts call transcript + duration to lumentra-api                   |
| `tenant_config.py` | Fetches tenant config from internal API by phone number            |
| `api_client.py`    | Shared httpx client for internal API communication                 |
| `Dockerfile`       | Builds agent image with turn detector model baked in               |

### Server-side files (not in repo)

| File                               | What                                              |
| ---------------------------------- | ------------------------------------------------- |
| `/opt/livekit/docker-compose.yml`  | All LiveKit services (redis, livekit, sip, agent) |
| `/opt/livekit/.env`                | API keys (Deepgram, OpenAI, Cartesia, Internal)   |
| `/opt/livekit/config/livekit.yaml` | LiveKit server config + API key/secret            |
| `/opt/livekit/config/sip.yaml`     | SIP bridge config                                 |

### LiveKit IDs

- **API key:** APIc4ecf671a4b0eab56ceb2cd4
- **SIP trunk ID:** ST_SUJtKjT9TEgv (+19458001233)
- **Dispatch rule ID:** SDR_2bZEobprwRXq (routes to lumentra-voice-agent, room prefix `call-`)

### How to deploy agent changes

```bash
# 1. Edit files locally in lumentra-agent/
# 2. Copy to server
scp -i ~/.ssh/id_ed25519 lumentra-agent/*.py lumentra-agent/Dockerfile root@178.156.205.145:/opt/livekit/agent/
# 3. Rebuild & restart
ssh -i ~/.ssh/id_ed25519 root@178.156.205.145 "cd /opt/livekit && docker compose up -d --build agent"
# 4. Check logs
ssh -i ~/.ssh/id_ed25519 root@178.156.205.145 "cd /opt/livekit && docker compose logs agent --tail=50"
```

---

## Server Access

- **SSH:** `ssh -i ~/.ssh/id_ed25519 root@178.156.205.145` (key-only, no passwords)
- **Coolify dashboard:** `https://178.156.205.145:8000` (restricted to admin IP)
- LiveKit stack at `/opt/livekit/` (separate from Coolify)
- API + Dashboard managed by Coolify

---

## Security (hardened 2026-03-01)

| Layer                   | Status                                                              |
| ----------------------- | ------------------------------------------------------------------- |
| SSH                     | Key-only auth, password login disabled, fail2ban active (548+ bans) |
| SIP (5060)              | Restricted to 15 SignalWire IPs only                                |
| RTP (10000-20000)       | Restricted to SignalWire IPs only                                   |
| LiveKit API (7880-7881) | Restricted to admin IP subnet                                       |
| Coolify (8000)          | Restricted to admin IP subnet                                       |
| API (3100)              | Restricted to admin IP subnet                                       |
| Ports 6001, 6002, 8080  | Blocked (unused Coolify internals)                                  |
| Secret files            | chmod 600 (root-only)                                               |

**SignalWire IPs are dynamic.** If calls stop connecting, re-resolve and update:

```bash
dig sip.signalwire.com  # get current IPs
# Update both Hetzner cloud firewall (hcloud CLI) and UFW on server
```

**If your IP changes** and you lose access to Coolify/LiveKit/API:

```bash
# SSH still works (open to all, key-only)
ssh -i ~/.ssh/id_ed25519 root@178.156.205.145
ufw allow from YOUR_NEW_IP/24 to any port 3100 proto tcp comment "API - admin only"
ufw allow from YOUR_NEW_IP/24 to any port 7880 proto tcp comment "LiveKit API - admin only"
ufw allow from YOUR_NEW_IP/24 to any port 7881 proto tcp comment "LiveKit TCP - admin only"
ufw allow from YOUR_NEW_IP/24 to any port 8000 proto tcp comment "Coolify - admin only"
```

---

## What Does Not Work Perfectly

See [KNOWN-ISSUES.md](KNOWN-ISSUES.md) for full details.
